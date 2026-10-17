import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'

test('listing contact RPC respects visibility for public, owner and moderator callers', async () => {
  const db = new PGlite()
  const owner = '00000000-0000-0000-0000-000000000001'
  const buyer = '00000000-0000-0000-0000-000000000002'
  const moderator = '00000000-0000-0000-0000-000000000003'
  const listing = '00000000-0000-0000-0000-000000000004'
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.role() returns text language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
      grant usage on schema auth to anon,authenticated;
      create table profiles(id uuid primary key,role text);
      create function public.is_moderator() returns boolean language sql stable security definer as
        $$ select exists(select 1 from profiles where id=auth.uid() and role='moderator') $$;
      create table mineral_listings(id uuid primary key,seller_id uuid,status text,listing_state text,seller_contact text);
      alter table mineral_listings enable row level security;
      create policy visible on mineral_listings for select using
        ((status='verified' and listing_state='active') or seller_id=auth.uid() or public.is_moderator());
      grant select(id,seller_id,status,listing_state) on mineral_listings to anon,authenticated;
    `)
    await db.query('insert into profiles values($1,$2)', [moderator,'moderator'])
    await db.query('insert into mineral_listings values($1,$2,$3,$4,$5)', [listing,owner,'pending','active','synthetic-contact'])
    // Captured production implementation: an invisible listing could still
    // disclose its contact through a direct authenticated RPC request.
    await db.exec(`create function public.get_masked_seller_contact(p_listing_id uuid) returns text language sql security definer set search_path=public as $$ select case when auth.role()='authenticated' then seller_contact else null end from mineral_listings where id=p_listing_id $$;`)
    const actor = async (role,id='') => {
      await db.exec('reset role')
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id])
      await db.query("select set_config('request.jwt.claim.role',$1,false)",[role])
      await db.exec(`set role ${role}`)
    }
    const contact = async (id=listing) => (await db.query('select get_masked_seller_contact($1) as value',[id])).rows[0].value
    await actor('authenticated',buyer)
    assert.equal((await db.query('select id from mineral_listings')).rows.length,0)
    assert.equal(await contact(),'synthetic-contact', 'reproduces the old direct-RPC bypass')
    await db.exec('reset role')
    await db.exec(await readFile(new URL('../supabase/migrations/20261017115302_restrict_listing_contact_to_visible_listings.sql',import.meta.url),'utf8'))
    await actor('authenticated',buyer)
    assert.equal(await contact(),null)
    await assert.rejects(db.query('select seller_contact from mineral_listings'),/permission denied/)
    for (const status of ['pending','rejected','verified']) {
      for (const state of ['active','paused','sold','archived']) {
        await db.exec('reset role')
        await db.query('update mineral_listings set status=$1,listing_state=$2',[status,state])
        await actor('authenticated',buyer)
        assert.equal(await contact(),status==='verified' && state==='active'?'synthetic-contact':null,`${status}/${state}`)
        for (const allowed of [owner,moderator]) {
          await actor('authenticated',allowed)
          assert.equal(await contact(),'synthetic-contact')
        }
        await actor('anon')
        assert.equal(await contact(),null)
      }
    }
    await actor('authenticated')
    assert.equal(await contact(),null)
    await actor('authenticated',buyer)
    assert.equal(await contact('00000000-0000-0000-0000-000000000099'),null)
    // public-view reads continue to work with contact column SELECT denied.
    await db.exec('reset role')
    await db.query("update mineral_listings set status='verified',listing_state='active'")
    await db.exec('create view contact_test_view with (security_invoker=true) as select id,get_masked_seller_contact(id) as contact from mineral_listings; grant select on contact_test_view to anon,authenticated;')
    await actor('anon')
    assert.equal((await db.query('select contact from contact_test_view')).rows[0].contact,null)
    await actor('authenticated',buyer)
    assert.equal((await db.query('select contact from contact_test_view')).rows[0].contact,'synthetic-contact')
  } finally { await db.close() }
})

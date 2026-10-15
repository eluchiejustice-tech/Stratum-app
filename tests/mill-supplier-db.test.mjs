import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
test('supplier account records are private, role filtered, linked to quantities and revision protected',async()=>{
 const db=new PGlite(),ids=Array.from({length:4},()=>randomUUID())
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`)
 for(const [i,id] of ids.entries())await db.query('insert into auth.users values($1,$2)',[id,`supplier-test${i}@example.test`])
 await db.exec(await readFile(new URL('../supabase/migrations/20261015172252_processing_mill_workspace.sql',import.meta.url),'utf8'))
 const actor=async i=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[i]]);await db.exec('set role authenticated')}
 const team=async(w,a,p)=>(await db.query('select mill_team_action($1,$2,$3::jsonb) result',[w,a,JSON.stringify(p)])).rows[0].result
 const supplies=async(w,b=null)=>(await db.query('select mill_suppliers($1,0,50,$2) result',[w,b])).rows[0].result
 const record=async(w,a,p,b=null,rev=null,req=randomUUID())=>(await db.query('select mill_record_batch($1,$2,$3::jsonb,$4,$5,$6) result',[w,a,JSON.stringify(p),b,rev,req])).rows[0].result
 await actor(0);const w=(await db.query("insert into processing_director_workspaces(name) values('Supplier mill') returning id")).rows[0].id
 for(const [i,role] of [[1,'receiving'],[2,'production']]){const invitation=await team(w,'invite',{name:role+' staff',role});await actor(i);await team(null,'join',{code:invitation.code});await actor(0);await team(w,'approve_member',{user_id:ids[i]})}
 await actor(1);const request=randomUUID(),payload={batch_code:'KAT-100',claimed_mineral:'taili',origin:'Katsina',bag_count:100,supplier:'Sample Supplier',supplier_phone:'+2348000000000',bank_name:'Example Bank',account_name:'Sample Supplier',account_number:'0012345678'}
 const b=await record(w,'receive',payload,null,null,request);await record(w,'receive',payload,null,null,request)
 let list=await supplies(w);assert.equal(list.total,1);assert.equal(list.items[0].phone,payload.supplier_phone);assert.equal(list.items[0].account_details.account_number,'0012345678');assert.equal(list.items[0].material,'taili');assert.equal(list.items[0].bag_count,100);assert.equal(list.items[0].received_weight_kg,null)
 const events=(await db.query('select * from processing_mill_events')).rows;assert.equal(events.length,1);assert.doesNotMatch(JSON.stringify(events),/0012345678|Example Bank|account_number|supplier_phone/)
 await assert.rejects(record(w,'receive',{...payload,batch_code:'BAD-BANK',account_name:''}),/Complete bank/)
 await assert.rejects(db.query('select * from stratum_processing_team.supplier_details'),/permission denied/)
 await actor(2);list=await supplies(w);assert.equal(list.items[0].account_details,null);assert.equal(list.items[0].phone,payload.supplier_phone);await assert.rejects(record(w,'supplier_update',{...payload,notes:'Spoof'},b.id,1),/Supplier management role/)
 await actor(0);const updated=await record(w,'supplier_update',{supplier:'Updated supplier',supplier_phone:'08011111111',bank_name:'Example Bank',account_name:'Updated supplier',account_number:'0012345678',notes:'Customer corrected their contact name'},b.id,1)
 assert.equal(updated.revision,2);assert.equal((await supplies(w,b.id)).items[0].supplier,'Updated supplier')
 await assert.rejects(record(w,'supplier_update',{supplier:'Stale',notes:'Old data'},b.id,1),/Batch changed/)
 await record(w,'supplier_update',{supplier:'Updated supplier',supplier_phone:'08011111111',notes:'Supplier asked to clear old bank details'},b.id,2);assert.equal((await supplies(w,b.id)).items[0].account_details.account_number,null)
 const other=(await db.query("insert into processing_director_workspaces(name) values('Other mill') returning id")).rows[0].id;assert.equal((await supplies(other,b.id)).items.length,0)
 await actor(3);await assert.rejects(supplies(w),/Mill access required/)
 await db.exec('reset role;set role anon');await assert.rejects(supplies(w),/permission denied/)
 }finally{await db.close()}
})


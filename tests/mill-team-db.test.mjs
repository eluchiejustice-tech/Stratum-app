import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
test('mill staff invitations, stage permissions, actor history, retry and revocation',async()=>{
 const db=new PGlite(),ids=Array.from({length:8},()=>randomUUID())
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`)
 for(const [i,id] of ids.entries())await db.query('insert into auth.users values($1,$2)',[id,`staff${i}@example.test`])
 await db.exec(await readFile(new URL('../supabase/migrations/20261015172252_processing_mill_workspace.sql',import.meta.url),'utf8'))
 const actor=async i=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[i]]);await db.exec('set role authenticated')}
 const team=async(w,a,p)=>(await db.query('select mill_team_action($1,$2,$3::jsonb) result',[w,a,JSON.stringify(p)])).rows[0].result
 const board=async w=>(await db.query('select mill_dashboard($1) result',[w])).rows[0].result
 const record=async(w,a,p,b=null,revision=null,request=randomUUID())=>(await db.query('select mill_record_batch($1,$2,$3::jsonb,$4,$5,$6) result',[w,a,JSON.stringify(p),b,revision,request])).rows[0].result
 await actor(0)
 const w=(await db.query("insert into processing_director_workspaces(name) values('Katsina operations') returning id")).rows[0].id
 const roles=['receiving','manager','production','supervisor','dispatch','laboratory']
 for(const [i,role] of roles.entries()){
  await actor(0);const invite=await team(w,'invite',{name:`Staff ${i+1}`,role});assert.equal(invite.code.length,64)
  await actor(i+1);await team(null,'join',{code:invite.code});await assert.rejects(board(w),/Mill access required/)
  await assert.rejects(team(w,'approve_member',{user_id:ids[i+1]}),/Only the director/)
  await actor(7);await assert.rejects(team(null,'join',{code:invite.code}),/already used/)
  await actor(0);await team(w,'approve_member',{user_id:ids[i+1]});await actor(i+1);assert.equal((await board(w)).role,role)
 }
 await actor(1)
 const payload={batch_code:'KAT-100',claimed_mineral:'taili',origin:'Katsina',bag_count:100,received_on:'2026-10-08'},request=randomUUID()
 let b=await record(w,'receive',payload,null,null,request);assert.equal(b.bag_count,100);assert.equal(b.received_weight_kg,null);assert.equal(b.workflow_status,'received')
 assert.equal((await record(w,'receive',payload,null,null,request)).id,b.id)
 assert.equal((await board(w)).events.length,1)
 await assert.rejects(record(w,'receive',{...payload,bag_count:101},null,null,request),/ID already used/)
 await assert.rejects(record(w,'approve',{notes:'Wrong role'},b.id,b.revision),/Manager review/)
 await assert.rejects(record(w,'note',{notes:'Spoof',actor_id:ids[0]},b.id,b.revision),/Unexpected fields/)
 await actor(2);b=await record(w,'approve',{notes:'100 bags accepted'},b.id,b.revision)
 await actor(3);await assert.rejects(record(w,'start',{notes:'Old',processing_method:'Gravity'},b.id,1),/Batch changed/)
 b=await record(w,'start',{notes:'Started shift',processing_method:'Gravity'},b.id,b.revision)
 await assert.rejects(record(w,'finish',{notes:'No measurement'},b.id,b.revision),/Record measured output/)
 b=await record(w,'finish',{notes:'Completed production',output_bags:75},b.id,b.revision)
 await actor(4);b=await record(w,'verify',{notes:'Supervisor checked'},b.id,b.revision)
 await actor(5);b=await record(w,'dispatch',{notes:'Released to customer'},b.id,b.revision);assert.equal(b.workflow_status,'dispatched')
 await actor(6);b=await record(w,'note',{notes:'Laboratory report received'},b.id,b.revision)
 await actor(0);const dashboard=await board(w);assert.equal(dashboard.events.length,7);assert.equal(dashboard.counts.dispatched,1)
 const receipt=dashboard.events.find(e=>e.action==='receive');assert.equal(receipt.actor_id,ids[1]);assert.equal(receipt.actor_role,'receiving');assert.equal(receipt.actor_name,'Staff 1')
 await assert.rejects(db.query("update processing_mill_events set actor_name='Fake'"),/permission denied/)
 await assert.rejects(db.query('select * from stratum_processing_team.invites'),/permission denied/)
 await team(w,'remove_member',{user_id:ids[1]});await actor(1);await assert.rejects(board(w),/Mill access required/);assert.equal((await db.query('select * from processing_mill_events')).rows.length,0);await assert.rejects(record(w,'note',{notes:'Revoked'},b.id,b.revision),/Mill access required/)
 await actor(7);for(const t of ['processing_director_workspaces','processing_director_batches','processing_mill_events'])assert.equal((await db.query('select * from '+t)).rows.length,0)
 await assert.rejects(board(w),/Mill access required/)
 await db.exec('reset role;set role anon');await assert.rejects(board(w),/permission denied/)
 }finally{await db.close()}
})


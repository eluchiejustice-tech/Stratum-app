import test from 'node:test'
import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
test('camera SQL isolates owners and credentials, enforces rules, dedupe, cooldown and attributed review',async()=>{
 const db=new PGlite()
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;insert into auth.users(id) values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`)
 await db.exec(await readFile(new URL('../supabase/migrations/20261015172252_processing_mill_workspace.sql',import.meta.url),'utf8'))
 await db.exec(await readFile(new URL('../supabase/migrations/20261015172314_processing_camera_alerts.sql',import.meta.url),'utf8'))
 const actor=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role)}
 const owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002'
 await actor(owner)
 const workspace=(await db.query("insert into processing_director_workspaces(name) values('Camera pilot') returning id")).rows[0].id
 const minute=new Date().getUTCHours()*60+new Date().getUTCMinutes()
 const camera=(await db.query("insert into processing_director_cameras(workspace_id,name,zone_name,mode,timezone,allowed_start,allowed_end,zone_x,zone_y,zone_width,zone_height,enabled) values($1,'Storage','Concentrate storage','outside_hours','UTC',$2,$3,0,0,1,1,true) returning *",[workspace,(minute+1439)%1440,(minute+1)%1440])).rows[0]
 await assert.rejects(db.query("update processing_director_cameras set timezone='Invalid/place' where id=$1",[camera.id]),/Invalid timezone/)
 await assert.rejects(db.query('update processing_director_cameras set zone_width=2 where id=$1',[camera.id]),/check constraint/)
 await assert.rejects(db.query('select * from processing_director_camera_keys'),/permission denied/)
 await assert.rejects(db.query('update processing_director_cameras set workspace_id=$1 where id=$2',[workspace,camera.id]),/permission denied/)
 await actor('', 'service_role')
 const token='a'.repeat(64),event='11111111-1111-1111-1111-111111111111'
 await db.query("insert into processing_director_camera_keys(camera_id,token_hash,expires_at) values($1,$2,now()+interval '1 day')",[camera.id,token])
 const ingest=async(eventId=event,revision=1,hash=token)=>db.query('select ingest_processing_camera_motion($1,$2,$3,$4,$5,.2,$6) as result',[camera.id,hash,eventId,new Date().toISOString(),revision,'test-fixture-snapshot'])
 assert.equal((await ingest()).rows[0].result.status,'within_permitted_hours')
 await actor(owner)
 const revised=(await db.query("update processing_director_cameras set mode='restricted_zone' where id=$1 returning revision",[camera.id])).rows[0].revision
 assert.equal(revised,2)
 await actor('','service_role')
 await assert.rejects(ingest(event,1),/rule changed/)
 const result=(await ingest(event,2)).rows[0].result
 assert.equal(result.status,'needs_review')
 assert.equal((await ingest(event,2)).rows[0].result.status,'duplicate')
 assert.equal((await ingest('22222222-2222-2222-2222-222222222222',2)).rows[0].result.status,'cooldown')
 const seen=(await db.query('select revision from processing_director_cameras where id=$1',[camera.id])).rows[0].revision
 assert.equal(seen,2,'gateway timestamps do not change rule revision')
 await db.query("update processing_director_camera_keys set token_hash=$1 where camera_id=$2",['b'.repeat(64),camera.id])
 await assert.rejects(ingest(event,2),/Invalid gateway credential/)
 await db.exec('reset role')
 await db.query("insert into processing_mill_members(workspace_id,user_id,role,display_name,status) values($1,$2,'manager','Pilot manager','active')",[workspace,other])
 await actor(other)
 assert.equal((await db.query('select * from processing_director_workspaces')).rows.length,1,'approved staff can read their mill')
 for(const table of ['processing_director_cameras','processing_director_movement_alerts'])assert.equal((await db.query('select * from '+table)).rows.length,0)
 assert.equal((await db.query("update processing_director_movement_alerts set status='follow_up',review_note='intruder' where id=$1 returning *",[result.alert_id])).rows.length,0)
 await actor(owner)
 await assert.rejects(db.query("insert into processing_director_movement_alerts(camera_id,workspace_id,event_id,occurred_at,camera_name,zone_name,rule_mode,rule_revision,motion_ratio,snapshot_png) values($1,$2,$3,now(),'Fake','Fake','restricted_zone',1,.5,'fake')",[camera.id,workspace,event]),/permission denied/)
 await assert.rejects(db.query("update processing_director_movement_alerts set snapshot_png='altered' where id=$1",[result.alert_id]),/permission denied/)
 await assert.rejects(db.query("update processing_director_movement_alerts set status='follow_up',review_note='' where id=$1",[result.alert_id]),/review decision/)
 const reviewed=(await db.query("update processing_director_movement_alerts set status='expected_activity',review_note='Authorised staff checked on site' where id=$1 and revision=1 returning *",[result.alert_id])).rows[0]
 assert.equal(reviewed.reviewed_by,owner);assert.equal(reviewed.revision,2);assert.equal(reviewed.snapshot_png,'test-fixture-snapshot')
 assert.equal((await db.query("update processing_director_movement_alerts set status='follow_up',review_note='stale' where id=$1 and revision=1 returning *",[result.alert_id])).rows.length,0)
 await assert.rejects(ingest(event,2),/permission denied/)
 await db.exec('reset role;set role anon')
 for(const table of ['processing_director_cameras','processing_director_camera_keys','processing_director_movement_alerts'])await assert.rejects(db.query('select * from '+table),/permission denied/)
 }finally{await db.close()}
})


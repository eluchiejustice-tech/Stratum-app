import test from 'node:test'
import assert from 'node:assert/strict'
import {webcrypto} from 'node:crypto'
import {cameraEventHandler} from '../supabase/functions/processing-camera-events/handler.mjs'
import {snapshotPng} from './fixtures/camera-snapshot.mjs'
const id='11111111-1111-1111-1111-111111111111'
function fixture(){
 const keys=[],calls=[]
 const cameras=[{id,workspace_id:'workspace',owner_id:'owner',enabled:true,revision:1,name:'Store',zone_name:'Stockpile',mode:'restricted_zone',timezone:'Africa/Lagos',allowed_start:480,allowed_end:1080,zone_x:0,zone_y:0,zone_width:1,zone_height:1}]
 const createClient=(_url,key,options={})=>{
  const user=options.global?.headers?.Authorization==='Bearer owner-jwt'?'owner':options.global?.headers?.Authorization==='Bearer other-jwt'?'other':null
  const admin=key==='service'
  return {
   auth:{getUser:async()=>user?{data:{user:{id:user}}}:{data:{user:null},error:{message:'invalid'}}},
   from(table){
    let filters=[],payload=null,mode='select'
    const q={select(){return q},eq(k,v){filters.push([k,'eq',v]);return q},gt(k,v){filters.push([k,'gt',v]);return q},maybeSingle:async()=>{
     const rows=table==='processing_director_camera_keys'?keys:cameras
     const row=rows.find(row=>(admin||row.owner_id===user)&&filters.every(([k,op,v])=>op==='eq'?row[k]===v:row[k]>v))
     return {data:row?{...row}:null}
    },upsert:async(value)=>{assert.ok(admin);const old=keys.find(k=>k.camera_id===value.camera_id);old?Object.assign(old,value):keys.push(value);return{}},
    update(value){payload=value;mode='update';return q},
    then(resolve,reject){return Promise.resolve().then(()=>{assert.ok(admin);for(const row of keys)if(filters.every(([k,,v])=>row[k]===v))Object.assign(row,payload);return{}}).then(resolve,reject)}
    };return q
   },
   rpc:async(name,args)=>{assert.ok(admin);calls.push({name,args});return {data:{status:'needs_review',alert_id:'alert'}}}
  }
 }
 const handle=cameraEventHandler({createClient,url:'https://example.test',anon:'anon',service:'service',cryptoApi:webcrypto})
 const request=(body,headers={})=>handle(new Request('https://example.test/camera',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}))
 return {handle,request,keys,calls,cameras}
}
test('credential issuance requires a verified signed-in owner and never returns its stored hash',async()=>{
 const f=fixture()
 assert.equal((await f.request({action:'issue_key',camera_id:id})).status,401)
 assert.equal((await f.request({action:'issue_key',camera_id:id},{Authorization:'Bearer fake-jwt'})).status,401)
 assert.equal((await f.request({action:'issue_key',camera_id:id},{Authorization:'Bearer other-jwt'})).status,403)
 const response=await f.request({action:'issue_key',camera_id:id},{Authorization:'Bearer owner-jwt'})
 const body=await response.json()
 assert.equal(response.status,200);assert.match(body.token,/^[a-f0-9]{64}$/);assert.equal(body.token_hash,undefined)
 assert.notEqual(f.keys[0].token_hash,body.token);assert.equal(response.headers.get('Cache-Control'),'no-store')
})
test('camera-specific hashed credential permits configuration; rotation, expiry and revocation deny old credentials',async()=>{
 const f=fixture()
 const issue=async()=> (await f.request({action:'issue_key',camera_id:id},{Authorization:'Bearer owner-jwt'})).json()
 const first=await issue(),headers={'x-camera-token':first.token}
 assert.equal((await f.request({action:'config',camera_id:id},headers)).status,200)
 assert.equal((await f.request({action:'config',camera_id:id})).status,401)
 const second=await issue()
 assert.equal((await f.request({action:'config',camera_id:id},headers)).status,401)
 const newer={'x-camera-token':second.token}
 assert.equal((await f.request({action:'config',camera_id:id},newer)).status,200)
 f.cameras[0].enabled=false;assert.equal((await f.request({action:'config',camera_id:id},newer)).status,403);f.cameras[0].enabled=true
 await f.request({action:'revoke_key',camera_id:id},{Authorization:'Bearer owner-jwt'})
 assert.equal((await f.request({action:'config',camera_id:id},newer)).status,401)
})
test('invalid movement bodies and large requests never reach privileged ingestion',async()=>{
 const f=fixture()
 const issued=await (await f.request({action:'issue_key',camera_id:id},{Authorization:'Bearer owner-jwt'})).json()
 const response=await f.request({action:'motion',camera_id:id,event_id:id,occurred_at:new Date().toISOString(),rule_revision:1,motion_ratio:.5,snapshot_png:'invalid'},{'x-camera-token':issued.token})
 assert.equal(response.status,400);assert.equal(f.calls.length,0)
 assert.equal((await f.request({action:'motion',camera_id:id,padding:'x'.repeat(170000)})).status,413)
 assert.equal((await f.handle(new Request('https://example.test',{method:'GET'}))).status,405)
})
test('motion ingestion uses the authenticated camera hash and validated event fields',async()=>{
 const f=fixture()
 const issued=await (await f.request({action:'issue_key',camera_id:id},{Authorization:'Bearer owner-jwt'})).json()
 const snapshot_png=snapshotPng
 const result=await f.request({action:'motion',camera_id:id,event_id:'22222222-2222-2222-2222-222222222222',occurred_at:new Date().toISOString(),rule_revision:1,motion_ratio:.5,snapshot_png,workspace_id:'foreign'},{'x-camera-token':issued.token})
 assert.equal(result.status,200);assert.equal(f.calls.length,1);assert.equal(f.calls[0].args.p_hash,f.keys[0].token_hash)
 assert.equal(f.calls[0].args.workspace_id,undefined);assert.equal(f.calls[0].args.p_camera_id,id)
})


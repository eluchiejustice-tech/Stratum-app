const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type,x-camera-token','Access-Control-Allow-Methods':'POST,OPTIONS'}
import {validateMotionEvent} from './rules.mjs'
export function cameraEventHandler({createClient,url,anon,service,cryptoApi=crypto,now=()=>Date.now()}){
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}})
 const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
 const hash=async value=>Array.from(new Uint8Array(await cryptoApi.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('')
 return async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return json({error:'Use POST.'},405)
  try{
   let length=0,text=''
   const reader=req.body?.getReader()
   if(!reader)return json({error:'Missing request.'},400)
   const decoder=new TextDecoder()
   while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>160000){await reader.cancel();return json({error:'Request too large.'},413)}text+=decoder.decode(part.value,{stream:true})}
   text+=decoder.decode()
   const body=JSON.parse(text)
   if(!body || !uuid(body.camera_id))return json({error:'Invalid camera.'},400)
   if(!['issue_key','revoke_key','config','motion'].includes(body.action))return json({error:'Invalid action.'},400)
   if(body.action==='issue_key'||body.action==='revoke_key'){
    const authorization=req.headers.get('Authorization')||''
    if(!authorization.startsWith('Bearer '))return json({error:'Sign in required.'},401)
    const userClient=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}})
    const {data:identity,error:authError}=await userClient.auth.getUser(authorization.slice(7))
    if(authError||!identity?.user)return json({error:'Sign in required.'},401)
    const {data:camera,error:cameraError}=await userClient.from('processing_director_cameras').select('id,workspace_id').eq('id',body.camera_id).maybeSingle()
    if(cameraError||!camera)return json({error:'Camera access denied.'},403)
    const admin=createClient(url,service,{auth:{persistSession:false}})
    if(body.action==='revoke_key'){
     const {error}=await admin.from('processing_director_camera_keys').update({expires_at:new Date(0).toISOString()}).eq('camera_id',camera.id)
     if(error)return json({error:'Could not revoke gateway access.'},500)
     return json({status:'revoked'})
    }
    const token=Array.from(cryptoApi.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('')
    const expires_at=new Date(now()+90*86400000).toISOString()
    const {error}=await admin.from('processing_director_camera_keys').upsert({camera_id:camera.id,token_hash:await hash(token),expires_at},{onConflict:'camera_id'})
    if(error)return json({error:'Could not issue gateway access.'},500)
    return json({token,expires_at})
   }
   const token=req.headers.get('x-camera-token')||''
   if(!/^[a-f0-9]{64}$/.test(token))return json({error:'Gateway credential required.'},401)
   const tokenHash=await hash(token)
   const admin=createClient(url,service,{auth:{persistSession:false}})
   const {data:key,error:keyError}=await admin.from('processing_director_camera_keys').select('camera_id,expires_at').eq('camera_id',body.camera_id).eq('token_hash',tokenHash).gt('expires_at',new Date(now()).toISOString()).maybeSingle()
   if(keyError||!key)return json({error:'Invalid gateway credential.'},401)
   const {data:camera,error:cameraError}=await admin.from('processing_director_cameras').select('id,name,zone_name,mode,timezone,allowed_start,allowed_end,zone_x,zone_y,zone_width,zone_height,enabled,revision').eq('id',body.camera_id).maybeSingle()
   if(cameraError||!camera||!camera.enabled)return json({error:'Camera is disabled or unavailable.'},403)
   if(body.action==='config')return json({camera})
   let event
   try{event=validateMotionEvent(body,now())}catch{return json({error:'Invalid, stale or oversized movement event.'},400)}
   const {data,error}=await admin.rpc('ingest_processing_camera_motion',{p_camera_id:event.camera_id,p_hash:tokenHash,p_event_id:event.event_id,p_occurred_at:event.occurred_at,p_revision:event.rule_revision,p_ratio:event.motion_ratio,p_snapshot:event.snapshot_png})
   if(error)return json({error:'Movement event rejected. Reload camera configuration and check gateway access.'},409)
   return json(data)
  }catch{return json({error:'Request could not be processed.'},400)}
 }
}


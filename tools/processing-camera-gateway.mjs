import {spawn} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {MotionGate,motionRatio} from '../supabase/functions/processing-camera-events/rules.mjs'
const W=160,H=90
export function rawFrameReader(onFrame){
 let pending=Buffer.alloc(0)
 return chunk=>{
  pending=Buffer.concat([pending,chunk])
  while(pending.length>=W*H){const frame=Buffer.from(pending.subarray(0,W*H));pending=pending.subarray(W*H);onFrame(frame)}
 }
}
export function pngFrame(frame){
 return new Promise((resolve,reject)=>{
  const process=spawn('ffmpeg',['-hide_banner','-loglevel','error','-f','rawvideo','-pixel_format','gray','-video_size','160x90','-i','pipe:0','-frames:v','1','-f','image2pipe','-vcodec','png','pipe:1'],{stdio:['pipe','pipe','ignore']})
  const chunks=[];let length=0
  const timer=setTimeout(()=>{process.kill();reject(new Error('Snapshot encoding timed out'))},10000)
  process.stdout.on('data',chunk=>{length+=chunk.length;if(length>90000){process.kill();reject(new Error('Snapshot too large'))}else chunks.push(chunk)})
  process.stdin.on('error',()=>{})
  process.on('error',()=>{clearTimeout(timer);reject(new Error('FFmpeg unavailable'))})
  process.on('close',code=>{clearTimeout(timer);if(code===0)resolve(Buffer.concat(chunks).toString('base64'));else reject(new Error('Snapshot encoding failed'))})
  process.stdin.end(frame)
 })
}
export async function runCameraGateway(env=process.env){
 const endpoint=new URL(env.STRATUM_CAMERA_ENDPOINT||'')
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||!endpoint.pathname.endsWith('/functions/v1/processing-camera-events'))throw new Error('Set the HTTPS Stratum camera endpoint.')
 const camera_id=env.STRATUM_CAMERA_ID,token=env.STRATUM_CAMERA_TOKEN,source=env.STRATUM_CAMERA_RTSP
 if(!/^[a-f0-9]{64}$/.test(token||'')||!/^[0-9a-f-]{36}$/i.test(camera_id||'')||!/^rtsps?:\/\//.test(source||''))throw new Error('Set the camera ID, gateway token and local RTSP source.')
 const send=async body=>{
  const result=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-camera-token':token},body:JSON.stringify({...body,camera_id}),signal:AbortSignal.timeout(15000)})
  if(!result.ok)throw new Error('Gateway request failed ('+result.status+'). Check access, configuration and connectivity.')
  return result.json()
 }
 let config=(await send({action:'config'})).camera,previous=null,gate=new MotionGate(),inFlight=false,closed=false,stopping=false,lastFrame=Date.now()
 const child=spawn('ffmpeg',['-hide_banner','-loglevel','error','-rtsp_transport','tcp','-i',source,'-an','-vf','fps=1,scale=160:90,format=gray','-f','rawvideo','pipe:1'],{stdio:['ignore','pipe','ignore']})
 const poll=setInterval(async()=>{
  if(closed)return
  if(Date.now()-lastFrame>30000){console.error('No camera frames received for 30 seconds. Gateway stopped; supervision must restart it.');child.kill();return}
  try{const next=(await send({action:'config'})).camera;if(next.revision!==config.revision){previous=null;gate=new MotionGate()}config=next}
  catch{console.error('Camera configuration unavailable. Gateway stopped; supervision must restart it.');child.kill()}
 },30000)
 const consume=rawFrameReader(frame=>{
  lastFrame=Date.now()
  if(!previous){previous=frame;return}
  const ratio=motionRatio(previous,frame,W,H,config);previous=frame
  if(!gate.observe(ratio,Date.now())||inFlight)return
  inFlight=true
  const revision=config.revision
  const occurred_at=new Date(lastFrame).toISOString()
  ;(async()=>{
   try{
    const snapshot_png=await pngFrame(frame)
    const event={action:'motion',event_id:crypto.randomUUID(),occurred_at,rule_revision:revision,motion_ratio:ratio,snapshot_png}
    const response=await send(event)
    console.log('Movement event response: '+response.status)
   }catch{console.error('Movement event was not confirmed. Check the gateway connection; events are not queued offline.')}
   finally{inFlight=false}
  })()
 })
 child.stdout.on('data',consume)
 const stop=()=>{stopping=true;child.kill()}
 process.once('SIGINT',stop);process.once('SIGTERM',stop)
 await new Promise((resolve,reject)=>{
  child.on('error',()=>reject(new Error('FFmpeg could not start')))
  child.on('close',()=>stopping?resolve():reject(new Error('Camera stream stopped')))
 }).finally(()=>{closed=true;clearInterval(poll);process.off('SIGINT',stop);process.off('SIGTERM',stop)})
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 runCameraGateway().catch(()=>{console.error('Camera gateway could not run. Check local configuration and network access.');process.exitCode=1})
}


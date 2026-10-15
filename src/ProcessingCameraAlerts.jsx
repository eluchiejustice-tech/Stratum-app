import {useCallback,useEffect,useRef,useState} from 'react'
import {cameraRulePayload} from './processingCameraRules.js'
import {readWorkspaceSnapshot,tablePage} from './workspaceReads.js'
const emptyRule={name:'',zone_name:'',mode:'outside_hours',timezone:'Africa/Lagos',allowed_start:'08:00',allowed_end:'18:00',zone_x:0,zone_y:0,zone_width:1,zone_height:1,enabled:false}
const time=value=>String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0')
const listFields='id,camera_id,event_id,occurred_at,received_at,camera_name,zone_name,rule_mode,rule_revision,motion_ratio,status,review_note,reviewed_at,revision'
export default function ProcessingCameraAlerts({client,workspaceId,onRegisterRefresh,onDirtyChange}){
 const [cameras,setCameras]=useState([]),[alerts,setAlerts]=useState([]),[cameraMore,setCameraMore]=useState(false),[alertMore,setAlertMore]=useState(false)
 const [loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 const [draft,setDraft]=useState(null),[editing,setEditing]=useState(null),[credential,setCredential]=useState(null)
 const [review,setReview]=useState(null),[decision,setDecision]=useState('expected_activity'),[note,setNote]=useState(''),[snapshot,setSnapshot]=useState(null)
 const alive=useRef(true),reading=useRef(null),writing=useRef(false)
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;reading.current?.abort()}},[])
 const read=useCallback(async(cameraOffset=0,alertOffset=0,kind='both')=>{
  reading.current?.abort();const controller=new AbortController();reading.current=controller;setBusy(true);setError('')
  try{
   const requests={}
   if(kind!=='alerts')requests.cameras=tablePage(client.from('processing_director_cameras').select('*',{count:'exact'}).eq('workspace_id',workspaceId).order('created_at',{ascending:false}).order('id'),cameraOffset,25)
   if(kind!=='cameras')requests.alerts=tablePage(client.from('processing_director_movement_alerts').select(listFields,{count:'exact'}).eq('workspace_id',workspaceId).order('received_at',{ascending:false}).order('id'),alertOffset,25)
   const saved=await readWorkspaceSnapshot(requests,{signal:controller.signal})
   if(alive.current&&!controller.signal.aborted){
    if(saved.cameras){setCameras(current=>cameraOffset?[...current,...saved.cameras.items]:saved.cameras.items);setCameraMore(saved.cameras.hasMore)}
    if(saved.alerts){setAlerts(current=>alertOffset?[...current,...saved.alerts.items]:saved.alerts.items);setAlertMore(saved.alerts.hasMore)}
    setLoaded(true)
   }
   return true
  }catch{if(alive.current&&!controller.signal.aborted)setError('Could not load camera rules and movement alerts. Retry; previous records remain visible.');return false}
  finally{if(alive.current&&reading.current===controller){reading.current=null;setBusy(false)}}
 },[client,workspaceId])
 useEffect(()=>{read()},[read])
 useEffect(()=>onRegisterRefresh?.(()=>draft||review||credential?false:read()),[onRegisterRefresh,read,draft,review,credential])
 useEffect(()=>{
  if(busy||draft||review||credential)return
  const timer=setInterval(()=>{if(document.visibilityState!=='hidden')read()},20000)
  return()=>clearInterval(timer)
 },[busy,draft,review,credential,read])
 function edit(row){setEditing(row);setDraft(row?{...row,allowed_start:time(row.allowed_start),allowed_end:time(row.allowed_end)}:{...emptyRule});setError('');setMessage('')}
 async function save(event){
  event.preventDefault();if(writing.current||busy)return
  let payload;try{payload=cameraRulePayload(draft)}catch(e){setError(e.message);return}
  writing.current=true;setBusy(true);setError('')
  try{
   let query=client.from('processing_director_cameras')
   query=editing?query.update(payload).eq('id',editing.id).eq('workspace_id',workspaceId).eq('revision',editing.revision):query.insert({...payload,workspace_id:workspaceId})
   const {saved}=await readWorkspaceSnapshot({saved:query.select().maybeSingle()})
   if(!saved)throw new Error('conflict')
   if(alive.current){setCameras(current=>editing?current.map(row=>row.id===saved.id?saved:row):[saved,...current]);setDraft(null);setEditing(null);setMessage('Camera rule saved. Connect the local gateway to receive real movement events.')}
  }catch{if(alive.current)setError('Rule save was not confirmed. Your draft remains; close it and refresh before retrying a changed rule.')}
  finally{writing.current=false;if(alive.current)setBusy(false)}
 }
 async function key(camera,action){
  if(writing.current||busy)return
  writing.current=true;setBusy(true);setError('');setCredential(null)
  try{
   const {data,error}=await client.functions.invoke('processing-camera-events',{body:{action,camera_id:camera.id},timeout:30000})
   if(error||!data||action==='issue_key'&&!data.token)throw new Error('not confirmed')
   if(alive.current){if(action==='issue_key')setCredential({...data,camera_id:camera.id});setMessage(action==='issue_key'?'New gateway credential issued. Previous credentials no longer work.':'Gateway access revoked.')}
  }catch{if(alive.current)setError('Gateway credential change was not confirmed. Check the deployed camera service and your access before retrying.')}
  finally{writing.current=false;if(alive.current)setBusy(false)}
 }
 async function openAlert(row){
  if(busy)return;setReview(row);setDecision(row.status==='follow_up'?'follow_up':'expected_activity');setNote(row.review_note||'');setSnapshot(null);setBusy(true);setError('')
  try{
   const {saved}=await readWorkspaceSnapshot({saved:client.from('processing_director_movement_alerts').select('snapshot_png').eq('id',row.id).eq('workspace_id',workspaceId).single()})
   if(alive.current)setSnapshot(saved?.snapshot_png||null)
  }catch{if(alive.current)setError('Snapshot could not load. Refresh before relying on this alert.')}
  finally{if(alive.current)setBusy(false)}
 }
 async function saveReview(event){
  event.preventDefault();if(busy||writing.current)return
  if(!note.trim()){setError('Explain your review decision.');return}
  writing.current=true;setBusy(true);setError('')
  try{
   const {saved}=await readWorkspaceSnapshot({saved:client.from('processing_director_movement_alerts').update({status:decision,review_note:note.trim()}).eq('id',review.id).eq('workspace_id',workspaceId).eq('revision',review.revision).select(listFields).maybeSingle()})
   if(!saved)throw new Error('conflict')
   if(alive.current){setAlerts(current=>current.map(row=>row.id===saved.id?saved:row));setReview(null);setSnapshot(null);setMessage('Movement alert review saved.')}
  }catch{if(alive.current)setError('Review save was not confirmed. Your reason remains; close and refresh to check the latest alert.')}
  finally{writing.current=false;if(alive.current)setBusy(false)}
 }
 useEffect(()=>{onDirtyChange?.(!!draft||!!review||!!credential);return()=>onDirtyChange?.(false)},[onDirtyChange,!!draft,!!review,!!credential])
 const blocked=busy||!!draft||!!review||!!credential
 return <section className="panel processing-camera-alerts">
  <h2>Facility cameras & movement alerts</h2><p>Flag movement in a configured zone for human review. Pixel changes do not establish a person’s identity, theft or wrongdoing. Snapshots show the whole camera frame, even when detection uses a smaller zone. This first gateway provides a small snapshot, not a live-video player or emergency notification service.</p>
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  <div className="processing-actions"><button className="primary-btn" disabled={blocked||!loaded} onClick={()=>edit(null)}>Add camera rule</button><button className="outline-btn" disabled={blocked} onClick={()=>read()}>Refresh camera alerts</button></div>
  {!loaded&&<p>Camera records have not loaded yet.</p>}
  {loaded&&<p>{cameras.length} camera rules and {alerts.length} alerts loaded. Use Load more for older records. The queue refreshes every 20 seconds while visible and no form or credential is open.</p>}
  {loaded&&!cameras.length&&<p>No camera rule. Add the monitored zone and permitted hours, then connect the gateway.</p>}
  {!draft&&<div className="processing-cards">{cameras.map(camera=><article className="processing-card" key={camera.id}><strong>{camera.name} · {camera.zone_name}</strong><span>{camera.enabled?'Rule enabled':'Rule paused'} · {camera.mode==='restricted_zone'?'Movement in zone at any time':'Movement outside '+time(camera.allowed_start)+'–'+time(camera.allowed_end)} · {camera.timezone}</span><span>Last movement received: {camera.last_seen_at||'No movement event received'}</span><button className="outline-btn" disabled={blocked} onClick={()=>edit(camera)}>Configure camera</button><button className="outline-btn" disabled={blocked} onClick={()=>key(camera,'issue_key')}>Issue / rotate gateway credential</button><button className="outline-btn" disabled={blocked} onClick={()=>key(camera,'revoke_key')}>Revoke gateway credential</button></article>)}</div>}
  {cameraMore&&<button className="outline-btn" disabled={blocked} onClick={()=>read(cameras.length,0,'cameras')}>Load more camera rules</button>}
  {draft&&<form className="processing-form camera-rule-form" onSubmit={save}><h3>{editing?'Configure camera':'New camera rule'}</h3>
   {[['name','Camera name'],['zone_name','Monitored zone name'],['timezone','Timezone']].map(([k,label])=><label key={k}>{label}<input required maxLength={100} value={draft[k]} onChange={e=>{const value=e.target.value;setDraft(current=>({...current,[k]:value}))}}/></label>)}
   <label>Movement rule<select value={draft.mode} onChange={e=>{const value=e.target.value;setDraft(current=>({...current,mode:value}))}}><option value="outside_hours">Movement outside permitted hours</option><option value="restricted_zone">Movement in restricted zone at any time</option></select></label>
   {['allowed_start','allowed_end'].map(k=><label key={k}>{k==='allowed_start'?'Permitted start time':'Permitted end time'}<input type="time" required value={draft[k]} onChange={e=>{const value=e.target.value;setDraft(current=>({...current,[k]:value}))}}/></label>)}
   <p>Hours apply daily in the selected timezone. End before start means an overnight permitted interval. Zone coordinates are fractions of the frame: top-left (0,0), bottom-right (1,1). Calibrate against the actual camera view.</p>
   {[['zone_x','Zone left'],['zone_y','Zone top'],['zone_width','Zone width'],['zone_height','Zone height']].map(([k,label])=><label key={k}>{label}<input type="number" min="0" max="1" step="0.01" required value={draft[k]} onChange={e=>{const value=e.target.value;setDraft(current=>({...current,[k]:value}))}}/></label>)}
   <label><input type="checkbox" checked={draft.enabled} onChange={e=>{const enabled=e.target.checked;setDraft(current=>({...current,enabled}))}}/>Enable this movement rule</label>
   <div className="processing-actions"><button className="primary-btn" disabled={busy}>Save camera rule</button><button type="button" className="outline-btn" disabled={busy} onClick={()=>{setDraft(null);setEditing(null)}}>Discard camera draft</button></div>
  </form>}
  {credential&&<div><h3>Gateway credential — shown once</h3><p>Camera ID: {credential.camera_id}. Expires: {credential.expires_at}. Keep this on the local gateway; never paste camera passwords into Stratum.</p><label>Gateway token<textarea readOnly value={credential.token}/></label><button className="outline-btn" onClick={()=>setCredential(null)}>Hide credential</button></div>}
  <h3>Movement review queue</h3>
  {loaded&&!alerts.length&&<p>No movement alerts recorded. This does not establish that no movement occurred; the camera and gateway must be connected and calibrated.</p>}
  <div className="processing-cards">{alerts.map(row=><button type="button" className="processing-card" disabled={blocked} key={row.id} onClick={()=>openAlert(row)}><strong>{row.status==='needs_review'?'Activity needs review':row.status==='follow_up'?'Follow-up recorded':'Expected activity recorded'}</strong><span>{row.camera_name} · {row.zone_name}</span><span>{new Date(row.occurred_at).toLocaleString()} · {row.rule_mode==='outside_hours'?'Outside permitted hours':'Restricted-zone movement'}</span><span>Review snapshot and record a reason →</span></button>)}</div>
  {alertMore&&<button className="outline-btn" disabled={blocked} onClick={()=>read(0,alerts.length,'alerts')}>Load more movement alerts</button>}
  {review&&<form className="processing-form camera-review-form" onSubmit={saveReview}><h3>{review.camera_name} · {review.zone_name}</h3><p>Rule revision {review.rule_revision}; motion change {(Number(review.motion_ratio)*100).toFixed(1)}%. Review the snapshot and facility context before drawing conclusions.</p>{snapshot&&<img src={'data:image/png;base64,'+snapshot} width="320" height="180" style={{maxWidth:'100%',height:'auto'}} alt="Small grayscale snapshot supplied by the camera gateway"/>}{review.review_note&&<p>Previous review: {review.review_note}</p>}<label>Review decision<select value={decision} onChange={e=>setDecision(e.target.value)}><option value="expected_activity">Expected activity</option><option value="follow_up">Needs follow-up</option></select></label><label>Review reason<textarea required maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label><div className="processing-actions"><button className="primary-btn" disabled={busy}>Save alert review</button><button type="button" className="outline-btn" disabled={busy} onClick={()=>{setReview(null);setSnapshot(null)}}>Close alert review</button></div></form>}
 </section>
}


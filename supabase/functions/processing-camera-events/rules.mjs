export function cameraRulePayload(draft) {
 const name=String(draft.name||'').trim(),zone_name=String(draft.zone_name||'').trim(),timezone=String(draft.timezone||'Africa/Lagos')
 if(!name || !zone_name || name.length>100 || zone_name.length>100)throw new Error('Enter a camera name and monitored zone (100 characters maximum).')
 try{new Intl.DateTimeFormat('en',{timeZone:timezone}).format()}catch{throw new Error('Choose a valid IANA timezone, such as Africa/Lagos.')}
 const mode=draft.mode||'outside_hours'
 if(!['outside_hours','restricted_zone'].includes(mode))throw new Error('Choose a movement rule.')
 const time=value=>{if(!/^\d{2}:\d{2}$/.test(value))throw new Error('Enter permitted start and end times.');const [h,m]=value.split(':').map(Number);if(h>23||m>59)throw new Error('Enter valid permitted times.');return h*60+m}
 const allowed_start=time(draft.allowed_start||'08:00'),allowed_end=time(draft.allowed_end||'18:00')
 if(allowed_start===allowed_end)throw new Error('Start and end must differ. Use the restricted-zone rule for all-day monitoring.')
 const region={}
 for(const key of ['zone_x','zone_y','zone_width','zone_height']){
  const v=Number(draft[key]);if(!Number.isFinite(v)||v<0||v>1||(['zone_width','zone_height'].includes(key)&&v===0))throw new Error('Zone coordinates must be between 0 and 1, with positive width and height.')
  region[key]=v
 }
 if(region.zone_x+region.zone_width>1.000001||region.zone_y+region.zone_height>1.000001)throw new Error('The zone must fit inside the camera frame.')
 return {name,zone_name,timezone,mode,allowed_start,allowed_end,...region,enabled:!!draft.enabled}
}
export function outsidePermittedHours(now,rule) {
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:rule.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now))
 const minute=Number(parts.find(p=>p.type==='hour').value)*60+Number(parts.find(p=>p.type==='minute').value)
 const inside=rule.allowed_start<rule.allowed_end ? minute>=rule.allowed_start&&minute<rule.allowed_end : minute>=rule.allowed_start||minute<rule.allowed_end
 return !inside
}
export function motionRatio(previous,current,width,height,zone,delta=30) {
 if(previous.length!==width*height||current.length!==width*height)throw new Error('Unexpected frame dimensions.')
 const x0=Math.floor(zone.zone_x*width),y0=Math.floor(zone.zone_y*height)
 const x1=Math.min(width,Math.ceil((zone.zone_x+zone.zone_width)*width)),y1=Math.min(height,Math.ceil((zone.zone_y+zone.zone_height)*height))
 let changed=0,total=0
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=y*width+x;total++;if(Math.abs(current[i]-previous[i])>=delta)changed++}
 return total?changed/total:0
}
export class MotionGate {
 constructor({minimumRatio=.05,requiredFrames=3,cooldownMs=60000}={}){this.minimumRatio=minimumRatio;this.requiredFrames=requiredFrames;this.cooldownMs=cooldownMs;this.hits=0;this.lastAlert=-Infinity}
 observe(ratio,time){
  this.hits=ratio>=this.minimumRatio?this.hits+1:0
  if(this.hits<this.requiredFrames||time-this.lastAlert<this.cooldownMs)return false
  this.hits=0;this.lastAlert=time;return true
 }
}
export function validateMotionEvent(body,now=Date.now()){
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
 if(!uuid.test(body.camera_id||'')||!/^\d{4}-\d{2}-\d{2}T/.test(body.occurred_at||'')||!uuid.test(body.event_id||''))throw new Error('Invalid movement event.')
 const occurred=Date.parse(body.occurred_at)
 if(!Number.isFinite(occurred)||Math.abs(occurred-now)>120000)throw new Error('Event time must be within two minutes of server time.')
 if(!Number.isInteger(body.rule_revision)||body.rule_revision<1||!Number.isFinite(body.motion_ratio)||body.motion_ratio<.05||body.motion_ratio>1)throw new Error('Invalid motion measurements.')
 if(typeof body.snapshot_png!=='string'||body.snapshot_png.length>120000||!/^[A-Za-z0-9+/]+={0,2}$/.test(body.snapshot_png))throw new Error('A bounded PNG snapshot is required.')
 const bytes=Uint8Array.from(atob(body.snapshot_png),c=>c.charCodeAt(0))
 if(bytes.length<33||![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)||String.fromCharCode(...bytes.slice(12,16))!=='IHDR')throw new Error('Invalid PNG snapshot.')
 const view=new DataView(bytes.buffer)
 if(view.getUint32(8)!==13||view.getUint32(16)!==160||view.getUint32(20)!==90||bytes[24]!==8||bytes[25]!==0)throw new Error('Snapshot must be 160 by 90 grayscale pixels.')
 let offset=8,hasData=false,finished=false
 while(offset+12<=bytes.length){
  const size=view.getUint32(offset),kind=String.fromCharCode(...bytes.slice(offset+4,offset+8))
  if(size>bytes.length-offset-12)throw new Error('Truncated PNG snapshot.')
  if(kind==='IDAT'&&size>0)hasData=true
  offset+=size+12
  if(kind==='IEND'){if(size!==0||offset!==bytes.length)throw new Error('Invalid PNG end.');finished=true;break}
 }
 if(!hasData||!finished)throw new Error('Incomplete PNG snapshot.')
 return {camera_id:body.camera_id,event_id:body.event_id,occurred_at:new Date(occurred).toISOString(),rule_revision:body.rule_revision,motion_ratio:body.motion_ratio,snapshot_png:body.snapshot_png}
}


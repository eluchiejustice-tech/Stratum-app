import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {JSDOM} from 'jsdom'
import React,{act,StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {Simulate} from 'react-dom/test-utils'
import {createRequire} from 'node:module'
import {snapshotPng} from './fixtures/camera-snapshot.mjs'
test('camera UI configures a private rule, handles gateway credentials, loads snapshots lazily and retains conflicting review',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test'})
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
 const cameras=[{id:'cam',workspace_id:'workspace',name:'Storage',zone_name:'Stockpile',mode:'restricted_zone',timezone:'Africa/Lagos',allowed_start:480,allowed_end:1080,zone_x:0,zone_y:0,zone_width:1,zone_height:1,enabled:true,revision:1}]
 const alerts=[{id:'alert',camera_id:'cam',workspace_id:'workspace',camera_name:'Storage',zone_name:'Stockpile',occurred_at:'2026-10-08T22:00:00Z',received_at:'2026-10-08T22:00:01Z',rule_mode:'restricted_zone',rule_revision:1,motion_ratio:.2,status:'needs_review',revision:1,snapshot_png:snapshotPng}]
 let conflict=false,fail=false
 const reads=[],writes=[]
 const client={functions:{invoke:async(_name,{body})=>({data:body.action==='issue_key'?{token:'a'.repeat(64),expires_at:'2027-01-01'}:{status:'revoked'}})},from(table){
  const rows=table==='processing_director_cameras'?cameras:alerts
  let selected='*',filters=[],mode='read',payload=null,single=false,start=0,end=24
  const q={select(fields='*'){selected=fields;return q},eq(k,v){filters.push([k,v]);return q},order(){return q},range(a,b){start=a;end=b;return q},insert(value){mode='insert';payload=value;return q},update(value){mode='update';payload=value;return q},single(){single=true;return q},maybeSingle(){single=true;return q},async abortSignal(signal){
   if(signal.aborted)return {error:{message:'aborted'}}
   if(mode==='read'){
    reads.push({table,selected})
    if(fail)return {error:{message:'offline'}}
    const found=rows.filter(row=>filters.every(([k,v])=>row[k]===v))
    const pick=row=>selected==='*'?{...row}:Object.fromEntries(selected.split(',').map(k=>[k,row[k]]))
    return {data:single?(found[0]?pick(found[0]):null):found.slice(start,end+1).map(pick),count:found.length}
   }
   writes.push({table,payload})
   if(mode==='insert'){const saved={...payload,id:'newcam',revision:1};rows.push(saved);return{data:saved}}
   if(conflict)return{data:null}
   const row=rows.find(row=>filters.every(([k,v])=>row[k]===v));if(!row)return{data:null}
   Object.assign(row,payload,{revision:row.revision+1});return{data:{...row}}
  }};return q
 }}
 const bundle=await build({entryPoints:[new URL('../src/ProcessingCameraAlerts.jsx',import.meta.url).pathname],bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',external:['react','react-dom']})
 const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports)
 const root=createRoot(document.getElementById('root')),flush=()=>new Promise(r=>setTimeout(r,5))
 const click=text=>act(async()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith(text));assert.ok(b,text);assert.equal(b.disabled,false,text);b.click();await flush()})
 const fill=(label,value)=>act(()=>{const l=[...document.querySelectorAll('label')].find(l=>l.childNodes[0]?.textContent===label),input=l.querySelector('input,textarea,select');input.value=value;Simulate.change(input)})
 try{
  await act(async()=>{root.render(React.createElement(StrictMode,null,React.createElement(module.exports.default,{client,workspaceId:'workspace'})));await flush()})
  assert.match(document.body.textContent,/Activity needs review/)
  assert.equal(reads.some(r=>r.selected==='snapshot_png'),false)
  await click('Add camera rule');await fill('Camera name','Receiving area');await fill('Monitored zone name','Intake bay')
  await act(()=>{const input=document.querySelector('input[type="checkbox"]');input.checked=true;Simulate.change(input)})
  await click('Save camera rule');assert.equal(cameras.length,2);assert.equal(cameras[1].allowed_start,480)
  await click('Issue / rotate gateway credential');assert.equal(document.querySelector('textarea[readonly]').value,'a'.repeat(64))
  await click('Hide credential');assert.equal(document.querySelector('textarea[readonly]'),null)
  await click('Activity needs review');assert.equal(reads.some(r=>r.selected==='snapshot_png'),true);assert.match(document.querySelector('img').src,/^data:image\/png;base64,/)
  await fill('Review reason','Expected delivery checked by director');await click('Save alert review')
  assert.equal(alerts[0].status,'expected_activity');assert.deepEqual(Object.keys(writes.at(-1).payload).sort(),['review_note','status'])
  await click('Expected activity recorded');await fill('Review reason','Follow-up draft');conflict=true;await click('Save alert review')
  assert.match(document.body.textContent,/Review save was not confirmed/);assert.equal(document.querySelector('.camera-review-form textarea').value,'Follow-up draft')
  await click('Close alert review');fail=true;await click('Refresh camera alerts')
  assert.match(document.body.textContent,/Could not load camera rules/);assert.match(document.body.textContent,/Expected activity recorded/)
 }finally{await act(()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT}
})


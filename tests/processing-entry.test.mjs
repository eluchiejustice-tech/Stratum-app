import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {JSDOM} from 'jsdom'
import React,{act,StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {createRequire} from 'node:module'

test('mill entry waits for authentication, requires sign-in and resets workspace on account change',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://stratum.example/?view=processing-director'})
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true
 globalThis.entrySession={loading:true,user:null,profile:null};globalThis.entryMounts=[]
 const stubs={
  'context/AuthContext.jsx':'export function useAuthContext(){return globalThis.entrySession}',
  'services/supabaseClient.js':'export const supabase={}',
  'components/LoginForm.jsx':'import React from "react";export default function Login(){return <p>Stratum sign-in form</p>}',
  'ProcessingDirector.jsx':'import React,{useEffect,useState} from "react";export default function Director({userId,user}){const [original]=useState(userId);useEffect(()=>{globalThis.entryMounts.push(userId)},[]);return <p>Workspace {userId}; original {original}; name {user.user_metadata.full_name||"unknown"}</p>}'
 }
 const bundle=await build({entryPoints:[new URL('../src/pages/ProcessingDirectorPage.jsx',import.meta.url).pathname],bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',external:['react','react-dom'],plugins:[{name:'entry-boundaries',setup(b){
  b.onResolve({filter:/AuthContext\.jsx$|supabaseClient\.js$|LoginForm\.jsx$|ProcessingDirector\.jsx$/},args=>{const key=Object.keys(stubs).find(k=>args.path.endsWith(k));return key?{path:key,namespace:'stub'}:undefined})
  b.onLoad({filter:/.*/,namespace:'stub'},args=>({contents:stubs[args.path],loader:'jsx'}))
 }}]})
 const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports)
 const root=createRoot(document.getElementById('root'));const render=()=>act(async()=>{root.render(React.createElement(StrictMode,null,React.createElement(module.exports.default,{onBack(){}})));await new Promise(r=>setTimeout(r,5))})
 try{
  await render();assert.match(document.body.textContent,/Checking your Stratum session/);assert.equal(globalThis.entryMounts.length,0)
  globalThis.entrySession.loading=false;await render();assert.match(document.body.textContent,/Sign in to create/);assert.equal(globalThis.entryMounts.length,0)
  await act(async()=>{[...document.querySelectorAll('button')].find(b=>b.textContent==='Sign in to Stratum').click()});assert.match(document.body.textContent,/Stratum sign-in form/)
  globalThis.entrySession={loading:false,user:{id:'owner-a',user_metadata:{full_name:'Owner A'}},profile:{id:'owner-a',name:'Director A'}};await render();assert.match(document.body.textContent,/Workspace owner-a; original owner-a; name Director A/)
  globalThis.entrySession={loading:false,user:{id:'owner-b',user_metadata:{full_name:'Owner B'}},profile:{id:'owner-a',name:'Director A'}};await render();assert.match(document.body.textContent,/Workspace owner-b; original owner-b; name Owner B/);assert.doesNotMatch(document.body.textContent,/Director A/)
  globalThis.entrySession={loading:false,user:null,profile:null};await render();assert.doesNotMatch(document.body.textContent,/Workspace owner-/)
 }finally{await act(()=>root.unmount());dom.window.close();for(const k of ['window','document','IS_REACT_ACT_ENVIRONMENT','entrySession','entryMounts'])delete globalThis[k]}
})

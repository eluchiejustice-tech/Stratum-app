import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {cameraRulePayload,outsidePermittedHours,motionRatio,MotionGate,validateMotionEvent} from '../src/processingCameraRules.js'
import {pngFrame,rawFrameReader} from '../tools/processing-camera-gateway.mjs'
const rule={name:'Storage',zone_name:'Stockpile',timezone:'Africa/Lagos',allowed_start:'08:00',allowed_end:'18:00',zone_x:0,zone_y:0,zone_width:.5,zone_height:1,mode:'outside_hours',enabled:true}
test('camera rules validate timezone, hours and frame region',()=>{
 assert.equal(cameraRulePayload(rule).allowed_start,480)
 for(const patch of [{timezone:'Not/a_zone'},{allowed_start:'25:00'},{allowed_end:'08:00'},{zone_width:0},{zone_x:.8},{mode:'crime_prediction'}])assert.throws(()=>cameraRulePayload({...rule,...patch}))
})
test('after-hours boundaries use facility timezone',()=>{
 const saved=cameraRulePayload(rule)
 assert.equal(outsidePermittedHours('2026-10-08T07:00:00Z',saved),false)
 assert.equal(outsidePermittedHours('2026-10-08T17:00:00Z',saved),true)
 assert.equal(outsidePermittedHours('2026-10-08T06:59:00Z',saved),true)
})
test('overnight permitted hours cross midnight correctly',()=>{
 const saved=cameraRulePayload({...rule,allowed_start:'22:00',allowed_end:'06:00'})
 assert.equal(outsidePermittedHours('2026-10-08T22:00:00Z',saved),false)
 assert.equal(outsidePermittedHours('2026-10-09T04:00:00Z',saved),false)
 assert.equal(outsidePermittedHours('2026-10-09T05:00:00Z',saved),true)
})
test('motion measurement ignores changes outside the monitored region',()=>{
 const before=new Uint8Array(16),outside=Uint8Array.from([0,0,255,255,0,0,255,255,0,0,255,255,0,0,255,255])
 assert.equal(motionRatio(before,outside,4,4,rule),0)
 const inside=new Uint8Array(16).fill(255)
 assert.equal(motionRatio(before,inside,4,4,rule),1)
})
test('isolated motion does not alert; sustained changes and cooldown gate alerts',()=>{
 const gate=new MotionGate()
 assert.equal(gate.observe(.5,0),false);assert.equal(gate.observe(0,1000),false)
 assert.equal(gate.observe(.5,2000),false);assert.equal(gate.observe(.5,3000),false);assert.equal(gate.observe(.5,4000),true)
 for(let i=0;i<4;i++)assert.equal(gate.observe(.5,5000+i*1000),false)
 assert.equal(gate.observe(.5,65000),true)
})
test('raw stream chunks form exact frames without dropping boundary bytes',()=>{
 const frames=[],reader=rawFrameReader(f=>frames.push(f))
 reader(Buffer.alloc(10000,1));reader(Buffer.alloc(18800,2))
 assert.equal(frames.length,2);assert.equal(frames[0].length,14400);assert.equal(frames[0][0],1);assert.equal(frames[0][14399],2);assert.equal(frames[1][0],2)
})
test('FFmpeg snapshot is bounded PNG accepted by event validation',{skip:spawnSync('ffmpeg',['-version']).status!==0},async()=>{
 const snapshot_png=await pngFrame(Buffer.alloc(14400,100))
 const body={camera_id:'11111111-1111-1111-1111-111111111111',event_id:'22222222-2222-2222-2222-222222222222',occurred_at:new Date().toISOString(),rule_revision:1,motion_ratio:.2,snapshot_png}
 assert.equal(validateMotionEvent(body).motion_ratio,.2)
 for(const patch of [{snapshot_png:'not an image'},{occurred_at:'2020-01-01T00:00:00Z'},{motion_ratio:.01},{rule_revision:0},{snapshot_png:'A'.repeat(120001)}])assert.throws(()=>validateMotionEvent({...body,...patch}))
})


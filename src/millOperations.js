export const millRoles = {director:'Director',receiving:'Receiving officer',manager:'Mill manager',production:'Production manager',supervisor:'Production supervisor',laboratory:'Laboratory staff',dispatch:'Dispatch officer'}
export const millStates = {received:'Awaiting manager',approved:'Ready for production',processing:'Processing now',processed:'Awaiting supervisor',completed:'Ready for dispatch',dispatched:'Dispatched',rejected:'Not accepted'}
export const millActions = {
 receive:{label:'Receive material',roles:['director','receiving','manager']},
 approve:{label:'Approve intake',roles:['director','manager'],state:'received'},
 reject:{label:'Do not accept intake',roles:['director','manager'],state:'received'},
 start:{label:'Start production',roles:['director','production'],state:'approved'},
 finish:{label:'Submit production output',roles:['director','production'],state:'processing'},
 verify:{label:'Submit supervisor check',roles:['director','supervisor'],state:'processed'},
 dispatch:{label:'Record dispatch',roles:['director','dispatch'],state:'completed'},
 supplier_update:{label:'Edit supplier details',roles:['director','manager','receiving']},
 note:{label:'Record update / issue',roles:Object.keys(millRoles)},
 record_update:{label:'Batch record updated',roles:[]}
}
export function allowedMillActions(role,batch) {return Object.entries(millActions).filter(([key,a])=>key!=='receive' && a.roles.includes(role) && (!a.state||a.state===batch.workflow_status)).map(([key])=>key)}
export function millQuantity(batch) {return [batch.bag_count!=null?`${batch.bag_count} bags`:null,batch.received_weight_kg!=null?`${batch.received_weight_kg} kg measured`:null].filter(Boolean).join(' · ')||'Quantity not recorded'}
export function millRecordText(workspace,batch,events) {
 return ['STRATUM MILL OPERATIONS — WORKING RECORD',workspace.name,'Batch: '+batch.batch_code,'Material: '+batch.claimed_mineral,'Supplier: '+(batch.supplier||'Not recorded'),'Origin: '+(batch.origin||'Not recorded'),'Received: '+millQuantity(batch),'Current stage: '+millStates[batch.workflow_status],'',...events.slice().reverse().flatMap(e=>[`${e.recorded_at} · ${e.actor_name} · ${millRoles[e.actor_role]||e.actor_role}`,`${millActions[e.action]?.label||e.action} · revision ${e.revision}`,e.snapshot?.processing_notes||e.snapshot?.intake_notes||'No additional notes','']),'Staff submissions are operational records. Material identity, assays, product quality and mill licensing are not independently certified. Bags are not converted to weight.'].join('\n')
}


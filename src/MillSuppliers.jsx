import {useCallback,useEffect,useRef,useState} from 'react'
import {readWorkspaceSnapshot} from './workspaceReads.js'
import {millQuantity} from './millOperations.js'

export default function MillSuppliers({client,workspaceId,role,version,onEdit,onOpenBatch,disabled}) {
 const [rows,setRows]=useState([]),[total,setTotal]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[search,setSearch]=useState('')
 const request=useRef(null),alive=useRef(false)
 const load=useCallback(async(offset=0)=>{
  request.current?.abort();const c=new AbortController();request.current=c;setLoading(true);setError('')
  try {const {page}=await readWorkspaceSnapshot({page:client.rpc('mill_suppliers',{p_workspace:workspaceId,p_offset:offset,p_limit:50,p_batch:null})},{signal:c.signal});if(!Array.isArray(page?.items)||!Number.isInteger(page.total))throw Error('Invalid supplier response');if(alive.current&&!c.signal.aborted){setRows(old=>offset?[...old,...page.items.filter(x=>!old.some(y=>y.batch_id===x.batch_id))]:page.items);setTotal(page.total)}}
  catch {if(alive.current&&!c.signal.aborted){setRows([]);setTotal(null);setError('Could not confirm supplier details. Refresh when connected.')}}
  finally {if(alive.current&&request.current===c)setLoading(false)}
 },[client,workspaceId])
 useEffect(()=>{alive.current=true;load();return()=>{alive.current=false;request.current?.abort()}},[load,version,role])
 const matches=rows.filter(r=>!search||[r.supplier,r.phone,r.material,r.origin,r.batch_code].some(v=>v?.toLowerCase().includes(search.toLowerCase())))
 return <section className="panel" aria-labelledby="mill-suppliers-title"><div className="processing-heading"><h2 id="mill-suppliers-title">Suppliers & supplies</h2><button disabled={loading} onClick={()=>load()}>Refresh suppliers</button></div><p>Each receipt keeps its supplier, material, quantity and contact details together.</p><label>Find in loaded suppliers<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, phone, material or batch"/></label><p>{rows.length} receipts loaded{total!==null?' of '+total:'. Total unavailable'}.</p>{error&&<p role="alert">{error}</p>}{loading&&<p role="status">Loading supplier records…</p>}<div className="processing-cards">{matches.map(r=><article className="processing-card mill-supplier-card" key={r.batch_id}><h3>{r.supplier||'Supplier not recorded'}</h3><p>{r.material} · {millQuantity(r)}</p><p>{r.origin||'Origin not recorded'} · {r.batch_code} · {r.received_on}</p><p>Phone: {r.phone||'Not recorded'}</p>{r.account_details&&<details><summary>Bank account details</summary><dl><dt>Bank</dt><dd>{r.account_details.bank_name||'Not recorded'}</dd><dt>Account name</dt><dd>{r.account_details.account_name||'Not recorded'}</dd><dt>Account number</dt><dd>{r.account_details.account_number||'Not recorded'}</dd></dl><p>Recorded details; no transfer has been made.</p></details>}<div className="processing-actions"><button disabled={disabled} onClick={()=>onOpenBatch(r.batch_id)}>Open supply record</button>{['director','manager','receiving'].includes(role)&&<button disabled={disabled} onClick={()=>onEdit(r)}>Edit supplier details</button>}</div></article>)}</div>{!loading&&!matches.length&&<p>No supplier records in this view. Use Receive material to record a supply.</p>}{total!==null&&rows.length<total&&<button disabled={loading} onClick={()=>load(rows.length)}>Load older supplies</button>}</section>
}


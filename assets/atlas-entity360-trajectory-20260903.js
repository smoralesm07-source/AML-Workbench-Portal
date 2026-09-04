'use strict';
/* ATLAS AML · Entidad 360 · trayectoria tributaria histórica · 2026-09-03 */
(function atlasEntity360Trajectory20260903(){
  const BUILD='20260903-e360-trajectory1',TABLE='aml_sii_entity_year',TTL=5*60*1000;
  const BASE=typeof window.v0203RenderEntity==='function'?window.v0203RenderEntity:null;
  const CACHE=new Map(),INFLIGHT=new Map();
  if(!BASE){window.__ATLAS_ENTITY360_TRAJECTORY__={active:false,build:BUILD,reason:'renderer-unavailable'};return;}
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>num(v)==null?'—':Number(v).toLocaleString('es-CL',{maximumFractionDigits:0});
  const db=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const selected=()=>{try{return (typeof state!=='undefined'?state:(window.state||null))?.selectedEntity||null;}catch(_e){return null;}};
  function chart(rows){
    const data=(rows||[]).filter(r=>num(r.commercial_year)!=null).sort((a,b)=>num(a.commercial_year)-num(b.commercial_year));if(data.length<2)return'';
    const W=560,H=154,pl=28,pr=24,pt=18,pb=30,iw=W-pl-pr,ih=H-pt-pb,years=data.map(r=>num(r.commercial_year)),min=Math.min(...years),max=Math.max(...years),span=Math.max(1,max-min),rankMax=Math.max(13,...data.map(r=>num(r.sales_band_rank)||0)),workersMax=Math.max(1,...data.map(r=>num(r.workers_numeric)||0));
    const x=y=>pl+(y-min)/span*iw,yr=v=>pt+ih-(Math.max(0,v)/rankMax)*ih,yw=v=>pt+ih-(Math.max(0,v)/workersMax)*ih;
    const sales=data.map(r=>`${x(num(r.commercial_year)).toFixed(1)},${yr(num(r.sales_band_rank)||0).toFixed(1)}`).join(' '),workers=data.map(r=>`${x(num(r.commercial_year)).toFixed(1)},${yw(num(r.workers_numeric)||0).toFixed(1)}`).join(' '),events=data.filter(r=>r.region_changed===true||r.main_activity_changed===true);
    return `<div class="e360-chart" data-e360-history="1"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Trayectoria histórica del tramo de ventas y trabajadores">${[0,.5,1].map(f=>`<line class="grid" x1="${pl}" y1="${(pt+ih*f).toFixed(1)}" x2="${W-pr}" y2="${(pt+ih*f).toFixed(1)}"></line>`).join('')}${events.map(r=>`<line class="event-line" x1="${x(num(r.commercial_year)).toFixed(1)}" y1="${pt}" x2="${x(num(r.commercial_year)).toFixed(1)}" y2="${pt+ih}"><title>${esc(r.commercial_year)} · ${r.region_changed?'cambio de región':''}${r.region_changed&&r.main_activity_changed?' · ':''}${r.main_activity_changed?'cambio de actividad principal':''}</title></line>`).join('')}<polyline class="sales" points="${sales}"></polyline><polyline class="workers" points="${workers}"></polyline>${data.map(r=>`<circle class="sales-dot" cx="${x(num(r.commercial_year)).toFixed(1)}" cy="${yr(num(r.sales_band_rank)||0).toFixed(1)}" r="3"><title>${esc(r.commercial_year)} · tramo ${esc(r.sales_band_code||r.sales_band_rank||'—')}</title></circle>`).join('')}${data.map(r=>`<circle class="workers-dot" cx="${x(num(r.commercial_year)).toFixed(1)}" cy="${yw(num(r.workers_numeric)||0).toFixed(1)}" r="3"><title>${esc(r.commercial_year)} · ${fmt(r.workers_numeric)} trabajador(es)</title></circle>`).join('')}${data.map(r=>`<text x="${x(num(r.commercial_year)).toFixed(1)}" y="${H-10}" text-anchor="middle">${esc(r.commercial_year)}</text>`).join('')}</svg><div class="e360-chart-legend"><span class="sales">tramo de ventas</span><span class="workers">trabajadores</span>${events.length?'<span class="events">cambio declarado</span>':''}<small>Escalas independientes; no implican causalidad.</small></div></div>`;
  }
  async function fetchRows(id){const client=db();if(!client||!id)return[];const {data,error}=await client.from(TABLE).select('commercial_year,sales_band_code,sales_band_rank,workers_numeric,region,region_changed,main_activity,main_activity_changed').eq('entity_id',id).order('commercial_year',{ascending:true}).limit(12);if(error)throw error;return Array.isArray(data)?data:[];}
  function load(id){const hit=CACHE.get(id);if(hit&&Date.now()-hit.at<TTL)return Promise.resolve(hit.rows);if(INFLIGHT.has(id))return INFLIGHT.get(id);const job=fetchRows(id).then(rows=>{CACHE.set(id,{rows,at:Date.now()});return rows;}).catch(()=>[]).finally(()=>INFLIGHT.delete(id));INFLIGHT.set(id,job);return job;}
  function enhance(pkg){const id=pkg?.e?.entity_id;if(!id)return;void load(id).then(rows=>{if(selected()!==id)return;const html=chart(rows);if(!html)return;const tax=document.querySelector('#atlas-entity360-executive #e360-tax');if(!tax)return;const old=tax.querySelector('.e360-chart,.e360-chart-empty');if(old)old.outerHTML=html;else tax.insertAdjacentHTML('beforeend',html);});}
  function render(pkg,...args){const out=BASE(pkg,...args);try{enhance(pkg);}catch(_e){}return out;}
  try{v0203RenderEntity=render;}catch(_e){}window.v0203RenderEntity=render;
  window.__ATLAS_ENTITY360_TRAJECTORY__={active:true,build:BUILD,table:TABLE,cachePolicy:'MEMORY_ONLY',scoreMutation:false,authMutation:false,installedAt:new Date().toISOString()};
})();

'use strict';
(function sanctionsIntelligenceLayer(){
 const fmt=n=>new Intl.NumberFormat('es-CL',{maximumFractionDigits:0}).format(Number(n)||0);
 const pct=n=>`${(Number(n)||0).toLocaleString('es-CL',{maximumFractionDigits:1})}%`;
 const clamp=n=>Math.max(0,Math.min(100,Number(n)||0));
 function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
 function visible(){try{return typeof window.v034View==='function'?window.v034View():null}catch(_){return null}}
 function spark(values,w=150,h=30){const a=values.map(Number);const max=Math.max(1,...a),min=Math.min(0,...a),range=Math.max(1,max-min);const pts=a.map((v,i)=>`${(i/(Math.max(1,a.length-1)))*(w-6)+3},${h-3-((v-min)/range)*(h-7)}`).join(' ');const last=pts.split(' ').pop()?.split(',')||[w-3,h-3];return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline class="spark" points="${pts}"/><circle class="sparkdot" cx="${last[0]}" cy="${last[1]}" r="2.2"/></svg>`}
 function gauge(value){const x=4+(clamp(value)/100)*92;return `<svg viewBox="0 0 100 18" preserveAspectRatio="none" aria-hidden="true"><line class="track" x1="4" y1="9" x2="96" y2="9"/><line class="fill" x1="4" y1="9" x2="${x}" y2="9"/></svg>`}
 function compute(D){
   const events=D?.events||[],subjects=D?.subjects||[];
   const years=[...new Set(events.map(e=>Number(String(e.date||'').slice(0,4))).filter(Boolean))].sort((a,b)=>a-b);
   const yearly=years.map(y=>events.filter(e=>Number(String(e.date||'').slice(0,4))===y).length);
   const last=yearly.at(-1)||0,prev=yearly.at(-2)||0,delta=prev?((last-prev)/prev)*100:0;
   const bySup={};events.forEach(e=>{const k=e.regulator||'Sin supervisor';bySup[k]=(bySup[k]||0)+1});
   const supRank=Object.entries(bySup).sort((a,b)=>b[1]-a[1]),topSup=supRank[0]||['—',0],supShare=events.length?topSup[1]/events.length*100:0;
   const recurring=subjects.filter(s=>(s.events?.length||0)>=2).length,recShare=subjects.length?recurring/subjects.length*100:0;
   const threePlus=subjects.filter(s=>(s.events?.length||0)>=3).length;
   const ufEvents=events.filter(e=>Number(e.amountUF)>0),ufCoverage=events.length?ufEvents.length/events.length*100:0;
   const uf=ufEvents.reduce((a,e)=>a+(Number(e.amountUF)||0),0);
   const laft=events.filter(e=>e.laft).length,laftShare=events.length?laft/events.length*100:0;
   return {events,subjects,years,yearly,last,prev,delta,topSup,supShare,recurring,recShare,threePlus,ufCoverage,uf,laft,laftShare};
 }
 function interpretation(M){
   const trend=M.prev?`${M.delta>=0?'aumentan':'disminuyen'} ${pct(Math.abs(M.delta))} frente al período anual previo`:'no permiten calcular variación anual comparable';
   const concentration=M.events.length?`${esc(window.V034_SUPERVISOR_LABELS?.[M.topSup[0]]||M.topSup[0])} concentra ${pct(M.supShare)} de los eventos visibles`:'sin eventos para el filtro activo';
   const recurrence=M.subjects.length?`${pct(M.recShare)} de las entidades visibles presenta 2 o más eventos`:'sin entidades visibles';
   return `La lectura combinada muestra que los eventos ${trend}; ${concentration}; y ${recurrence}. Estos indicadores describen intensidad, concentración y recurrencia, sin constituir por sí solos una conclusión de riesgo.`;
 }
 function card(eye,value,unit,text,graphic,klass=''){return `<article class="sv12-intel-card ${klass}"><span class="eye">${eye}</span><div class="sv12-intel-value"><b>${value}</b><em>${unit}</em></div><p>${text}</p>${graphic}</article>`}
 function render(){
   const root=document.querySelector('.sv12');if(!root)return;
   const D=visible();if(!D)return;const M=compute(D);
   let host=document.getElementById('sv12-intel');
   if(!host){host=document.createElement('section');host.id='sv12-intel';host.className='sv12-intel';const k=document.getElementById('sv12-kpis');k?.insertAdjacentElement('afterend',host);}
   const trendText=M.prev?`${M.delta>=0?'+':''}${M.delta.toLocaleString('es-CL',{maximumFractionDigits:1})}%`:'s/comparación';
   host.innerHTML=`<article class="sv12-intel-lead"><span class="eye">Lectura ejecutiva · filtro activo</span><h3>Patrón sancionatorio: intensidad, concentración y recurrencia</h3><p>${interpretation(M)}</p><div class="sv12-intel-chips"><span>${fmt(M.events.length)} eventos</span><span>${fmt(M.subjects.length)} entidades</span><span>${fmt(M.laft)} materia LA/FT</span><span>${fmt(M.uf)} UF publicadas</span></div></article>`+
     card('Momentum temporal',trendText,'último año',M.years.length?`Serie visible ${M.years[0]}–${M.years.at(-1)} · ${fmt(M.last)} eventos en el último año de la selección.`:'Sin serie temporal visible.',spark(M.yearly),'')+
     card('Concentración supervisor',pct(M.supShare),'top 1',`${esc(window.V034_SUPERVISOR_LABELS?.[M.topSup[0]]||M.topSup[0])}: ${fmt(M.topSup[1])} eventos del filtro activo.`,gauge(M.supShare),'warn')+
     card('Recurrencia entidades',pct(M.recShare),'2+ eventos',`${fmt(M.recurring)} entidades recurrentes; ${fmt(M.threePlus)} acumulan 3 o más eventos.`,gauge(M.recShare),'violet');
   host.title=`Cobertura de monto UF en la selección: ${pct(M.ufCoverage)} · Eventos con materia LA/FT directa: ${pct(M.laftShare)}.`;
 }
 function patch(){
   if(window.__atlasSanctionsIntelPatched)return;window.__atlasSanctionsIntelPatched=true;
   const original=window.v034Render;
   if(typeof original==='function')window.v034Render=function(){const r=original.apply(this,arguments);queueMicrotask(render);return r};
   const observer=new MutationObserver(()=>{clearTimeout(window.__sv12IntelTimer);window.__sv12IntelTimer=setTimeout(render,30)});
   const app=document.getElementById('app')||document.body;observer.observe(app,{childList:true,subtree:true});
   render();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patch,{once:true});else patch();
})();

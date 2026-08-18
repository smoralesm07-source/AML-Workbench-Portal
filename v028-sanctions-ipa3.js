'use strict';

/* v0.28.0 · sanction surfaces use governed identity resolution so IPA3 can be
 * attached to CMF/UAF/SCJ events whenever a conservative entity match exists. */
const V028_SANCTIONS_VIEW='aml_v028_sanctions_with_identity';

if(typeof v16SanctionCards==='function'){
  const v028BaseSanctionCards=v16SanctionCards;
  v16SanctionCards=function(rows,canonicalName=null){
    let i=0;
    const html=v028BaseSanctionCards(rows,canonicalName);
    return html.replaceAll('<article class="explain-card sanction-card">',()=>{
      const row=(rows||[])[i++]||{},id=String(row.entity_id||'');
      return id?`<article data-v028-entity-root="${esc(id)}" class="explain-card sanction-card">`:'<article class="explain-card sanction-card">';
    });
  };
}

if(typeof loadSanctions==='function'){
  loadSanctions=async function(){
    state.view='sanctions';
    shell('Sanciones','Eventos administrativos con identidad gobernada cuando existe; IPA 3.0 se muestra como prioridad de entidad, no como interpretación del evento.');
    try{
      const [rowsRes,sanctionTrend]=await Promise.all([
        sb.from(V028_SANCTIONS_VIEW).select('sanction_id,event_date,regulator,entity_name,entity_id,identity_status,resolution_method,identity_confidence,laft_direct,amount_uf,subject,snapshot_id,updated_at,payload',{count:'exact'}).order('event_date',{ascending:false,nullsFirst:false}).limit(500),
        v17FiveYearSanctionCounts()
      ]);
      if(rowsRes.error)throw rowsRes.error;
      const rows=rowsRes.data||[];
      content().innerHTML=`<div class="workbench-toolbar"><div><h2>Eventos sancionatorios</h2><p>Mostrando ${fmtNum(rows.length)} de ${fmtNum(rowsRes.count||0)} eventos. La identidad reconciliada permite mostrar IPA3 cuando existe una vinculación gobernada.</p></div></div>
        ${v17BarChart('Sanciones · últimos 5 años',sanctionTrend,'<p>Conteo por año de eventos visibles. Actividad administrativa no equivale a riesgo LA/FT.</p>')}
        <section class="panel gap-top"><div class="panel-head"><h2>Detalle</h2><span>${fmtNum(rows.length)} eventos cargados</span></div><div class="panel-body">${v16SanctionCards(rows)}</div></section>`;
      window.AML_IPA3?.scan?.(document);
    }catch(e){showContentError(e);}
  };
}

if(typeof v024OpenSanctionYear==='function'){
  v024OpenSanctionYear=async function(year){
    const start=`${year}-01-01`,end=`${year}-12-31`;
    const {data,error}=await sb.from(V028_SANCTIONS_VIEW).select('sanction_id,event_date,regulator,entity_name,entity_id,identity_status,resolution_method,identity_confidence,laft_direct,amount_uf,subject').gte('event_date',start).lte('event_date',end).order('event_date',{ascending:false}).limit(500);
    if(error){v019OpenDrawer(`<div class="v019-error">${esc(error.message||String(error))}</div>`);return;}
    const rows=data||[],reg=new Map();for(const r of rows)reg.set(r.regulator||'Sin regulador',(reg.get(r.regulator||'Sin regulador')||0)+1);
    const regulators=[...reg.entries()].sort((a,b)=>b[1]-a[1]),direct=rows.filter(r=>r.laft_direct).length,resolved=rows.filter(r=>r.entity_id).length;
    v019OpenDrawer(`<div class="v024-drawer"><div class="ey">Sanciones · ${esc(String(year))}</div><h2>${v019Fmt(rows.length)} eventos materializados</h2><p class="lead">La entidad reconciliada muestra IPA3 cuando existe identidad gobernada; el score pertenece a la entidad y no califica la sanción individual.</p><div class="v024-drawer-kpis"><div><span>Eventos</span><b>${v019Fmt(rows.length)}</b></div><div><span>Entidades resueltas</span><b>${v019Fmt(resolved)}</b></div><div><span>Reguladores</span><b>${v019Fmt(regulators.length)}</b></div><div><span>Flag LA/FT</span><b>${v019Fmt(direct)}</b></div></div><div class="v024-regulators">${regulators.slice(0,8).map(([name,count])=>`<span><b>${esc(name)}</b>${v019Fmt(count)}</span>`).join('')}</div><div class="v024-drawer-actions"><button type="button" data-v024-open-sanctions>Abrir módulo Sanciones →</button></div><div class="v024-sanction-events">${rows.map(r=>`<article><div><span>${esc(r.event_date||'—')}</span><b>${esc(r.entity_name||'Entidad no resuelta')}</b><small>${esc(r.regulator||'—')} · ${esc(v019Truncate(r.subject||'Sin materia',96))}</small></div><div>${r.laft_direct?'<em>LA/FT</em>':''}${r.amount_uf!=null?`<span>${v019Fmt(r.amount_uf,1)} UF</span>`:''}${r.entity_id?`<button type="button" data-v024-sanction-entity="${esc(r.entity_id)}">360 →</button>`:''}</div></article>`).join('')}</div></div>`);
    window.AML_IPA3?.scan?.(document);
  };
}

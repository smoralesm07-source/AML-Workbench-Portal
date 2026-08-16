'use strict';

/* CSP-safe renderer override: no inline styles or event handlers. */
v0191EconomicContext=function(core){
  const e=core.economy;if(!e||e.error)return `<div class="v019-empty">El Context Hub económico no está disponible en este corte.</div>`;
  const h=e.history_entities||{},y24=v019Num(h['2024']),y23=v019Num(h['2023']),y20=v019Num(h['2020']);
  const hist=Object.entries(h).sort((a,b)=>Number(a[0])-Number(b[0]));const max=Math.max(...hist.map(x=>v019Num(x[1])),1);
  const top=Object.entries(e.regions_2024_by_cut||{}).sort((a,b)=>v019Num(b[1])-v019Num(a[1])).slice(0,5);
  const names=Object.fromEntries(Object.entries(V0191_REGION_CODE).map(([k,v])=>[v,k]));
  return `<div class="v0191-econ-kpis"><div><span>Empresas-año 2024</span><b>${v019Fmt(e.company_year_rows_2024)}</b><small>corte SII materializado</small></div><div><span>Variación 2023→2024</span><b>${v0191DeltaPct(y24,y23)>=0?'+':''}${v019Fmt(v0191DeltaPct(y24,y23),1)}%</b><small>contexto económico</small></div><div><span>Variación 2020→2024</span><b>${v0191DeltaPct(y24,y20)>=0?'+':''}${v019Fmt(v0191DeltaPct(y24,y20),1)}%</b><small>cinco cortes anuales</small></div><div><span>Activas publicadas</span><b>${v019Fmt(e.kpis?.active_as_published)}</b><small>métrica nativa SII</small></div></div><div class="v0191-econ-body"><div class="v0191-history">${hist.map(([year,val])=>`<div class="v0191-hrow"><span>${esc(year)}</span><div class="v0191-htrack"><i class="${v019Width(val,max)}"></i></div><b>${v019Fmt(val)}</b></div>`).join('')}</div><div class="v0191-econ-top"><b>Concentración territorial 2024</b>${top.map(([code,val])=>`<div><span>${esc(v019RegionShort(names[code]||code))}</span><strong>${v019Fmt(v0191Pct(val,e.company_year_rows_2024),1)}%</strong></div>`).join('')}</div></div><div class="v019-note v0191-context-note"><b>Contexto económico, no señal AML:</b> este bloque ayuda a distinguir volumen económico de concentración de alertas. No infiere ventas exactas ni modifica scores de riesgo.</div>`;
};

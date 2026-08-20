'use strict';
/* ATLAS AML · UAF sector drawer refinement · analytical context, no rule cards. */
(function(){
  const fmt=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';};
  const pct=(v,d=1)=>{const n=Number(v);return Number.isFinite(n)?`${n>0?'+':''}${n.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d})}%`:'—';};
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function cagr(row){
    const a=Number(row?.ros_2021),b=Number(row?.ros_2025);
    if(!(a>0)||!(b>=0))return null;
    return (Math.pow(b/a,1/4)-1)*100;
  }
  async function enrichSanctions(name){
    const host=document.querySelector('#atlas-sector-sanctions');
    if(!host||typeof sb==='undefined')return;
    try{
      const [sectorRes,totalRes]=await Promise.all([
        sb.from('aml_v0434_uaf_sii_sector').select('sanctioned_entity_count').eq('sector_name',name).maybeSingle(),
        sb.from('aml_sanctions').select('sanction_id',{count:'exact',head:true}).eq('regulator','UAF').gte('event_date','2025-01-01').lt('event_date','2026-01-01')
      ]);
      const sectorCount=Number(sectorRes?.data?.sanctioned_entity_count);
      const totalCount=Number(totalRes?.count);
      host.innerHTML=`<b>${Number.isFinite(totalCount)?fmt(totalCount):'—'}</b><small>procesos/eventos UAF observados en 2025 · contexto supervisor${Number.isFinite(sectorCount)?`<br><strong>${fmt(sectorCount)}</strong> entidades del sector con sanción observada en la conciliación UAF–SII`: '<br>Sin desglose sectorial individualizable materializado.'}</small>`;
    }catch(_){
      host.innerHTML='<b>—</b><small>Contexto sancionatorio no disponible en este corte.</small>';
    }
  }
  window.v0193SectorDrawer=function atlasSectorDrawerRefined(name,core,uaf){
    const r=uaf.sectors.find(x=>x.sector_name===name);if(!r)return;
    const flags=v0193Flags(r,uaf);
    const pats=core.patterns.filter(p=>v0193SectorMatch(p.scope_label,name)&&v0193PatternIsUaf(p)).slice(0,6);
    const gap=core.gapSectors.find(g=>v0193SectorMatch(g.sector_name,name));
    const totalRos=Number(uaf?.report?.totals?.ros_2025)||0;
    const share=totalRos?100*Number(r.ros_2025||0)/totalRos:null;
    const annual=cagr(r);
    const roe=Number(uaf?.dashboard?.kpis?.roe_latest);
    const fines=Number(uaf?.dashboard?.kpis?.fines_uf_latest);
    const series=v0193Series(r);
    const peak=series.reduce((a,b)=>b.value>a.value?b:a,series[0]);
    const delta=Number(r.delta_ros_2025_vs_2024_pct);
    const reading=[
      Number.isFinite(delta)?`${pct(delta)} vs. 2024`:'sin base comparable 2024',
      Number.isFinite(annual)?`CAGR ${pct(annual)} anual`:'CAGR no calculable',
      Number.isFinite(share)?`${fmt(share,2)}% del flujo ROS 2025`:'participación no disponible'
    ].join(' · ');
    v019OpenDrawer(`<div class="v0193-sector-drawer atlas-sector-drawer"><span class="v0193-drawer-kicker">Inteligencia UAF · reportabilidad sectorial</span><h2>${safe(name)}</h2><div class="v0193-drawer-kpis"><div><span>SO inscritos 2025</span><b>${v019Fmt(r.registered_so_2025)}</b></div><div><span>ROS 2025</span><b>${v019Fmt(r.ros_2025)}</b></div><div><span>ROS / 100 SO</span><b>${v019Fmt(r.ros_per_100_so_2025,2)}</b></div><div><span>ROS 2021–2025</span><b>${v019Fmt(r.ros_total_2021_2025)}</b></div></div><div class="v0193-flags drawer-flags">${v0193FlagHtml(flags)}</div><section><h3>Serie ROS</h3><div class="v0193-year-grid">${series.map(x=>`<div class="${x.year===peak.year?'atlas-year-peak':''}"><span>${x.year}</span><b>${v019Fmt(x.value)}</b></div>`).join('')}</div><p class="v0193-delta atlas-sector-summary"><b>${peak.year} es el máximo de la serie.</b> ${safe(reading)}.</p></section><section><h3>Lectura sectorial</h3><div class="v0193-rule-grid atlas-sector-reading"><div><span>Crecimiento promedio anual</span><b>${Number.isFinite(annual)?pct(annual):'—'}</b><small>CAGR ROS 2021–2025. Se omite cuando la base 2021 es cero.</small></div><div><span>Participación ROS 2025</span><b>${Number.isFinite(share)?`${fmt(share,2)}%`:'—'}</b><small>${v019Fmt(r.ros_2025)} de ${v019Fmt(totalRos)} ROS del sistema.</small></div><div><span>ROE 2025 · contexto UAF</span><b>${Number.isFinite(roe)?fmt(roe):'—'}</b><small>Total anual UAF. No se atribuye al sector porque el desglose sectorial ROE no está materializado.</small></div><div id="atlas-sector-sanctions"><span>Sanciones · contexto supervisor</span><b>…</b><small>Consultando fuente gobernada.</small></div></div>${Number.isFinite(fines)?`<p class="atlas-sector-context-note">Multas UAF 2025: <b>${fmt(fines)} UF</b> en el contexto institucional general; no se atribuyen automáticamente a este sector.</p>`:''}</section>${gap?`<section><h3>Brecha de cobertura / screening</h3><p><b>${v019Fmt(gap.candidate_pairs)}</b> pares RUT–actividad candidatos agregados para este sector. No equivalen a personas jurídicas únicas ni demuestran falta de inscripción.</p></section>`:''}${pats.length?`<section><h3>Patrones UAF materializados</h3>${v019PatternList(pats,6)}</section>`:''}<div class="v019-note warn"><b>Guardrail:</b> ROS, ROE y sanciones tienen alcances distintos. Los totales UAF se muestran como contexto y no se atribuyen a un sector ni a un sujeto obligado cuando no existe desglose materializado. Una sanción tampoco acredita por sí sola LA/FT.</div></div>`);
    v019BindCommon(core);
    enrichSanctions(name);
  };
})();

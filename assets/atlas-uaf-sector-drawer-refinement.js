'use strict';
/* ATLAS AML · UAF sector drawer refinement · ROS-to-indicia analytical conversion. */
(function(){
  const YEARS=[2021,2022,2023,2024,2025];
  const SYSTEM_ROS={2021:9738,2022:11400,2023:12900,2024:17417,2025:21828};
  const SYSTEM_INDICIA={2021:514,2022:1132,2023:323,2024:1279,2025:1132};
  const INDICIA={
    'ADMINISTRADORAS DE FONDOS DE INVERSION':[0,0,0,1,0],
    'ADMINISTRADORAS GENERALES DE FONDOS':[2,12,10,10,16],
    'ADMINISTRADORAS DE FONDOS DE PENSIONES':[16,23,21,9,8],
    'AGENTES DE VALORES':[0,1,0,3,2],
    'BANCOS':[416,265,211,832,615],
    'BOLSAS DE PRODUCTOS':[0,0,0,1,0],
    'CAJAS DE COMPENSACION':[0,0,1,0,0],
    'CASAS DE CAMBIO':[7,6,6,12,6],
    'CASAS DE REMATE Y MARTILLO':[0,1,0,0,0],
    'CASINOS DE JUEGO':[7,694,0,105,12],
    'COMPANIAS DE SEGUROS':[5,5,1,6,0],
    'CONSERVADORES':[1,0,0,1,0],
    'COOPERATIVAS DE AHORRO Y CREDITO':[1,2,4,8,3],
    'CORREDORES DE BOLSAS DE VALORES':[18,18,15,43,30],
    'CORREDORES DE PROPIEDADES':[0,0,2,0,0],
    'EMISORAS U OPERADORAS DE TARJETAS DE CREDITO':[8,37,13,80,74],
    'EMPRESAS DE ARRENDAMIENTO FINANCIERO LEASING':[3,2,3,8,0],
    'EMPRESAS DE FACTORAJE FACTORING':[0,1,11,15,0],
    'EMPRESAS DE TRANSFERENCIA DE DINERO':[5,9,4,16,5],
    'EMPRESAS DEDICADAS A LA GESTION INMOBILIARIA':[0,1,1,1,0],
    'HIPODROMOS':[0,1,1,0,2],
    'INSTITUCIONES FINANCIERAS':[1,0,1,3,0],
    'INSTITUCIONES PUBLICAS':[12,24,12,20,17],
    'NOTARIOS':[0,2,1,1,0],
    'OTRAS ENTIDADES FACULTADAS PARA RECIBIR MONEDA EXTRANJERA':[10,27,5,104,327],
    'SOCIEDADES ADMINISTRADORAS DE ZONAS FRANCAS':[2,0,0,0,13],
    'USUARIOS DE ZONAS FRANCAS':[0,1,0,0,0],
    'VEHICULOS AUTOMOTORAS':[0,0,0,0,1],
    'VEHICULOS COMERCIALIZADORAS DE VEHICULOS NUEVOS O USADOS':[0,0,0,0,1]
  };
  const fmt=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';};
  const pct=(v,d=1,sign=false)=>{const n=Number(v);return Number.isFinite(n)?`${sign&&n>0?'+':''}${n.toLocaleString('es-CL',{minimumFractionDigits:d,maximumFractionDigits:d})}%`:'—';};
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/N[°º]/g,'N').replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();

  function cagr(row){
    const a=Number(row?.ros_2021),b=Number(row?.ros_2025);
    if(!(a>0)||!(b>=0))return null;
    return (Math.pow(b/a,1/4)-1)*100;
  }
  function indiciaSeries(name){
    const n=norm(name);
    if(INDICIA[n])return INDICIA[n];
    if(n.startsWith('EMISORAS U OPERADORAS DE TARJETAS DE CREDITO'))return INDICIA['EMISORAS U OPERADORAS DE TARJETAS DE CREDITO'];
    if(n.includes('ADMINISTRADOR')&&n.includes('FONDOS DE PENSIONES'))return INDICIA['ADMINISTRADORAS DE FONDOS DE PENSIONES'];
    if(n.includes('ARRENDAMIENTO FINANCIERO'))return INDICIA['EMPRESAS DE ARRENDAMIENTO FINANCIERO LEASING'];
    if(n.includes('FACTORAJE')||n.includes('FACTORING'))return INDICIA['EMPRESAS DE FACTORAJE FACTORING'];
    if(n.startsWith('VEHICULOS COMERCIALIZADORAS DE VEHICULOS'))return INDICIA['VEHICULOS COMERCIALIZADORAS DE VEHICULOS NUEVOS O USADOS'];
    return [0,0,0,0,0];
  }
  function ratio(num,den){return Number(den)>0?100*Number(num||0)/Number(den):null;}
  function annualRows(row,name){
    const ind=indiciaSeries(name);
    return YEARS.map((year,i)=>{
      const ros=Number(row?.[`ros_${year}`]||0),hits=Number(ind[i]||0),rate=ratio(hits,ros);
      const sys=ratio(SYSTEM_INDICIA[year],SYSTEM_ROS[year]);
      const exceptional=Number.isFinite(rate)&&rate>100;
      return {year,ros,hits,rate,sys,exceptional};
    });
  }
  function conversionGrid(rows){
    return `<div class="atlas-conversion-grid">${rows.map(x=>`<div class="atlas-conversion-year ${x.exceptional?'is-lagged':''}"><span>${x.year}</span><b>${Number.isFinite(x.rate)?pct(x.rate):'—'}</b><small><strong>${fmt(x.hits)}</strong> con indicios / ${fmt(x.ros)} ROS</small><em>Sistema UAF ${pct(x.sys)}</em>${x.exceptional?'<i>flujo con rezago</i>':''}</div>`).join('')}</div>`;
  }

  window.v0193SectorDrawer=function atlasSectorDrawerConversion(name,core,uaf){
    const r=uaf.sectors.find(x=>x.sector_name===name);if(!r)return;
    const flags=v0193Flags(r,uaf);
    const pats=core.patterns.filter(p=>v0193SectorMatch(p.scope_label,name)&&v0193PatternIsUaf(p)).slice(0,6);
    const gap=core.gapSectors.find(g=>v0193SectorMatch(g.sector_name,name));
    const totalRos=Number(uaf?.report?.totals?.ros_2025)||SYSTEM_ROS[2025];
    const share=totalRos?100*Number(r.ros_2025||0)/totalRos:null;
    const annual=cagr(r);
    const series=v0193Series(r);
    const peak=series.reduce((a,b)=>b.value>a.value?b:a,series[0]);
    const delta=Number(r.delta_ros_2025_vs_2024_pct);
    const conv=annualRows(r,name);
    const totalSectorRos=YEARS.reduce((a,y)=>a+Number(r?.[`ros_${y}`]||0),0);
    const totalIndicia=conv.reduce((a,x)=>a+x.hits,0);
    const cumulative=ratio(totalIndicia,totalSectorRos);
    const latest=conv[conv.length-1];
    const systemCumulative=ratio(Object.values(SYSTEM_INDICIA).reduce((a,b)=>a+b,0),Object.values(SYSTEM_ROS).reduce((a,b)=>a+b,0));
    const reading=[
      Number.isFinite(delta)?`${pct(delta,1,true)} vs. 2024`:'sin base comparable 2024',
      Number.isFinite(annual)?`CAGR ${pct(annual,1,true)} anual`:'CAGR no calculable',
      Number.isFinite(share)?`${fmt(share,2)}% del flujo ROS 2025`:'participación no disponible'
    ].join(' · ');

    v019OpenDrawer(`<div class="v0193-sector-drawer atlas-sector-drawer"><span class="v0193-drawer-kicker">Inteligencia UAF · reportabilidad sectorial</span><h2>${safe(name)}</h2><div class="v0193-drawer-kpis"><div><span>SO inscritos 2025</span><b>${v019Fmt(r.registered_so_2025)}</b></div><div><span>ROS 2025</span><b>${v019Fmt(r.ros_2025)}</b></div><div><span>ROS / 100 SO</span><b>${v019Fmt(r.ros_per_100_so_2025,2)}</b></div><div><span>ROS 2021–2025</span><b>${v019Fmt(r.ros_total_2021_2025)}</b></div></div><div class="v0193-flags drawer-flags">${v0193FlagHtml(flags)}</div><section><h3>Serie ROS</h3><div class="v0193-year-grid">${series.map(x=>`<div class="${x.year===peak.year?'atlas-year-peak':''}"><span>${x.year}</span><b>${v019Fmt(x.value)}</b></div>`).join('')}</div><p class="v0193-delta atlas-sector-summary"><b>${peak.year} es el máximo de la serie.</b> ${safe(reading)}.</p></section><section><h3>Lectura sectorial</h3><div class="v0193-rule-grid atlas-sector-reading"><div><span>Crecimiento promedio anual</span><b>${Number.isFinite(annual)?pct(annual,1,true):'—'}</b><small>CAGR ROS 2021–2025. Se omite cuando la base 2021 es cero.</small></div><div><span>Participación ROS 2025</span><b>${Number.isFinite(share)?`${fmt(share,2)}%`:'—'}</b><small>${v019Fmt(r.ros_2025)} de ${v019Fmt(totalRos)} ROS recibidos por la UAF.</small></div><div><span>Convertibilidad observada 2025</span><b>${Number.isFinite(latest.rate)?pct(latest.rate):'—'}</b><small>${fmt(latest.hits)} ROS con indicios / ${fmt(latest.ros)} ROS del sector. Sistema UAF: ${pct(latest.sys)}.</small></div><div><span>Convertibilidad acumulada 2021–2025</span><b>${Number.isFinite(cumulative)?pct(cumulative):'—'}</b><small>${fmt(totalIndicia)} con indicios / ${fmt(totalSectorRos)} ROS. Sistema UAF: ${pct(systemCumulative)}.</small></div></div></section><section class="atlas-conversion"><div class="atlas-conversion-head"><div><h3>ROS → indicios remitidos al Ministerio Público</h3><p>Relación anual entre ROS recibidos del sector y ROS en los que la UAF detectó indicios de LA/FT.</p></div><span>2021–2025</span></div>${conversionGrid(conv)}<p class="atlas-conversion-note">La métrica es un <b>índice de flujo anual observado</b>, no una conversión de cohorte. La UAF puede detectar en un año indicios en ROS recibidos previamente; por eso un valor anual puede superar 100%. El acumulado quinquenal reduce, pero no elimina, este efecto temporal.</p></section>${gap?`<section><h3>Brecha de cobertura / screening</h3><p><b>${v019Fmt(gap.candidate_pairs)}</b> pares RUT–actividad candidatos agregados para este sector. No equivalen a personas jurídicas únicas ni demuestran falta de inscripción.</p></section>`:''}${pats.length?`<section><h3>Patrones UAF materializados</h3>${v019PatternList(pats,6)}</section>`:''}<div class="v019-note warn"><b>Guardrail:</b> “ROS con indicios” significa que la UAF detectó señales indiciarias de LA/FT y remitió la información correspondiente al Ministerio Público mediante Informes de Inteligencia. No equivale a denuncia, formalización, condena ni acredita responsabilidad del sujeto obligado que originó el ROS.</div></div>`);
    v019BindCommon(core);
  };
})();

'use strict';

/* ATLAS OSFL Intelligence 0.92.2
 * Additive decision layer over the governed OSFL runtime.
 * Design principle: OSFL status, public-registration exposure and FATF R.8 screening are context,
 * not adverse signals by themselves. Priority, evidence sufficiency and peer context are separated.
 */
(function atlasOsflIntelligence0922(){
  const BUILD='0922';
  const ENTITY_VIEW='aml_osfl_entity_runtime_snapshot';
  const COVERAGE_OK=70;
  const HIGH_BANDS=['MUY_ALTA','ALTA'];
  const POLISH_STYLE='./assets/atlas-osfl-polish-0921.css?v=0921-1';
  const nf=new Intl.NumberFormat('es-CL');

  function n(v){const x=Number(v);return Number.isFinite(x)?x:0;}
  function fmt(v){const x=Number(v);return Number.isFinite(x)?nf.format(x):'—';}
  function pct(v){const x=Number(v);return Number.isFinite(x)?`${Math.max(0,Math.min(100,x)).toLocaleString('es-CL',{maximumFractionDigits:0})}%`:'—';}
  function e(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function bandLabel(v){return typeof v030Band==='function'?v030Band(v):String(v||'Sin marca').replaceAll('_',' ');}
  function bandClass(v){return typeof v030BandCls==='function'?v030BandCls(v):String(v||'').toLowerCase().replaceAll('_','-');}
  function regionLabel(){return (typeof V030_STATE!=='undefined'&&V030_STATE.region)?(typeof v030RegionShort==='function'?v030RegionShort(V030_STATE.region):V030_STATE.region):'Todo Chile';}
  function scopeLabel(){
    const bits=[regionLabel()];
    if(typeof V030_STATE!=='undefined'&&V030_STATE.activity)bits.push(V030_STATE.activity);
    return bits.join(' · ');
  }
  function scoped(q){
    if(typeof V030_STATE!=='undefined'&&V030_STATE.region)q=q.eq('region',V030_STATE.region);
    if(typeof V030_STATE!=='undefined'&&V030_STATE.activity)q=q.eq('activity_group',V030_STATE.activity);
    return q;
  }
  function ensurePolishStyle(){
    if(document.querySelector('link[data-atlas-osfl-polish="0921"]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=POLISH_STYLE;
    link.dataset.atlasOsflPolish='0921';
    document.head.appendChild(link);
  }
  function normalizeIpaLabels(root){
    if(!root||typeof document.createTreeWalker!=='function')return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];let node;
    while((node=walker.nextNode()))nodes.push(node);
    for(const textNode of nodes){
      const before=textNode.nodeValue||'';
      const after=before
        .replace(/\bIPA\s*3\.0\b/gi,'IPA')
        .replace(/\bIPA\s*3\b/gi,'IPA')
        .replace(/\bIPA3\b/gi,'IPA')
        .replace(/\bIPA\s*·\s*SHADOW\b/gi,'IPA')
        .replace(/\bIPA\s+SHADOW\b/gi,'IPA');
      if(after!==before)textNode.nodeValue=after;
    }
  }
  async function count(mutator){
    let q=sb.from(ENTITY_VIEW).select('entity_id',{count:'exact',head:true});
    q=scoped(q);
    if(mutator)q=mutator(q);
    const {count,error}=await q;
    if(error)throw error;
    return n(count);
  }
  function treatment(r){
    const high=HIGH_BANDS.includes(String(r?.priority_band_shadow||''));
    const cov=n(r?.coverage_index_pct);
    const indep=n(r?.independent_group_count);
    if(high&&cov<COVERAGE_OK)return {key:'complete',label:'Completar evidencia',note:'prioridad alta con cobertura insuficiente'};
    if(high&&indep>=2)return {key:'review',label:'Revisar primero',note:'prioridad alta y convergencia independiente'};
    if(high)return {key:'prioritize',label:'Priorizar',note:'prioridad analítica alta'};
    if(n(r?.ipa3_score)>0)return {key:'observe',label:'Observar',note:'señales IPA activas'};
    return {key:'context',label:'Contexto',note:'sin prioridad IPA activa'};
  }
  function reasons(r){
    const out=[];
    if(n(r?.independent_group_count)>=2)out.push(`${fmt(r.independent_group_count)} grupos independientes`);
    if(n(r?.sanction_count)>0)out.push(`${fmt(r.sanction_count)} sanción${n(r.sanction_count)===1?'':'es'} reconciliada${n(r.sanction_count)===1?'':'s'}`);
    if(n(r?.max_sales_band_increase)>=2||n(r?.max_sales_band_decrease)>=2)out.push('salto económico ≥2 tramos');
    if(r?.dominant_mark_id)out.push(`marca ${String(r.dominant_mark_id).replaceAll('_',' ')}`);
    return out.slice(0,2);
  }
  function hero(){
    const all=(typeof V032_CACHE!=='undefined'&&V032_CACHE.regionDash?.get('__ALL__'))||null;
    const q=(typeof V030_CACHE!=='undefined'&&V030_CACHE.quality)||{};
    const src=(typeof V030_CACHE!=='undefined'&&V030_CACHE.meta?.universe)||{};
    const total=n(all?.entity_count)||n(src.expanded)||n(q.canonical_entities);
    const active=n(all?.ipa3_positive_count)||n(q.ipa3_positive);
    const so=n(all?.uaf_so_count)||n(q.uaf_so);
    const r8=n(all?.r8_count)||n(src.r8_candidates);
    return `<section class="v030-hero v032-hero atlas-osfl-hero atlas-osfl-hero-compact" data-atlas-osfl-build="${BUILD}" style="padding:12px 14px;grid-template-columns:170px minmax(0,1fr);gap:10px;align-items:stretch">
      <div class="v030-hero-score atlas-osfl-hero-score" style="padding:10px 13px;border-radius:13px;box-shadow:none"><span>IPA activo</span><b style="font-size:31px;margin:4px 0 2px">${fmt(active)}</b><small>${total?`${pct(100*active/total)} del universo`:'universo en carga'}</small><em style="margin-top:4px">prioridad analítica</em></div>
      <div class="v030-hero-metrics v032-hero-metrics atlas-osfl-hero-metrics" style="grid-column:auto;grid-template-columns:repeat(4,minmax(0,1fr));border-radius:12px">
        <div style="padding:9px 11px"><span>Universo OSFL</span><b>${fmt(total)}</b><small>Entity Hub + Radar_OSFL</small></div>
        <div class="uaf" style="padding:9px 11px"><span>También son SO UAF</span><b>${fmt(so)}</b><small>cruce exacto por identidad</small></div>
        <div style="padding:9px 11px"><span>R.8 candidatas</span><b>${fmt(r8)}</b><small>cribado funcional · no puntúa</small></div>
        <div style="padding:9px 11px"><span>Lectura actual</span><b id="v030ScopeCount">—</b><small><span id="v030UpdatedAt">actualizando corte…</span></small></div>
      </div>
    </section>`;
  }
  function deckSkeleton(){
    return `<section class="atlas-osfl-decision" data-v092-decision>
      <header class="atlas-osfl-decision-head">
        <div><span>MESA ANALÍTICA · ${e(scopeLabel())}</span><h3>¿Qué merece atención primero?</h3><p>Prioridad y calidad de evidencia se muestran por separado para evitar falsos positivos por falta de cobertura.</p></div>
        <div class="atlas-osfl-decision-rule"><b>Regla de lectura</b><span>Prioridad ≠ probabilidad</span><small>Contexto público/UAF/R.8 no suma por sí solo.</small></div>
      </header>
      <div class="atlas-osfl-kpis" data-v092-kpis>${loadingCards(4)}</div>
      <div class="atlas-osfl-decision-grid">
        <article class="atlas-osfl-matrix-card"><div class="atlas-osfl-subhead"><span>MATRIZ DE TRATAMIENTO</span><h4>Prioridad × cobertura</h4><small>Umbral operativo de cobertura: ${COVERAGE_OK}%.</small></div><div class="atlas-osfl-matrix" data-v092-matrix>${loadingCards(4)}</div><p class="atlas-osfl-matrix-note">La cobertura insuficiente no reduce la prioridad: cambia el tratamiento a “completar evidencia”.</p></article>
        <article class="atlas-osfl-queue-card"><div class="atlas-osfl-subhead"><span>COLA ANALÍTICA</span><h4>Entidades para revisión</h4><small>Ordenadas por IPA, convergencia independiente y cobertura.</small></div><div class="atlas-osfl-queue" data-v092-queue><div class="atlas-osfl-loading">Calculando cola analítica…</div></div></article>
      </div>
      <div class="atlas-osfl-legend"><div><b>Señal</b><span>Marcas gobernadas y evidencia independiente que sustentan priorización.</span></div><div><b>Contexto</b><span>R.8, registros públicos, UAF y Presupuesto Abierto enriquecen la lectura sin puntuar por sí solos.</span></div><div><b>Calidad</b><span>Cobertura y confianza indican cuánto sabemos antes de decidir tratamiento.</span></div></div>
    </section>`;
  }
  function loadingCards(k){return Array.from({length:k},()=>'<div class="atlas-osfl-skeleton"></div>').join('');}
  function kpi(label,value,detail,kind='neutral'){
    return `<div class="atlas-osfl-kpi ${kind}"><span>${e(label)}</span><b>${fmt(value)}</b><small>${e(detail)}</small></div>`;
  }
  async function analytics(){
    const [total,coverageGood,highTotal,highCoverage,convergence,sanctions]=await Promise.all([
      count(),
      count(q=>q.gte('coverage_index_pct',COVERAGE_OK)),
      count(q=>q.in('priority_band_shadow',HIGH_BANDS)),
      count(q=>q.in('priority_band_shadow',HIGH_BANDS).gte('coverage_index_pct',COVERAGE_OK)),
      count(q=>q.gte('independent_group_count',2)),
      count(q=>q.gt('sanction_count',0))
    ]);
    const highIncomplete=Math.max(0,highTotal-highCoverage);
    const nonHigh=Math.max(0,total-highTotal);
    const nonHighCoverage=Math.max(0,coverageGood-highCoverage);
    const nonHighIncomplete=Math.max(0,nonHigh-nonHighCoverage);
    return {total,coverageGood,highTotal,highCoverage,highIncomplete,convergence,sanctions,nonHighCoverage,nonHighIncomplete};
  }
  async function queue(){
    const fields='entity_id,rut,name,region,activity_group,ipa3_score,priority_band_shadow,coverage_index_pct,score_confidence_pct,independent_group_count,sanction_count,max_sales_band_increase,max_sales_band_decrease,dominant_mark_id';
    let q=sb.from(ENTITY_VIEW).select(fields).in('priority_band_shadow',HIGH_BANDS);
    q=scoped(q).order('ipa3_score',{ascending:false,nullsFirst:false}).order('independent_group_count',{ascending:false,nullsFirst:false}).order('coverage_index_pct',{ascending:false,nullsFirst:false}).limit(8);
    let {data,error}=await q;
    if(error)throw error;
    if(!(data||[]).length){
      let fallback=sb.from(ENTITY_VIEW).select(fields).gt('ipa3_score',0);
      fallback=scoped(fallback).order('ipa3_score',{ascending:false,nullsFirst:false}).limit(8);
      const res=await fallback;if(res.error)throw res.error;data=res.data;
    }
    return data||[];
  }
  function renderAnalytics(a){
    const k=document.querySelector('[data-v092-kpis]');
    if(k)k.innerHTML=[
      kpi('Prioridad alta + evidencia suficiente',a.highCoverage,`cobertura ≥${COVERAGE_OK}%`,'good'),
      kpi('Prioridad alta · completar evidencia',a.highIncomplete,`cobertura <${COVERAGE_OK}% o pendiente`,'warn'),
      kpi('Convergencia independiente',a.convergence,'≥2 grupos de evidencia','signal'),
      kpi('Sanciones reconciliadas',a.sanctions,'contexto administrativo por identidad','neutral')
    ].join('');
    const m=document.querySelector('[data-v092-matrix]');
    if(m)m.innerHTML=`
      <div class="atlas-osfl-quadrant q-review"><span>Prioridad alta</span><b>${fmt(a.highCoverage)}</b><small>evidencia suficiente</small><em>REVISAR PRIMERO</em></div>
      <div class="atlas-osfl-quadrant q-complete"><span>Prioridad alta</span><b>${fmt(a.highIncomplete)}</b><small>evidencia incompleta</small><em>COMPLETAR EVIDENCIA</em></div>
      <div class="atlas-osfl-quadrant q-observe"><span>Resto del universo</span><b>${fmt(a.nonHighCoverage)}</b><small>evidencia suficiente</small><em>OBSERVAR / CONTEXTO</em></div>
      <div class="atlas-osfl-quadrant q-context"><span>Resto del universo</span><b>${fmt(a.nonHighIncomplete)}</b><small>evidencia incompleta</small><em>NO SOBRERREACCIONAR</em></div>`;
  }
  function renderQueue(rows){
    const el=document.querySelector('[data-v092-queue]');if(!el)return;
    if(!rows.length){el.innerHTML='<div class="atlas-osfl-empty">Sin entidades con IPA activo en el ámbito seleccionado.</div>';return;}
    el.innerHTML=rows.map((r,i)=>{
      const t=treatment(r),why=reasons(r);
      return `<button type="button" class="atlas-osfl-queue-row" data-v092-entity="${e(r.entity_id)}">
        <em>${String(i+1).padStart(2,'0')}</em>
        <span class="atlas-osfl-queue-main"><b>${e(r.name||'Entidad')}</b><small>${e(r.rut||'RUT no informado')} · ${e(r.activity_group||'actividad no clasificada')}</small><i>${e(why.join(' · ')||'IPA activo sin señal resumida')}</i></span>
        <span class="atlas-osfl-queue-score ${e(bandClass(r.priority_band_shadow))}"><b>${n(r.ipa3_score).toLocaleString('es-CL',{maximumFractionDigits:1})}</b><small>${e(bandLabel(r.priority_band_shadow))}</small></span>
        <span class="atlas-osfl-queue-coverage"><b>${pct(r.coverage_index_pct)}</b><small>cobertura</small></span>
        <span class="atlas-osfl-treatment ${e(t.key)}"><b>${e(t.label)}</b><small>${e(t.note)}</small></span>
      </button>`;
    }).join('');
    el.querySelectorAll('[data-v092-entity]').forEach(btn=>btn.addEventListener('click',()=>{if(typeof v030OpenEntity==='function')void v030OpenEntity(btn.dataset.v092Entity);}));
  }
  async function hydrate(){
    const root=document.querySelector('[data-v092-decision]');if(!root)return;
    try{
      const [a,rows]=await Promise.all([analytics(),queue()]);
      renderAnalytics(a);renderQueue(rows);
      root.dataset.status='ready';
    }catch(err){
      root.dataset.status='error';
      const k=document.querySelector('[data-v092-kpis]');if(k)k.innerHTML=`<div class="atlas-osfl-error"><b>Mesa analítica no disponible</b><span>${e(err?.message||String(err))}</span></div>`;
      const q=document.querySelector('[data-v092-queue]');if(q)q.innerHTML='<div class="atlas-osfl-empty">El explorador OSFL base sigue disponible; esta capa adicional no pudo calcularse.</div>';
    }
  }
  function installDeck(){
    const heroEl=document.querySelector('.v030-hero');if(!heroEl)return;
    if(!document.querySelector('[data-v092-decision]'))heroEl.insertAdjacentHTML('afterend',deckSkeleton());
  }

  async function peerCard(id){
    try{
      const {data:base,error}=await sb.from(ENTITY_VIEW).select('entity_id,name,activity_group,ipa3_score,coverage_index_pct,priority_band_shadow,independent_group_count,sanction_count,max_sales_band_increase,max_sales_band_decrease,dominant_mark_id').eq('entity_id',id).maybeSingle();
      if(error||!base||!base.activity_group)return;
      const peer=(mutator)=>{let q=sb.from(ENTITY_VIEW).select('entity_id',{count:'exact',head:true}).eq('activity_group',base.activity_group);if(mutator)q=mutator(q);return q;};
      const tasks=[peer(),Number.isFinite(Number(base.ipa3_score))?peer(q=>q.lte('ipa3_score',Number(base.ipa3_score))):Promise.resolve({count:null,error:null}),Number.isFinite(Number(base.coverage_index_pct))?peer(q=>q.lte('coverage_index_pct',Number(base.coverage_index_pct))):Promise.resolve({count:null,error:null})];
      const [totRes,scoreRes,covRes]=await Promise.all(tasks);
      if(totRes.error)throw totRes.error;
      const total=n(totRes.count),scorePct=total&&scoreRes.count!=null?100*n(scoreRes.count)/total:null,covPct=total&&covRes.count!=null?100*n(covRes.count)/total:null,t=treatment(base),why=reasons(base);
      const score=document.querySelector('#v019-drawer-body .v030-drawer-score');if(!score)return;
      document.querySelector('#v019-drawer-body .atlas-osfl-peer-card')?.remove();
      score.insertAdjacentHTML('afterend',`<section class="atlas-osfl-peer-card">
        <div class="atlas-osfl-peer-title"><span>COMPARABLES · MISMA ACTIVIDAD</span><b>${e(base.activity_group)}</b><small>${fmt(total)} entidades en el grupo de comparación.</small></div>
        <div class="atlas-osfl-peer-stats"><div><span>IPA relativo</span><b>${scorePct==null?'—':`P${Math.round(scorePct)}`}</b><small>posición operativa dentro del grupo</small></div><div><span>Cobertura relativa</span><b>${covPct==null?'—':`P${Math.round(covPct)}`}</b><small>posición por evidencia disponible</small></div><div><span>Tratamiento</span><b>${e(t.label)}</b><small>${e(why.join(' · ')||t.note)}</small></div></div>
        <p>Los percentiles son comparaciones operativas, no percentiles de riesgo ni estimaciones de probabilidad. Sirven para evitar comparar organizaciones con perfiles económicos distintos.</p>
      </section>`);
    }catch(_err){/* peer context is additive; never break OSFL 360 */}
  }

  ensurePolishStyle();
  if(typeof v030Hero==='function')v030Hero=hero;
  if(typeof v030LoadOsfl==='function'){
    const baseLoad=v030LoadOsfl;
    v030LoadOsfl=async function(){
      const out=await baseLoad.apply(this,arguments);
      installDeck();
      await hydrate();
      normalizeIpaLabels(document.querySelector('.v030-osfl'));
      return out;
    };
  }
  if(typeof v030SyncMapAndCharts==='function'){
    const baseSync=v030SyncMapAndCharts;
    v030SyncMapAndCharts=async function(){
      const out=await baseSync.apply(this,arguments);
      normalizeIpaLabels(document.querySelector('.v030-osfl'));
      return out;
    };
  }
  if(typeof v030OpenEntity==='function'){
    const baseOpen=v030OpenEntity;
    v030OpenEntity=async function(id){
      const out=await baseOpen.apply(this,arguments);
      normalizeIpaLabels(document.querySelector('#v019-drawer-body'));
      await peerCard(id);
      normalizeIpaLabels(document.querySelector('#v019-drawer-body'));
      return out;
    };
  }
  window.ATLAS_OSFL_INTELLIGENCE={build:BUILD,coverageThreshold:COVERAGE_OK,refresh:hydrate,normalizeIpaLabels};
})();
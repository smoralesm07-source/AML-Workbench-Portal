'use strict';
/* ATLAS AML · Empresas (RES) · refinement 0.95.3 */
(function atlasResRefinement0953(){
  if(window.__ATLAS_RES_REFINEMENT_0953__) return;
  window.__ATLAS_RES_REFINEMENT_0953__=true;

  const VERSION='0.95.3';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>new Intl.NumberFormat('es-CL').format(Number(v||0));
  const pct=v=>`${Number(v||0).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
  const money=v=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(v||0));
  const data=()=>window.AtlasRes0952?.data||window.AtlasRes0950?.data||null;
  const cutoff=()=>window.AtlasRes0952?.cutoff||window.AtlasRes0950?.cutoff||'31-07-2026';

  function compactSourceHeader(root){
    const hero=root.querySelector('.res952-hero');
    if(!hero||root.querySelector('.res953-sourcebar')) return;
    const bar=document.createElement('div');
    bar.className='res953-sourcebar';
    bar.setAttribute('aria-label','Estado de la fuente RES');
    bar.innerHTML=`<span>● RES operativo</span><i aria-hidden="true"></i><b>Corte ${esc(cutoff())}</b>`;
    hero.replaceWith(bar);
  }

  function activateMapTab(root){
    const tab=root.querySelector('[data-res952-route="territory"]');
    if(!tab) return;
    tab.textContent='Mapa';
    tab.removeAttribute('disabled');
    tab.setAttribute('aria-label','Mapa RES por región');
    tab.title='Abrir mapa analítico RES';
  }

  function removeDuplicateWeekly(root){
    if(!root.querySelector('#res952-temporal-chart')||root.dataset.res953Pulse==='1') return;
    root.dataset.res953Pulse='1';
    const duplicate=[...root.querySelectorAll('.res952-card')].find(card=>
      (card.querySelector('header span')?.textContent||'').trim().toUpperCase()==='LECTURA SEMANAL'
    );
    if(duplicate){
      const parent=duplicate.parentElement;
      duplicate.remove();
      if(parent&&parent.querySelector('.res952-economic')) parent.classList.add('res953-economic-only');
    }
  }

  function hideLegacyPhenomenonBlocks(root){
    const kpis=root.querySelector('.res952-kpis-phen');
    if(kpis) kpis.classList.add('res953-hidden-source');
    root.querySelectorAll('.res952-toolbar').forEach(el=>el.classList.add('res953-hidden-source'));
    const findings=root.querySelector('#res952-findings');
    if(findings?.closest('.res952-card')) findings.closest('.res952-card').classList.add('res953-hidden-source');
    const labels=new Set(['FRECUENCIA','CONCENTRACIÓN','REPETICIÓN','COINCIDENCIA REGISTRAL']);
    root.querySelectorAll('.res952-card').forEach(card=>{
      const label=(card.querySelector('header span')?.textContent||'').trim().toUpperCase();
      if(labels.has(label)) card.classList.add('res953-hidden-source');
    });
  }

  function triggerFinding(root,kind,term){
    const type=root.querySelector('#res952-phen-type');
    const query=root.querySelector('#res952-phen-q');
    const box=root.querySelector('#res952-findings');
    if(!type||!query||!box) return;
    type.value=kind;
    type.dispatchEvent(new Event('change',{bubbles:true}));
    query.value=term||'';
    query.dispatchEvent(new Event('input',{bubbles:true}));
    const needle=String(term||'').toLocaleLowerCase('es-CL');
    const candidates=[...box.querySelectorAll(`[data-kind="${kind}"]`)];
    const target=candidates.find(b=>!needle||(b.textContent||'').toLocaleLowerCase('es-CL').includes(needle))||candidates[0];
    target?.click();
    const evidence=root.querySelector('.res953-evidence-card');
    if(evidence){
      evidence.animate?.([{outline:'1px solid transparent'},{outline:'1px solid color-mix(in srgb, var(--r-orange) 60%, transparent)'},{outline:'1px solid transparent'}],{duration:850,easing:'ease-out'});
    }
  }

  function phenomenonCommand(root){
    if(!root.querySelector('#res952-findings')||root.querySelector('.res953-phenomenon-command')) return;
    const d=data();
    if(!d) return;

    const a=d.anomalies?.[0]||[3,'Feb',214,136.8,56.5,7.27];
    const c=d.clusters?.[0]||['2026-07-01',13,'PROVIDENCIA','SpA',1000000,31];
    const cd=d.communeDays?.[0]||['2026-02-03','PROVIDENCIA',76];
    const national=(d.criticalDates||[]).find(r=>r[0]===cd[0])||[cd[0],0];
    const commune=d.communeGrowth?.[0]||['CASTRO',462,297,55.6];
    const capital=d.capitals?.[0]||[1000000,38654,29.91];
    const localShare=national[1]?cd[2]/national[1]*100:0;
    const regionName=({1:'Tarapacá',2:'Antofagasta',3:'Atacama',4:'Coquimbo',5:'Valparaíso',6:'O’Higgins',7:'Maule',8:'Biobío',9:'La Araucanía',10:'Los Lagos',11:'Aysén',12:'Magallanes',13:'Metropolitana',14:'Los Ríos',15:'Arica y Parinacota',16:'Ñuble'})[a[0]]||`Región ${a[0]}`;

    const section=document.createElement('section');
    section.className='res953-phenomenon-command';
    section.innerHTML=`
      <header>
        <div><span>LECTURA EJECUTIVA AML · RES</span><h3>Señales que requieren revisión</h3></div>
        <p>Prioriza convergencias registrales y cambios de comportamiento. Cada señal es exploratoria: no constituye por sí sola riesgo LA/FT ni imputación.</p>
      </header>
      <div class="res953-alert-grid">
        <button type="button" class="res953-alert" data-res953-kind="anomaly" data-res953-term="${esc(regionName)}">
          <span class="res953-alert-index">01</span><span class="res953-alert-body">
            <span class="res953-alert-kicker">Desvío territorial</span><span class="res953-alert-title">${esc(regionName)} · ${esc(a[1])} 2026</span>
            <span class="res953-alert-metric"><b>z ${Number(a[5]).toFixed(2)}</b><span>${num(a[2])} constituciones · +${pct(a[4])} sobre baseline</span></span>
            <span class="res953-alert-copy">Es el desvío regional más intenso del período observado y supera ampliamente el umbral z ≥ 4 usado por el detector RES.</span>
            <span class="res953-alert-action"><strong>Revisar:</strong> composición del cohorte y coincidencias registrales adicionales antes de escalar.</span>
          </span>
        </button>
        <button type="button" class="res953-alert" data-res953-kind="date" data-res953-term="${esc(cd[1])}">
          <span class="res953-alert-index">02</span><span class="res953-alert-body">
            <span class="res953-alert-kicker">Convergencia temporal + comunal</span><span class="res953-alert-title">${esc(cd[1])} · ${esc(cd[0])}</span>
            <span class="res953-alert-metric"><b>${num(cd[2])}</b><span>sociedades · ${pct(localShare)} del flujo nacional de ese día</span></span>
            <span class="res953-alert-copy">La concentración comunal coincide con una fecha de alta intensidad nacional (${num(national[1])} constituciones), elevando su valor para revisión.</span>
            <span class="res953-alert-action"><strong>Revisar:</strong> si el grupo comparte otros atributos registrales y si corresponde a un canal de constitución concentrado.</span>
          </span>
        </button>
        <button type="button" class="res953-alert" data-res953-kind="cluster" data-res953-term="${esc(c[0])}">
          <span class="res953-alert-index">03</span><span class="res953-alert-body">
            <span class="res953-alert-kicker">Coincidencia registral</span><span class="res953-alert-title">${esc(c[2])} · ${esc(c[0])}</span>
            <span class="res953-alert-metric"><b>${num(c[5])}</b><span>${esc(c[3])} · capital ${esc(money(c[4]))}</span></span>
            <span class="res953-alert-copy">Mismo día, comuna, forma jurídica y capital. Es una señal estructural útil para individualizar patrones de constitución seriada.</span>
            <span class="res953-alert-action"><strong>Revisar:</strong> las sociedades del cluster y buscar coincidencias adicionales dentro de la información RES disponible.</span>
          </span>
        </button>
      </div>
      <div class="res953-convergence">
        <article class="res953-convergence-panel">
          <div class="res953-panel-head"><b>Radar de convergencia</b><span>primero patrones con más de una señal observable</span></div>
          <div class="res953-convergence-list">
            <button type="button" class="res953-convergence-row" data-res953-kind="date" data-res953-term="${esc(cd[1])}"><span><b>${esc(cd[1])} · ${esc(cd[0])}</b><small>${num(cd[2])} sociedades en la comuna</small></span><span class="res953-signal-chips"><span>fecha crítica</span><span>comuna-día</span></span><strong>${pct(localShare)} del día</strong></button>
            <button type="button" class="res953-convergence-row" data-res953-kind="cluster" data-res953-term="${esc(c[0])}"><span><b>${esc(c[2])} · ${esc(c[0])}</b><small>${esc(c[3])} · ${esc(money(c[4]))}</small></span><span class="res953-signal-chips"><span>fecha</span><span>comuna</span><span>tipo</span><span>capital</span></span><strong>${num(c[5])} sociedades</strong></button>
            <button type="button" class="res953-convergence-row" data-res953-kind="anomaly" data-res953-term="${esc(regionName)}"><span><b>${esc(regionName)} · ${esc(a[1])}</b><small>${num(a[2])} constituciones</small></span><span class="res953-signal-chips"><span>desvío regional</span><span>aceleración</span></span><strong>z ${Number(a[5]).toFixed(2)}</strong></button>
          </div>
        </article>
        <aside class="res953-context-panel">
          <div class="res953-panel-head"><b>Contexto para no sobrerreaccionar</b><span>señales débiles aisladas</span></div>
          <div class="res953-context-list">
            <div class="res953-context-item"><span>Capital ${esc(money(capital[0]))}<br>Muy frecuente; aporta contexto, no especificidad por sí solo.</span><b>${pct(capital[2])}<br><small>${num(capital[1])} sociedades</small></b></div>
            <div class="res953-context-item"><span>${esc(commune[0])}<br>Crecimiento comunal que merece seguimiento si converge con otras señales.</span><b>+${pct(commune[3])}<br><small>${num(commune[1])} vs ${num(commune[2])}</small></b></div>
            <div class="res953-context-item"><span>Top 10 comunas<br>Concentración nacional del flujo YTD.</span><b>${pct(d.top10CommuneShare)}</b></div>
          </div>
          <p class="res953-context-note">Criterio: la prioridad analítica aumenta cuando frecuencia, territorio y coincidencias registrales convergen. Un capital redondo o un día intenso, aislados, no deben interpretarse como señal AML suficiente.</p>
        </aside>
      </div>`;

    const tabs=root.querySelector('.res952-tabs');
    (tabs||root.firstElementChild)?.insertAdjacentElement('afterend',section);

    const method=root.querySelector('.res952-method');
    if(method){
      method.classList.add('res953-method-note');
      method.innerHTML='<b>Criterio de uso</b><span>RES es la única fuente usada para detectar estos fenómenos. El enriquecimiento SII permanece separado y no modifica la priorización. La evidencia debe leerse como punto de partida para revisión analítica.</span>';
    }

    hideLegacyPhenomenonBlocks(root);
    const evidence=root.querySelector('#res952-company-list')?.closest('.res952-company-card');
    if(evidence){
      evidence.classList.add('res953-evidence-card');
      const h=evidence.querySelector('header h3');if(h)h.textContent='Sociedades asociadas a la señal seleccionada';
      const tag=evidence.querySelector('header span');if(tag)tag.textContent='EVIDENCIA · DRILL-DOWN RES';
    }

    section.addEventListener('click',e=>{
      const target=e.target.closest('[data-res953-kind]');
      if(!target) return;
      e.preventDefault();
      triggerFinding(root,target.dataset.res953Kind,target.dataset.res953Term||'');
    });
  }

  function apply(){
    const root=document.querySelector('[data-res952-root]');
    if(!root) return;
    compactSourceHeader(root);
    activateMapTab(root);
    removeDuplicateWeekly(root);
    phenomenonCommand(root);
    window.__ATLAS_RES_REFINEMENT__={version:VERSION,status:'ready',sourceHeader:'compact',mapTab:'active',duplicateWeekly:'removed',phenomena:'executive-aml',checkedAt:new Date().toISOString()};
  }

  const observer=new MutationObserver(()=>apply());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  for(const ms of [0,80,220,500,900,1500,2500]) setTimeout(apply,ms);
  document.addEventListener('atlas:routechange',apply);
  window.addEventListener('atlas:nav-refresh',apply);
})();

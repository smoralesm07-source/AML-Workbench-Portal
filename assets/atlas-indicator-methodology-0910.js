'use strict';
/* ATLAS AML · Indicator methodology facade 0.91.0
 * Canonical presentation + subtle methodological help across dynamic Atlas views.
 * Technical ipa3_* contracts remain unchanged for backward compatibility.
 * No MutationObserver: refresh is coupled to route authority and bounded lifecycle events.
 */
(function atlasIndicatorMethodology0910(){
  if(window.AtlasIndicatorMethodologyV1)return;
  const VERSION='0.91.0';
  const currentScript=document.currentScript;
  const CSS_URL=currentScript?.src?new URL('atlas-indicator-methodology-0910.css',currentScript.src).href:'./assets/atlas-indicator-methodology-0910.css';
  const CATALOG={
    IRAR_E:{label:'IRAR-E',name:'Riesgo inherente sectorial',status:'Fórmula gobernada · requiere materialización completa',method:'40% vulnerabilidad estructural + 30% materialidad + 30% amenaza LA/FT/FP. La amenaza debe apoyarse en ENR Chile, GAFI/GAFILAT, tipologías y evidencia LA/FT; criminalidad general aislada no basta. No mezcla cumplimiento ni riesgo individual.'},
    IGR:{label:'IGR',name:'Índice de Riesgo Geográfico',status:'Territorio · beta gobernada',method:'Mide exposición territorial relativa. Mantiene separadas vulnerabilidad/exposición, densidad de SO, brecha y amenaza. Es contexto geográfico: no atribuye riesgo o conducta a una entidad por su domicilio y ausencia de fuente no equivale a cero.'},
    IPA:{label:'IPA',name:'Índice de Prioridad Analítica',status:'Entidad · shadow operacional',method:'Ordena entidades para revisión mediante marcas registrales, económicas y sancionatorias gobernadas, con topes, recencia, absorción de señales correlacionadas y comparación entre pares cuando corresponde. No estima probabilidad de LA/FT ni acredita irregularidad. IPA3 queda sólo como alias técnico histórico.'},
    IVO:{label:'IVO',name:'Índice de Verosimilitud de Obligación',status:'Potenciales SO · screening',method:'Estima qué tan verosímil es que una entidad corresponda a una actividad obligada usando evidencia registral y patrones del padrón observado. No mide riesgo LA/FT, incumplimiento ni sustituye una determinación jurídica. Materialidad de incorporación se mantiene separada.'},
    IRAR:{label:'IRAR',name:'Índice de Rendimiento Analítico de ROS',status:'Reportabilidad · distinto de IRAR-E',method:'Describe rendimiento analítico agregado de la reportabilidad ROS. Se conserva deliberadamente separado de IRAR-E: IRAR no es riesgo sectorial, riesgo individual ni probabilidad de LA/FT.'},
    MITIGACION:{label:'Mitigación / Cumplimiento',name:'Capacidad mitigadora y de cumplimiento',status:'Nueva dimensión · shadow hasta cobertura suficiente',method:'Evalúa fortaleza o debilidad de controles usando evidencia de fiscalización, calidad/oportunidad de reporte, madurez preventiva y recurrencia/corrección de hallazgos. Permanece separada del riesgo inherente y no se puntúa cuando la cobertura de controles es insuficiente.'},
    BCR:{label:'BCR',name:'Brecha de Cobertura Regulatoria',status:'Nueva métrica sectorial derivada',method:'Compara SO inscritos con potenciales SO plausibles del mismo sector. Es una señal de cobertura para orientar revisión e incorporación; no prueba obligación, incumplimiento ni riesgo LA/FT. Debe leerse siempre con universo, corte y cobertura.'},
    PRIORIDAD_FISCALIZACION:{label:'Prioridad de Fiscalización',name:'Prioridad de Fiscalización',status:'Nueva síntesis gobernada · sin pesos por defecto',method:'Integra IRAR-E, IGR, IPA y debilidad mitigadora cuando existe cobertura suficiente y ponderadores aprobados. IVO queda fuera y opera en el carril de potenciales SO. La salida prioriza supervisión; no estima probabilidad de LA/FT.'}
  };
  const SKIP=new Set(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT','SELECT','OPTION','CODE','PRE']);
  const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const score=v=>Math.max(0,Math.min(100,Number(v)));
  const round=v=>Math.round(v*10)/10;
  const compute={
    irarE({vulnerability,materiality,threat}={}){
      if(![vulnerability,materiality,threat].every(finite))return null;
      return round(.40*score(vulnerability)+.30*score(materiality)+.30*score(threat));
    },
    bcr({registered,plausiblePotential}={}){
      if(![registered,plausiblePotential].every(finite))return null;
      const r=Math.max(0,Number(registered)),p=Math.max(0,Number(plausiblePotential)),d=r+p;
      return d?round(100*p/d):null;
    },
    priority(inputs={},weights={}){
      const values={IRAR_E:inputs.irarE,IGR:inputs.igr,IPA:inputs.ipa,MITIGACION:inputs.mitigationWeakness};
      const keys=Object.keys(values);
      if(!keys.every(k=>finite(values[k])&&finite(weights[k])))return null;
      const total=keys.reduce((a,k)=>a+Number(weights[k]),0);
      if(Math.abs(total-1)>.0001)return null;
      return round(keys.reduce((a,k)=>a+score(values[k])*Number(weights[k]),0));
    }
  };
  function normalizeVisibleText(text){return String(text||'').replace(/\bIPA3\b/g,'IPA').replace(/\bipa3\b/g,'IPA');}
  function keysForText(text){
    const s=String(text||'');const out=[];
    if(/\bIRAR[\-‐‑‒–—]?E\b/i.test(s)||/riesgo inherente sectorial/i.test(s))out.push('IRAR_E');
    if(/\bIGR(?:[\-‐‑‒–—]LA\/?FT)?\b/i.test(s)||/índice de riesgo geogr[aá]fico/i.test(s))out.push('IGR');
    if(/\bIPA(?:3)?\b/i.test(s)||/prioridad anal[ií]tica/i.test(s))out.push('IPA');
    if(/\bIVO\b/i.test(s)||/verosimilitud de obligaci[oó]n/i.test(s))out.push('IVO');
    if(/brecha de cobertura regulatoria/i.test(s)||/\bBCR\b/i.test(s))out.push('BCR');
    if(/prioridad de fiscalizaci[oó]n/i.test(s))out.push('PRIORIDAD_FISCALIZACION');
    if(/mitigaci[oó]n\s*\/\s*cumplimiento/i.test(s)||/capacidad mitigadora/i.test(s))out.push('MITIGACION');
    if(/\bIRAR\b/i.test(s)&&!out.includes('IRAR_E'))out.push('IRAR');
    return [...new Set(out)];
  }
  function annotateParent(parent,keys){
    if(!parent||!keys.length||SKIP.has(parent.tagName))return;
    const prior=(parent.dataset.atlasIndicatorKeys||'').split(',').filter(Boolean);
    const merged=[...new Set([...prior,...keys])];
    parent.dataset.atlasIndicatorKeys=merged.join(',');
    parent.setAttribute('data-atlas-indicator-key','1');
    const title=merged.map(k=>`${CATALOG[k].label}: ${CATALOG[k].method}`).join(' · ');
    if(!parent.dataset.atlasIndicatorNativeTitle){
      parent.dataset.atlasIndicatorNativeTitle='1';
      parent.title=parent.title?`${parent.title} · ${title}`:title;
    }
  }
  function scan(root=document){
    const doc=root?.nodeType===9?root:(root?.ownerDocument||document);
    const target=root?.nodeType===9?(root.body||root.documentElement):root;
    if(!target)return 0;
    let touched=0;
    const walker=doc.createTreeWalker(target,NodeFilter.SHOW_TEXT,{acceptNode(node){
      const p=node.parentElement;if(!p||SKIP.has(p.tagName))return NodeFilter.FILTER_REJECT;
      const t=node.nodeValue||'';return (/\b(?:IPA3?|IVO|IGR|IRAR)\b/i.test(t)||/Brecha de Cobertura Regulatoria|Prioridad de Fiscalizaci[oó]n|Mitigaci[oó]n\s*\/\s*Cumplimiento|capacidad mitigadora|riesgo inherente sectorial/i.test(t))?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
    }});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      const before=node.nodeValue||'',after=normalizeVisibleText(before);if(after!==before){node.nodeValue=after;touched++;}
      const keys=keysForText(after);if(keys.length){annotateParent(node.parentElement,keys);touched++;}
    }
    for(const el of target.querySelectorAll?.('[title],[aria-label]')||[]){
      if(SKIP.has(el.tagName))continue;
      for(const attr of ['aria-label']){const v=el.getAttribute(attr);if(v&&/\bIPA3\b/i.test(v))el.setAttribute(attr,normalizeVisibleText(v));}
    }
    attachFrames(doc);
    return touched;
  }
  function buildTip(doc){
    let tip=doc.getElementById('atlas-indicator-methodology-tip');if(tip)return tip;
    tip=doc.createElement('div');tip.id='atlas-indicator-methodology-tip';tip.className='atlas-indicator-methodology-tip atlas-methodology-tip';tip.setAttribute('role','tooltip');tip.setAttribute('data-atlas-method-help','1');tip.dataset.open='0';
    const strong=doc.createElement('strong'),body=doc.createElement('div'),small=doc.createElement('small');tip.append(strong,body,small);(doc.body||doc.documentElement).appendChild(tip);return tip;
  }
  function showTip(doc,el){
    const keys=(el?.dataset?.atlasIndicatorKeys||'').split(',').filter(k=>CATALOG[k]);if(!keys.length)return;
    const tip=buildTip(doc),strong=tip.querySelector('strong'),body=tip.querySelector('div'),small=tip.querySelector('small');
    strong.textContent=keys.map(k=>CATALOG[k].label).join(' · ');body.textContent=keys.map(k=>CATALOG[k].method).join(' ');small.textContent=keys.map(k=>CATALOG[k].status).join(' · ');
    tip.dataset.open='1';el.dataset.atlasMethodOpen='1';
    const r=el.getBoundingClientRect(),w=Math.min(360,(doc.defaultView?.innerWidth||window.innerWidth)-24);let left=Math.max(12,Math.min(r.left,(doc.defaultView?.innerWidth||window.innerWidth)-w-12));let top=r.bottom+8;
    tip.style.left=`${left}px`;tip.style.top=`${top}px`;requestAnimationFrame(()=>{const tr=tip.getBoundingClientRect(),vh=doc.defaultView?.innerHeight||window.innerHeight;if(tr.bottom>vh-10)tip.style.top=`${Math.max(10,r.top-tr.height-8)}px`;});
  }
  function hideTip(doc,el){const tip=doc.getElementById('atlas-indicator-methodology-tip');if(tip)tip.dataset.open='0';if(el)delete el.dataset.atlasMethodOpen;}
  function attachDoc(doc){
    if(!doc||doc.__atlasIndicatorMethodology0910)return;doc.__atlasIndicatorMethodology0910=true;
    const over=e=>{const el=e.target?.closest?.('[data-atlas-indicator-keys]');if(el)showTip(doc,el);};
    const out=e=>{const el=e.target?.closest?.('[data-atlas-indicator-keys]');if(el&&!el.contains(e.relatedTarget))hideTip(doc,el);};
    doc.addEventListener('pointerover',over,true);doc.addEventListener('pointerout',out,true);doc.addEventListener('focusin',over,true);doc.addEventListener('focusout',out,true);
  }
  function attachFrame(frame){
    if(!frame||frame.dataset.atlasIndicatorFrame==='1')return;frame.dataset.atlasIndicatorFrame='1';
    const apply=()=>{try{const doc=frame.contentDocument;if(!doc)return;if(!doc.querySelector('link[data-atlas-indicator-css]')){const link=doc.createElement('link');link.rel='stylesheet';link.href=CSS_URL;link.dataset.atlasIndicatorCss='1';doc.head?.appendChild(link);}attachDoc(doc);scan(doc);}catch{}};
    frame.addEventListener('load',()=>setTimeout(apply,30));apply();
  }
  function attachFrames(doc=document){for(const f of doc.querySelectorAll?.('iframe')||[])attachFrame(f);}
  let scheduled=0;
  function refresh(root=document){
    if(scheduled)cancelAnimationFrame(scheduled);scheduled=requestAnimationFrame(()=>{scheduled=0;try{attachDoc(document);scan(root);}catch(error){console.warn('[ATLAS indicators 0.91.0]',error);}});
  }
  function scheduleBursts(){refresh();setTimeout(()=>refresh(),180);setTimeout(()=>refresh(),850);setTimeout(()=>refresh(),2400);}
  ['hashchange','popstate','pageshow','focus'].forEach(name=>window.addEventListener(name,()=>refresh(),{passive:true}));
  ['atlas:render','atlas:viewchange','atlas:navigate','atlas:data','atlas:nav-refresh'].forEach(name=>window.addEventListener(name,()=>refresh()));
  document.addEventListener('click',()=>setTimeout(()=>refresh(),40),true);document.addEventListener('change',()=>setTimeout(()=>refresh(),40),true);
  const API={version:VERSION,catalog:CATALOG,compute,refresh,scan,normalizeVisibleText,technicalAliases:{IPA:['IPA3','ipa3','ipa3_*']},policy:{visibleName:'IPA',technicalAlias:'IPA3',missingIsNotZero:true,priorityIsNotLaftProbability:true}};
  window.ATLAS_INDICATORS_V1=CATALOG;window.AtlasIndicatorMethodologyV1=API;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleBursts,{once:true});else scheduleBursts();
})();

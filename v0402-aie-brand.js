(function(){
  'use strict';

  const VERSION=String(document.documentElement.getAttribute('data-aml-version')||window.__AML_ACTIVE_VERSION__||window.__ATLAS_ACTIVE_VERSION__||'0.42.2');
  const VERSION_LABEL=`v${VERSION}`;
  const BRAND_SVG=`<svg class="atlas-aie-logo" viewBox="0 0 64 64" role="img" aria-label="AIE · Inteligencia Estratégica" focusable="false">
    <g fill="none" stroke="var(--atlas-logo-line)" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8.5 18.5C16.4 8.2 30.5 4.4 42.8 7.8" stroke-width="2.6" opacity=".94"/>
      <path d="M17.3 13.7C24.7 9.5 33.7 8.4 40.4 9.7" stroke-width="1.55" opacity=".72"/>
      <path d="M15.2 50.2C24.0 57.7 38.5 57.7 48.8 48.0" stroke-width="2.6" opacity=".92"/>
      <path d="M27.2 55.2C35.3 55.0 42.5 51.4 47.5 45.2" stroke-width="1.55" opacity=".68"/>
      <path d="M15.4 28.3L25.2 32.1M22.5 19.1L28.8 27.2M19.5 44.0L27.0 38.6M31.6 42.5V49.6M40.5 33.7L47.7 34.1M36.9 27.6L42.0 21.0" stroke-width="2.75"/>
      <circle cx="31.7" cy="34" r="9.4" stroke-width="3.1"/>
      <circle cx="21" cy="16.3" r="3.8" stroke-width="2.7"/>
      <circle cx="31.7" cy="53.2" r="3.6" stroke-width="2.7"/>
      <circle cx="50.6" cy="34.1" r="3.8" stroke-width="2.7"/>
    </g>
    <circle cx="12.7" cy="27.0" r="4.8" fill="var(--atlas-logo-node)"/>
    <circle cx="17.5" cy="46.8" r="4.5" fill="var(--atlas-logo-node)"/>
    <g>
      <circle cx="46.6" cy="15.8" r="7.15" fill="var(--atlas-logo-orange)"/>
      <circle cx="46.6" cy="15.8" r="3.15" fill="none" stroke="#fff" stroke-width="1.3"/>
      <path d="M46.6 10.4v2.35M46.6 18.85v2.35M41.2 15.8h2.35M49.65 15.8H52" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>
      <circle cx="46.6" cy="15.8" r=".8" fill="#fff"/>
    </g>
  </svg>`;

  function setText(el,value){if(el&&el.textContent!==value)el.textContent=value;}
  function setAttr(el,name,value){if(el&&el.getAttribute(name)!==value)el.setAttribute(name,value);}
  function setData(el,name,value){if(el&&el.dataset[name]!==value)el.dataset[name]=value;}

  function apply(){
    document.querySelectorAll('.v019-brand').forEach(brand=>{
      const mark=brand.querySelector('.mark');
      if(mark){
        if(!mark.querySelector('.atlas-aie-logo'))mark.innerHTML=BRAND_SVG;
        setAttr(mark,'aria-label','AIE · Inteligencia Estratégica');
        setAttr(mark,'title','AIE · Inteligencia Estratégica');
      }
      const strong=brand.querySelector('strong');
      setText(strong,'ATLAS AML');
      const small=brand.querySelector('small');
      if(small){
        setText(small,VERSION_LABEL);
        setData(small,'activeVersion',VERSION);
        setAttr(small,'aria-label',`Versión ${VERSION}`);
      }
    });

    document.querySelectorAll('.brand-copy strong,.v18-brand strong').forEach(el=>setText(el,'ATLAS AML'));
    document.querySelectorAll('.brand-copy span,.brand-copy small,.v18-brand small').forEach(el=>{
      if(!el.closest('.v18-session')){
        setText(el,VERSION_LABEL);
        setData(el,'activeVersion',VERSION);
      }
    });
    window.__ATLAS_AIE_BRAND_HEALTH__={status:'ready',version:VERSION,mutationPolicy:'CHILD_INSERTIONS_ONLY_NO_CHARACTERDATA_LOOP',checkedAt:new Date().toISOString()};
  }

  let queued=false;
  function queue(){
    if(queued)return;
    queued=true;
    queueMicrotask(()=>{queued=false;apply();});
  }

  apply();
  const root=document.querySelector('#app')||document.body;
  if(root){
    const observer=new MutationObserver((records)=>{
      if(records.some(r=>r.type==='childList'&&(r.addedNodes?.length||r.removedNodes?.length)))queue();
    });
    observer.observe(root,{childList:true,subtree:true});
  }
  window.addEventListener('atlas:themechange',queue);
  for(const ms of [0,120,500,1500,4000,8000])setTimeout(apply,ms);
})();

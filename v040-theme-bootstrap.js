(function(){
  'use strict';

  const KEY='atlas-aml:theme:v1';
  let theme='dark';
  try{
    const saved=localStorage.getItem(KEY);
    if(saved==='light'||saved==='dark')theme=saved;
  }catch{}
  document.documentElement.setAttribute('data-atlas-theme',theme);
  document.documentElement.style.colorScheme=theme;

  /* Radar Integrado graphics integrity assets.
   * They are same-origin external resources so the strict style-src 'self'
   * policy remains intact. The JS loads after DOMContentLoaded, when v0.36
   * rendering functions and the application shell already exist.
   */
  function ensureGraphIntegrityAssets(){
    if(!document.querySelector('link[data-atlas-graphics-fix]')){
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href='./v0401-radar-graphics-fix.css?b=0401';
      link.dataset.atlasGraphicsFix='0401';
      document.head.appendChild(link);
    }
    const loadScript=()=>{
      if(document.querySelector('script[data-atlas-graphics-fix]')||window.__ATLAS_RADAR_GRAPHICS_FIX__)return;
      const script=document.createElement('script');
      script.src='./v0401-radar-graphics-fix.js?b=0401';
      script.dataset.atlasGraphicsFix='0401';
      script.async=false;
      document.head.appendChild(script);
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadScript,{once:true});
    else loadScript();
  }
  ensureGraphIntegrityAssets();

  /* AIE identity mark for ATLAS AML.
   * Keeps the current ATLAS version and replaces the legacy blue "A" tile.
   * The mark adapts its metallic tones to the active light/dark theme while
   * preserving the orange strategic-intelligence target accent.
   */
  const VERSION=document.documentElement.getAttribute('data-aml-version')||'0.39.0';
  const STYLE_ID='atlas-aie-brand-style-v0401';
  const BRAND_SVG=`
    <svg class="atlas-aie-logo" viewBox="0 0 64 64" role="img" aria-label="AIE · Inteligencia Estratégica" focusable="false">
      <g fill="none" stroke="var(--atlas-logo-line)" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9.5 18.2C17.2 7.9 31.1 3.9 43.1 7.2" stroke-width="2.3" opacity=".92"/>
        <path d="M17.2 13.6C24.1 9.2 33.4 7.9 40.6 9.3" stroke-width="1.45" opacity=".70"/>
        <path d="M16.0 51.5C25.0 59.0 39.4 58.7 49.4 48.7" stroke-width="2.3" opacity=".90"/>
        <path d="M28.3 56.2C36.9 56.1 44.6 52.2 49.3 45.5" stroke-width="1.45" opacity=".66"/>

        <path d="M16.4 28.7L25.2 32.9" stroke-width="2.5"/>
        <path d="M23.0 19.4L28.8 27.8" stroke-width="2.5"/>
        <path d="M20.4 44.4L27.2 39.0" stroke-width="2.5"/>
        <path d="M31.8 43.0L31.7 50.0" stroke-width="2.5"/>
        <path d="M41.2 34.2L47.2 34.7" stroke-width="2.5"/>
        <path d="M37.1 28.1L42.0 21.4" stroke-width="2.5"/>

        <circle cx="32" cy="35" r="9.3" stroke-width="3.1"/>
        <circle cx="21" cy="16.2" r="3.8" stroke-width="2.6"/>
        <circle cx="31.7" cy="53.8" r="3.5" stroke-width="2.6"/>
        <circle cx="51" cy="35" r="3.8" stroke-width="2.6"/>
      </g>

      <circle cx="13.1" cy="27.1" r="4.7" fill="var(--atlas-logo-node)"/>
      <circle cx="18.0" cy="47.0" r="4.35" fill="var(--atlas-logo-node)"/>

      <g class="atlas-aie-target">
        <circle cx="47" cy="16" r="7.0" fill="var(--atlas-logo-orange)"/>
        <circle cx="47" cy="16" r="3.25" fill="none" stroke="#fff" stroke-width="1.25"/>
        <path d="M47 10.6v2.25M47 19.15v2.25M41.6 16h2.25M50.15 16h2.25" fill="none" stroke="#fff" stroke-width="1.25" stroke-linecap="round"/>
        <circle cx="47" cy="16" r=".85" fill="#fff"/>
      </g>
    </svg>`;

  function ensureBrandStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .v019-brand{
        grid-template-columns:46px minmax(0,1fr)!important;
        column-gap:10px!important;
      }
      .v019-brand .mark{
        grid-row:1/3!important;
        width:46px!important;
        height:46px!important;
        min-width:46px!important;
        padding:0!important;
        display:grid!important;
        place-items:center!important;
        border:0!important;
        border-radius:0!important;
        background:transparent!important;
        box-shadow:none!important;
        color:inherit!important;
        overflow:visible!important;
      }
      .v019-brand .mark .atlas-aie-logo{
        --atlas-logo-line:#d4d7da;
        --atlas-logo-node:#aeb4ba;
        --atlas-logo-orange:#ff7900;
        width:46px!important;
        height:46px!important;
        display:block!important;
        overflow:visible!important;
        filter:drop-shadow(0 4px 9px rgba(0,0,0,.18));
      }
      html[data-atlas-theme="light"] .v019-brand .mark .atlas-aie-logo{
        --atlas-logo-line:#70767b;
        --atlas-logo-node:#8d9398;
        filter:none;
      }
      .v019-brand small{
        margin-top:3px!important;
        max-width:none!important;
        white-space:nowrap!important;
        font-size:9px!important;
        line-height:1!important;
        font-weight:750!important;
        letter-spacing:.08em!important;
        opacity:.78!important;
      }
      @media (max-width:980px){
        .v019-brand{grid-template-columns:43px minmax(0,1fr)!important;column-gap:9px!important;}
        .v019-brand .mark,.v019-brand .mark .atlas-aie-logo{width:43px!important;height:43px!important;min-width:43px!important;}
      }
    `;
    document.head.appendChild(style);
  }

  function applyBrandMark(){
    ensureBrandStyle();
    document.querySelectorAll('.v019-brand').forEach(brand=>{
      const mark=brand.querySelector('.mark');
      if(mark&&!mark.querySelector('.atlas-aie-logo')){
        mark.innerHTML=BRAND_SVG;
        mark.setAttribute('aria-label','AIE · Inteligencia Estratégica');
        mark.setAttribute('title','AIE · Inteligencia Estratégica');
      }
      const strong=brand.querySelector('strong');
      if(strong&&strong.textContent!=='ATLAS AML')strong.textContent='ATLAS AML';
      const small=brand.querySelector('small');
      const versionLabel=`v${VERSION}`;
      if(small&&small.textContent!==versionLabel){
        small.textContent=versionLabel;
        small.dataset.activeVersion=VERSION;
        small.setAttribute('aria-label',`Versión ${VERSION}`);
      }
    });
  }

  let queued=false;
  function queueBrandApply(){
    if(queued)return;
    queued=true;
    queueMicrotask(()=>{
      queued=false;
      applyBrandMark();
    });
  }

  function startBrandLayer(){
    applyBrandMark();
    const root=document.querySelector('#app')||document.body;
    if(root){
      const observer=new MutationObserver(queueBrandApply);
      observer.observe(root,{childList:true,subtree:true});
    }
    window.addEventListener('atlas:themechange',queueBrandApply);
    for(const ms of [80,240,650,1400,3000,5200])setTimeout(applyBrandMark,ms);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startBrandLayer,{once:true});
  else startBrandLayer();
})();

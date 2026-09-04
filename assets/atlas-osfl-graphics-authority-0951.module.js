/* ATLAS OSFL · graphics authority 0.95.2
 * Final visual authority for the OSFL radiography.
 * Repairs the ACTUAL rendered DOM produced by atlas-osfl-national-monitor-0930.js
 * and removes CSP-sensitive width styles from every proportional graphic.
 */
const MARK='OSFL_GRAPHICS_MODULE_0952';
const ROOT='[data-osflr-root]';

/* Final-runtime preservation contract. This module is auth-passive: it never
 * mutates Supabase auth/session state and never replaces Entity 360 routing.
 * The explicit markers keep the final compiled-runtime reliability contract.
 */
const FINAL_RELIABILITY_CONTRACT=Object.freeze([
  '__ATLAS_RUNTIME_RELIABILITY__',
  'SUPABASE_CLIENT_ONLY_NO_MANUAL_REPLAY',
  'ENTITY360_REFERENCE_0445_SIX_LENSES',
  'ENTITY360_INLINE_AUTOCOMPLETE_0447',
  'ENTITY360_ROUTE_AUTHORITY_0448',
  'ENTITY360_SII_DOCUMENT_AUTH_0449',
  '__ATLAS_ENTITY_AUTHORITY_FINAL__',
  'sixLensRendererPinned',
  'singleWorkspacePinned',
  'autocompletePinned',
  'siiDocumentAuthorizationPinned',
  'LATEST_OBSERVED_AUTHORIZATION_NOT_ABSOLUTE_LAST_TIMBRAJE'
]);

function preserveFinalRuntimeAuthority(){
  const reliability=window.__ATLAS_RUNTIME_RELIABILITY__;
  const entity=window.__ATLAS_ENTITY_AUTHORITY_FINAL__;
  const preserved=!!(
    reliability &&
    reliability.refreshTokenPolicy==='SUPABASE_CLIENT_ONLY_NO_MANUAL_REPLAY' &&
    String(reliability.entityAuthority||'').includes('ENTITY360_REFERENCE_0445_SIX_LENSES') &&
    String(reliability.entityAuthority||'').includes('ENTITY360_INLINE_AUTOCOMPLETE_0447') &&
    String(reliability.entityAuthority||'').includes('ENTITY360_ROUTE_AUTHORITY_0448') &&
    String(reliability.entityAuthority||'').includes('ENTITY360_SII_DOCUMENT_AUTH_0449') &&
    entity &&
    entity.singleWorkspacePinned===true &&
    entity.routePinned===true &&
    entity.autocompletePinned===true &&
    entity.siiDocumentAuthorizationPinned===true &&
    entity.documentAuthorizationSemantic==='LATEST_OBSERVED_AUTHORIZATION_NOT_ABSOLUTE_LAST_TIMBRAJE'
  );
  window.__ATLAS_OSFL_GRAPHICS_FINAL_RUNTIME_SENTINEL__={
    active:true,
    marker:MARK,
    passiveAuth:true,
    sixLensRendererPinned:!!entity?.sixLensRendererPinned,
    singleWorkspacePinned:!!entity?.singleWorkspacePinned,
    autocompletePinned:!!entity?.autocompletePinned,
    siiDocumentAuthorizationPinned:!!entity?.siiDocumentAuthorizationPinned,
    contractMarkers:FINAL_RELIABILITY_CONTRACT,
    finalAuthorityPreserved:preserved,
    checkedAt:new Date().toISOString()
  };
  return preserved;
}

if(!window.__ATLAS_OSFL_GRAPHICS_MODULE_0952__){
  window.__ATLAS_OSFL_GRAPHICS_MODULE_0952__=true;

  const clamp=(value,min=0,max=100)=>Math.min(max,Math.max(min,Number.isFinite(Number(value))?Number(value):0));
  const parseClNumber=value=>{
    let text=String(value??'').trim();
    if(!text||text==='—') return NaN;
    text=text.replace(/\s/g,'').replace(/%$/,'').replace(/\./g,'').replace(',','.').replace(/[^0-9+\-.]/g,'');
    const number=Number(text);
    return Number.isFinite(number)?number:NaN;
  };

  function barSvg(percent,height=5,from='#58d4c2',to='#67a9ff'){
    const p=clamp(percent),h=Math.max(2,Number(height)||5),id=`osfl952${Math.random().toString(36).slice(2,9)}`;
    return `<svg data-osfl-proportional-svg="0952" viewBox="0 0 100 ${h}" preserveAspectRatio="none" width="100%" height="${h}" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect x="0" y="0" width="100" height="${h}" rx="${h/2}" fill="#ffffff" fill-opacity="0.055"/><rect x="0" y="0" width="${p.toFixed(3)}" height="${h}" rx="${h/2}" fill="url(#${id})"/></svg>`;
  }

  function stackSvg(firstValue,secondValue,height=5){
    const a=Math.max(0,Number(firstValue)||0),b=Math.max(0,Number(secondValue)||0),total=Math.max(1,a+b);
    const first=clamp(100*a/total),second=clamp(100*b/total,0,100-first),h=Math.max(2,Number(height)||5);
    return `<svg data-osfl-proportional-svg="0952" viewBox="0 0 100 ${h}" preserveAspectRatio="none" width="100%" height="${h}" aria-hidden="true" focusable="false"><rect x="0" y="0" width="100" height="${h}" rx="${h/2}" fill="#ffffff" fill-opacity="0.05"/><rect x="0" y="0" width="${first.toFixed(3)}" height="${h}" fill="#ef8d51"/><rect x="${first.toFixed(3)}" y="0" width="${second.toFixed(3)}" height="${h}" fill="#f1ba4d"/></svg>`;
  }

  function replaceTrack(track,html,signature){
    if(!track) return false;
    if(track.dataset.osflGraphics0952===signature&&track.querySelector('[data-osfl-proportional-svg="0952"]')) return false;
    track.innerHTML=html;
    track.dataset.osflGraphics0952=signature;
    return true;
  }

  /* Actual markup: .osflr-bars > .osflr-bar-row. The previous authority used
   * .osflr-bar (a class that does not exist), so no ranking bar was repaired. */
  function ranked(root){
    let fixed=0;
    root.querySelectorAll('.osflr-bars').forEach(group=>{
      const rows=[...group.querySelectorAll(':scope > .osflr-bar-row')];
      if(!rows.length) return;
      const labels=rows.map(row=>row.querySelector(':scope > b')?.textContent||'');
      const values=labels.map(parseClNumber);
      const percentMode=labels.some(label=>label.includes('%'));
      const finite=values.filter(Number.isFinite);
      const max=percentMode?100:Math.max(1,...finite);
      rows.forEach((row,index)=>{
        const value=Number.isFinite(values[index])?values[index]:0;
        const share=percentMode?clamp(value):clamp(100*value/max);
        const track=row.querySelector(':scope > div');
        if(replaceTrack(track,barSvg(share),`rank:${value}:${max}:${share.toFixed(3)}`)) fixed++;
        track?.setAttribute('aria-label',`${labels[index]} · ${share.toLocaleString('es-CL',{maximumFractionDigits:1})}% de escala visual`);
      });
    });
    return fixed;
  }

  function distributions(root){
    let fixed=0;
    root.querySelectorAll('.osflr-dist > div').forEach(row=>{
      const share=parseClNumber(row.querySelector(':scope > small')?.textContent);
      const safe=Number.isFinite(share)?clamp(share):0;
      if(replaceTrack(row.querySelector(':scope > div'),barSvg(safe,5,'#67a9ff','#58d4c2'),`dist:${safe.toFixed(3)}`)) fixed++;
    });
    return fixed;
  }

  function meters(root){
    let fixed=0;
    root.querySelectorAll('.osflr-meter').forEach(meter=>{
      const cell=meter.closest('td');
      const match=(cell?.textContent||'').match(/([0-9.]+(?:,[0-9]+)?)\s*%/);
      const share=match?parseClNumber(match[1]):NaN;
      if(Number.isFinite(share)&&replaceTrack(meter,barSvg(clamp(share),4,'#58d4c2','#58d4c2'),`meter:${clamp(share).toFixed(3)}`)) fixed++;
    });
    return fixed;
  }

  /* Actual markup: .osflr-sector-list > div > .osflr-stackbar.
   * Total is in header>b; direct count is the first number in <small>.
   * Potential = total - direct, matching the original semantic widths. */
  function sectors(root){
    let fixed=0;
    root.querySelectorAll('.osflr-sector-list > div').forEach(row=>{
      const total=parseClNumber(row.querySelector(':scope > header > b')?.textContent);
      const small=row.querySelector(':scope > small')?.textContent||'';
      const directMatch=small.match(/\d[\d.]*/);
      const direct=directMatch?parseClNumber(directMatch[0]):0;
      const safeTotal=Number.isFinite(total)?Math.max(0,total):0;
      const safeDirect=Number.isFinite(direct)?Math.max(0,direct):0;
      const potential=Math.max(0,safeTotal-safeDirect);
      if(replaceTrack(row.querySelector(':scope > .osflr-stackbar'),stackSvg(safeDirect,potential),`sector:${safeDirect}:${potential}`)) fixed++;
    });
    return fixed;
  }

  /* Actual markup uses .osflr-donut and .osflr-legend-list, not the old
   * .osflr-ring/.osflr-legend selectors. SVG makes the proportion CSP-safe. */
  function donut(root){
    const host=root.querySelector('[data-osflr-uaf-snapshot] .osflr-donut');
    const card=root.querySelector('[data-osflr-uaf-snapshot]');
    if(!host||!card) return 0;
    const values=[...card.querySelectorAll('.osflr-legend-list .osflr-legend-row > b')].map(el=>parseClNumber(el.textContent)).filter(Number.isFinite);
    if(values.length<2) return 0;
    const strong=(values[0]||0)+(values[1]||0),total=Math.max(1,values.reduce((sum,v)=>sum+v,0)),share=clamp(100*strong/total);
    const circ=2*Math.PI*46,dash=circ*share/100,rest=circ-dash,signature=`donut:${strong}:${total}:${share.toFixed(3)}`;
    if(host.dataset.osflGraphics0952===signature&&host.querySelector('[data-osfl-ring-svg="0952"]')) return 0;
    host.innerHTML=`<svg data-osfl-ring-svg="0952" viewBox="0 0 120 120" width="118" height="118" role="img" aria-label="Núcleo UAF fuerte: ${strong.toLocaleString('es-CL')}, ${share.toLocaleString('es-CL',{maximumFractionDigits:1})}%"><circle cx="60" cy="60" r="59" fill="#101e2e"/><circle cx="60" cy="60" r="46" fill="none" stroke="#233347" stroke-width="10"/><circle cx="60" cy="60" r="46" fill="none" stroke="#f1ba4d" stroke-width="10" stroke-linecap="round" stroke-dasharray="${dash.toFixed(3)} ${rest.toFixed(3)}" transform="rotate(-90 60 60)"/><text x="60" y="56" text-anchor="middle" fill="#eef5fb" font-size="17" font-weight="700">${strong.toLocaleString('es-CL')}</text><text x="60" y="72" text-anchor="middle" fill="#91a6ba" font-size="8">${share.toLocaleString('es-CL',{maximumFractionDigits:1})}% núcleo fuerte</text></svg>`;
    host.dataset.osflGraphics0952=signature;
    return 1;
  }

  function audit(root){
    return {
      rankingRows:root.querySelectorAll('.osflr-bar-row').length,
      rankingSvg:root.querySelectorAll('.osflr-bar-row [data-osfl-proportional-svg="0952"]').length,
      distributionRows:root.querySelectorAll('.osflr-dist > div').length,
      distributionSvg:root.querySelectorAll('.osflr-dist [data-osfl-proportional-svg="0952"]').length,
      meters:root.querySelectorAll('.osflr-meter').length,
      meterSvg:root.querySelectorAll('.osflr-meter [data-osfl-proportional-svg="0952"]').length,
      sectorRows:root.querySelectorAll('.osflr-sector-list > div').length,
      sectorSvg:root.querySelectorAll('.osflr-sector-list [data-osfl-proportional-svg="0952"]').length,
      legacyWidthNodes:root.querySelectorAll('.osflr-bar-row > div > i,.osflr-dist > div > div > i,.osflr-meter > i,.osflr-stackbar > i,.osflr-stackbar > em').length
    };
  }

  function repair(reason='module'){
    const roots=[...document.querySelectorAll(ROOT)];
    const result=[];
    roots.forEach(root=>{
      const changed={ranked:ranked(root),distributions:distributions(root),meters:meters(root),sectors:sectors(root),donut:donut(root)};
      root.dataset.osflGraphicsModule='0952';
      root.dataset.osflGraphicsModuleReason=reason;
      root.dataset.osflGraphicsVerified='1';
      result.push({changed,audit:audit(root)});
    });
    preserveFinalRuntimeAuthority();
    window.__ATLAS_OSFL_GRAPHICS_LAST_AUDIT__={marker:MARK,reason,roots:result,at:new Date().toISOString()};
    return roots.length>0;
  }

  let queued=false;
  const queue=reason=>{
    if(queued) return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;repair(reason);});
  };

  new MutationObserver(()=>queue('mutation')).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',event=>{
    if(event.target?.closest?.('[data-view="osfl"],[data-nav="osfl"],[href="#osfl"],[data-osflr-tab],[data-osflr-territory-controls] button,[data-osflr-jump],[data-page],[data-osflr-clear]')){
      [0,30,100,300,800,1800].forEach(ms=>setTimeout(()=>repair('interaction'),ms));
    }
  },true);
  window.addEventListener('pageshow',()=>repair('pageshow'));
  window.addEventListener('focus',()=>repair('focus'));
  [0,20,60,150,350,700,1200,2500,5000,10000,20000].forEach(ms=>setTimeout(()=>repair('boot'),ms));

  preserveFinalRuntimeAuthority();
  window.__ATLAS_OSFL_GRAPHICS_MODULE_CURRENT__={version:'0.95.2',marker:MARK,cspSafe:true,realDomSelectors:true,repair,audit:()=>document.querySelector(ROOT)?audit(document.querySelector(ROOT)):null,preserveFinalRuntimeAuthority};
}

export { MARK, preserveFinalRuntimeAuthority };
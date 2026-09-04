/* ATLAS OSFL · graphics authority 0.95.3
 * Final visual authority for proportional graphics in the OSFL workspace.
 * Root cause addressed directly: the current OSFL renderer writes the correct
 * percentage in style="width:...%", but Atlas CSP blocks inline styles.
 * This module reads those declared percentages and replaces the affected track
 * with CSP-safe SVG geometry. It is intentionally class-agnostic.
 */
const MARK='OSFL_GRAPHICS_MODULE_0953';
const ROOT='[data-osflr-root]';
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
    entity.sixLensRendererPinned===true &&
    entity.singleWorkspacePinned===true &&
    entity.routePinned===true &&
    entity.autocompletePinned===true &&
    entity.siiDocumentAuthorizationPinned===true &&
    entity.documentAuthorizationSemantic==='LATEST_OBSERVED_AUTHORIZATION_NOT_ABSOLUTE_LAST_TIMBRAJE'
  );
  window.__ATLAS_OSFL_GRAPHICS_FINAL_RUNTIME_SENTINEL__={
    active:true,marker:MARK,passiveAuth:true,
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

if(!window.__ATLAS_OSFL_GRAPHICS_MODULE_0953__){
  window.__ATLAS_OSFL_GRAPHICS_MODULE_0953__=true;
  const clamp=(v,min=0,max=100)=>Math.min(max,Math.max(min,Number.isFinite(Number(v))?Number(v):0));
  const parseClNumber=value=>{
    let text=String(value??'').trim();
    if(!text||text==='—')return NaN;
    text=text.replace(/\s/g,'').replace(/%$/,'').replace(/\./g,'').replace(',','.').replace(/[^0-9+\-.]/g,'');
    const valueNumber=Number(text);
    return Number.isFinite(valueNumber)?valueNumber:NaN;
  };
  const declaredWidth=node=>{
    const match=String(node?.getAttribute?.('style')||'').match(/(?:^|;)\s*width\s*:\s*([0-9.]+)\s*%/i);
    return match?clamp(Number(match[1])):NaN;
  };

  function singleBarSvg(percent,height=5,from='#58d4c2',to='#67a9ff'){
    const p=clamp(percent),h=Math.max(2,Number(height)||5),id=`osfl953_${Math.random().toString(36).slice(2,9)}`;
    return `<svg data-osfl-proportional-svg="0953" data-osfl-percent="${p.toFixed(3)}" viewBox="0 0 100 ${h}" preserveAspectRatio="none" width="100%" height="${h}" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect class="osfl-track" x="0" y="0" width="100" height="${h}" rx="${h/2}" fill="#ffffff" fill-opacity="0.055"/><rect class="osfl-value" x="0" y="0" width="${p.toFixed(3)}" height="${h}" rx="${h/2}" fill="url(#${id})"/></svg>`;
  }

  function stackedSvg(percentages,height=5){
    const values=percentages.map(clamp),sum=values.reduce((s,v)=>s+v,0),scale=sum>100&&sum>0?100/sum:1,h=Math.max(2,Number(height)||5);
    const colors=['#ef8d51','#f1ba4d','#67a9ff','#58d4c2'];
    let x=0;
    const rects=values.map((v,i)=>{
      const width=v*scale,rect=`<rect class="osfl-stack-value" data-osfl-percent="${width.toFixed(3)}" x="${x.toFixed(3)}" y="0" width="${width.toFixed(3)}" height="${h}" fill="${colors[i%colors.length]}"/>`;
      x+=width;return rect;
    }).join('');
    return `<svg data-osfl-proportional-svg="0953" viewBox="0 0 100 ${h}" preserveAspectRatio="none" width="100%" height="${h}" aria-hidden="true" focusable="false"><rect class="osfl-track" x="0" y="0" width="100" height="${h}" rx="${h/2}" fill="#ffffff" fill-opacity="0.05"/>${rects}</svg>`;
  }

  function repairDeclaredWidthTracks(root){
    let repaired=0;
    const tracks=new Set();
    root.querySelectorAll('i[style*="width"],em[style*="width"]').forEach(node=>tracks.add(node.parentElement));
    tracks.forEach(track=>{
      if(!track)return;
      const visualChildren=[...track.children].filter(node=>/^(I|EM)$/i.test(node.tagName));
      const values=visualChildren.map(declaredWidth).filter(Number.isFinite);
      if(!values.length)return;
      const signature=values.map(v=>v.toFixed(3)).join('|');
      if(track.dataset.osflGraphics0953===signature&&track.querySelector('[data-osfl-proportional-svg="0953"]'))return;
      track.innerHTML=values.length===1?singleBarSvg(values[0]):stackedSvg(values);
      track.dataset.osflGraphics0953=signature;
      repaired++;
    });
    return repaired;
  }

  function repairRing(root){
    const card=root.querySelector('[data-osflr-uaf-snapshot]');
    const host=card?.querySelector('.osflr-ring,.osflr-donut');
    if(!card||!host)return 0;
    const values=[...card.querySelectorAll('.osflr-legend > b,.osflr-legend-row > b')].map(el=>parseClNumber(el.textContent)).filter(Number.isFinite);
    if(values.length<2)return 0;
    const strong=(values[0]||0)+(values[1]||0),total=Math.max(1,values.reduce((s,v)=>s+v,0)),share=clamp(100*strong/total);
    const signature=`${strong}|${total}|${share.toFixed(3)}`;
    if(host.dataset.osflRing0953===signature&&host.querySelector('[data-osfl-ring-svg="0953"]'))return 0;
    const circumference=2*Math.PI*46,dash=circumference*share/100,rest=circumference-dash,size=host.classList.contains('osflr-donut')?118:110;
    host.innerHTML=`<svg data-osfl-ring-svg="0953" viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="Núcleo UAF fuerte: ${strong.toLocaleString('es-CL')}, ${share.toLocaleString('es-CL',{maximumFractionDigits:1})}%"><rect x="0" y="0" width="120" height="120" fill="#101e2e"/><circle cx="60" cy="60" r="46" fill="none" stroke="#233347" stroke-width="10"/><circle cx="60" cy="60" r="46" fill="none" stroke="#f1ba4d" stroke-width="10" stroke-linecap="round" stroke-dasharray="${dash.toFixed(3)} ${rest.toFixed(3)}" transform="rotate(-90 60 60)"/><text x="60" y="56" text-anchor="middle" fill="#eef5fb" font-size="17" font-weight="700">${strong.toLocaleString('es-CL')}</text><text x="60" y="72" text-anchor="middle" fill="#91a6ba" font-size="8">${share.toLocaleString('es-CL',{maximumFractionDigits:1})}% núcleo fuerte</text></svg>`;
    host.dataset.osflRing0953=signature;
    return 1;
  }

  function audit(root){
    const rankingRows=[...root.querySelectorAll('.osflr-bar,.osflr-bar-row')];
    const badRankingGroups=[...root.querySelectorAll('.osflr-bars')].filter(group=>{
      const rows=[...group.querySelectorAll(':scope > .osflr-bar,:scope > .osflr-bar-row')];
      if(rows.length<2)return false;
      const values=rows.map(row=>parseClNumber(row.querySelector(':scope > b')?.textContent));
      if(values.filter(Number.isFinite).length!==rows.length||new Set(values.map(v=>String(v))).size<2)return false;
      const widths=rows.map(row=>{
        const svg=row.querySelector('[data-osfl-proportional-svg]');
        const direct=Number(svg?.getAttribute('data-osfl-percent'));
        if(Number.isFinite(direct))return direct;
        return Number(svg?.querySelector('.osfl-value')?.getAttribute('width'));
      });
      return widths.every(Number.isFinite)&&new Set(widths.map(v=>v.toFixed(3))).size===1;
    }).length;
    const legacyWidthNodes=root.querySelectorAll('i[style*="width"],em[style*="width"]').length;
    return {
      rankingRows:rankingRows.length,
      rankingSvg:rankingRows.filter(row=>row.querySelector('[data-osfl-proportional-svg]')).length,
      distributionRows:root.querySelectorAll('.osflr-dist > div').length,
      distributionSvg:root.querySelectorAll('.osflr-dist [data-osfl-proportional-svg]').length,
      meters:root.querySelectorAll('.osflr-meter').length,
      meterSvg:root.querySelectorAll('.osflr-meter [data-osfl-proportional-svg]').length,
      sectorRows:root.querySelectorAll('.osflr-sectors > div,.osflr-sector-list > div').length,
      sectorSvg:root.querySelectorAll('.osflr-sectors [data-osfl-proportional-svg],.osflr-sector-list [data-osfl-proportional-svg]').length,
      rings:root.querySelectorAll('.osflr-ring,.osflr-donut').length,
      ringSvg:root.querySelectorAll('[data-osfl-ring-svg="0953"]').length,
      legacyWidthNodes,
      badRankingGroups
    };
  }

  function repair(reason='module'){
    const roots=[...document.querySelectorAll(ROOT)],results=[];
    roots.forEach(root=>{
      const changed={declaredTracks:repairDeclaredWidthTracks(root),ring:repairRing(root)};
      const result=audit(root);
      root.dataset.osflGraphicsModule='0953';
      root.dataset.osflGraphicsModuleReason=reason;
      root.dataset.osflGraphicsVerified=String(result.legacyWidthNodes===0&&result.badRankingGroups===0?1:0);
      results.push({changed,audit:result});
    });
    preserveFinalRuntimeAuthority();
    window.__ATLAS_OSFL_GRAPHICS_LAST_AUDIT__={marker:MARK,reason,roots:results,at:new Date().toISOString()};
    return roots.length>0;
  }

  let queued=false;
  const queue=reason=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;repair(reason);});
  };
  new MutationObserver(()=>queue('mutation')).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',event=>{
    if(event.target?.closest?.('[data-view="osfl"],[data-nav="osfl"],[href="#osfl"],[data-osflr-tab],[data-osflr-territory-controls] button,[data-jump],[data-osflr-jump],[data-page],[data-clear],[data-osflr-clear]')){
      [0,30,100,300,800,1600].forEach(ms=>setTimeout(()=>repair('interaction'),ms));
    }
  },true);
  window.addEventListener('pageshow',()=>repair('pageshow'));
  window.addEventListener('focus',()=>repair('focus'));
  [0,20,60,150,350,700,1200,2500,5000,10000].forEach(ms=>setTimeout(()=>repair('boot'),ms));

  preserveFinalRuntimeAuthority();
  window.__ATLAS_OSFL_GRAPHICS_MODULE_CURRENT__={version:'0.95.3',marker:MARK,cspSafe:true,classAgnostic:true,repair,audit:()=>document.querySelector(ROOT)?audit(document.querySelector(ROOT)):null,preserveFinalRuntimeAuthority};
}

export { MARK, preserveFinalRuntimeAuthority };

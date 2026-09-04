/* ATLAS OSFL · graphics authority 0.95.3
 * Final visual authority for every proportional graphic in the OSFL workspace.
 * Converts CSP-blocked inline width declarations into native SVG geometry.
 * Works with both current 0.95 DOM (.osflr-bar/.osflr-ring/.osflr-sectors)
 * and the alternate radiography DOM (.osflr-bar-row/.osflr-donut/.osflr-sector-list).
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
    entity && entity.singleWorkspacePinned===true && entity.routePinned===true &&
    entity.autocompletePinned===true && entity.siiDocumentAuthorizationPinned===true &&
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
    if(!text||text==='—') return NaN;
    text=text.replace(/\s/g,'').replace(/%$/,'').replace(/\./g,'').replace(',','.').replace(/[^0-9+\-.]/g,'');
    const num=Number(text);
    return Number.isFinite(num)?num:NaN;
  };
  const widthFromStyle=node=>{
    const raw=node?.getAttribute?.('style')||'';
    const match=raw.match(/width\s*:\s*([0-9.]+)\s*%/i);
    return match?clamp(Number(match[1])):NaN;
  };

  function barSvg(percent,height=5,from='#58d4c2',to='#67a9ff'){
    const p=clamp(percent),h=Math.max(2,Number(height)||5),id=`osfl953${Math.random().toString(36).slice(2,9)}`;
    return `<svg data-osfl-proportional-svg="0953" viewBox="0 0 100 ${h}" preserveAspectRatio="none" width="100%" height="${h}" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect x="0" y="0" width="100" height="${h}" rx="${h/2}" fill="#ffffff" fill-opacity="0.055"/><rect x="0" y="0" width="${p.toFixed(3)}" height="${h}" rx="${h/2}" fill="url(#${id})"/></svg>`;
  }

  function stackSvgPct(parts,height=5){
    const safe=parts.map(v=>Math.max(0,Number(v)||0));
    const total=safe.reduce((s,v)=>s+v,0)||1;
    const normalized=safe.map(v=>100*v/total);
    const h=Math.max(2,Number(height)||5);
    let x=0;
    const colors=['#ef8d51','#f1ba4d','#67a9ff','#58d4c2'];
    const rects=normalized.map((v,i)=>{const rect=`<rect x="${x.toFixed(3)}" y="0" width="${v.toFixed(3)}" height="${h}" fill="${colors[i%colors.length]}"/>`;x+=v;return rect;}).join('');
    return `<svg data-osfl-proportional-svg="0953" viewBox="0 0 100 ${h}" preserveAspectRatio="none" width="100%" height="${h}" aria-hidden="true" focusable="false"><rect x="0" y="0" width="100" height="${h}" rx="${h/2}" fill="#ffffff" fill-opacity="0.05"/>${rects}</svg>`;
  }

  function replaceTrack(track,html,signature){
    if(!track) return false;
    if(track.dataset.osflGraphics0953===signature&&track.querySelector('[data-osfl-proportional-svg="0953"]')) return false;
    track.innerHTML=html;
    track.dataset.osflGraphics0953=signature;
    return true;
  }

  /* Primary repair: use the intended percentages already present in the DOM.
   * CSP blocks those inline styles visually, but the attribute values remain readable.
   * This makes the repair independent of class naming and preserves the source ratio exactly. */
  function repairDeclaredWidths(root){
    let fixed=0;
    const parents=new Set();
    root.querySelectorAll('i[style*="width"],em[style*="width"]').forEach(node=>parents.add(node.parentElement));
    parents.forEach(track=>{
      if(!track||track.querySelector('[data-osfl-proportional-svg="0953"]')) return;
      const parts=[...track.children].filter(n=>/^(I|EM)$/i.test(n.tagName)).map(widthFromStyle).filter(Number.isFinite);
      if(!parts.length) return;
      const signature=`declared:${parts.map(v=>v.toFixed(3)).join(':')}`;
      const html=parts.length===1?barSvg(parts[0]):stackSvgPct(parts);
      if(replaceTrack(track,html,signature)) fixed++;
    });
    return fixed;
  }

  /* Fallback for any already-rendered graph whose inline children were removed by an older repair. */
  function repairRanked(root){
    let fixed=0;
    root.querySelectorAll('.osflr-bars').forEach(group=>{
      const rows=[...group.querySelectorAll(':scope > .osflr-bar,:scope > .osflr-bar-row')];
      if(!rows.length) return;
      const values=rows.map(row=>parseClNumber(row.querySelector(':scope > b')?.textContent));
      const labels=rows.map(row=>row.querySelector(':scope > b')?.textContent||'');
      const percentMode=labels.some(v=>v.includes('%'));
      const max=percentMode?100:Math.max(1,...values.filter(Number.isFinite));
      rows.forEach((row,i)=>{
        const value=Number.isFinite(values[i])?values[i]:0;
        const share=percentMode?clamp(value):clamp(100*value/max);
        const track=row.querySelector(':scope > div');
        if(replaceTrack(track,barSvg(share),`rank:${value}:${max}:${share.toFixed(3)}`)) fixed++;
        track?.setAttribute('aria-label',`${labels[i]} · ${share.toLocaleString('es-CL',{maximumFractionDigits:1})}% de escala visual`);
      });
    });
    return fixed;
  }

  function repairDistributions(root){
    let fixed=0;
    root.querySelectorAll('.osflr-dist > div').forEach(row=>{
      const share=parseClNumber(row.querySelector(':scope > small')?.textContent);
      if(!Number.isFinite(share)) return;
      if(replaceTrack(row.querySelector(':scope > div'),barSvg(clamp(share),5,'#67a9ff','#58d4c2'),`dist:${clamp(share).toFixed(3)}`)) fixed++;
    });
    return fixed;
  }

  function repairMeters(root){
    let fixed=0;
    root.querySelectorAll('.osflr-meter').forEach(meter=>{
      const text=meter.closest('td')?.textContent||meter.parentElement?.textContent||'';
      const match=text.match(/([0-9.]+(?:,[0-9]+)?)\s*%/);
      const share=match?parseClNumber(match[1]):NaN;
      if(Number.isFinite(share)&&replaceTrack(meter,barSvg(clamp(share),4,'#58d4c2','#58d4c2'),`meter:${clamp(share).toFixed(3)}`)) fixed++;
    });
    return fixed;
  }

  function repairSectors(root){
    let fixed=0;
    root.querySelectorAll('.osflr-sectors > div,.osflr-sector-list > div').forEach(row=>{
      const track=row.querySelector(':scope > .osflr-stackbar')||[...row.children].find(el=>el.tagName==='DIV'&&!el.classList.contains('osflr-card'));
      if(!track) return;
      const declared=[...track.children].filter(n=>/^(I|EM)$/i.test(n.tagName)).map(widthFromStyle).filter(Number.isFinite);
      if(declared.length){if(replaceTrack(track,stackSvgPct(declared),`sector-declared:${declared.join(':')}`)) fixed++;return;}
      const total=parseClNumber(row.querySelector(':scope > header > b')?.textContent);
      const nums=(row.querySelector(':scope > small')?.textContent||'').match(/\d[\d.]*/g)||[];
      const first=nums.length?parseClNumber(nums[0]):0;
      const safeTotal=Number.isFinite(total)?Math.max(0,total):0;
      const safeFirst=Number.isFinite(first)?Math.max(0,first):0;
      const second=Math.max(0,safeTotal-safeFirst);
      if(replaceTrack(track,stackSvgPct([safeFirst,second]),`sector:${safeFirst}:${second}`)) fixed++;
    });
    return fixed;
  }

  function ringSvg(strong,total,size=110){
    const share=clamp(100*strong/Math.max(1,total)),circ=2*Math.PI*46,dash=circ*share/100,rest=circ-dash;
    return `<svg data-osfl-ring-svg="0953" viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="Núcleo UAF fuerte: ${strong.toLocaleString('es-CL')}, ${share.toLocaleString('es-CL',{maximumFractionDigits:1})}%"><circle cx="60" cy="60" r="59" fill="#101e2e"/><circle cx="60" cy="60" r="46" fill="none" stroke="#233347" stroke-width="10"/><circle cx="60" cy="60" r="46" fill="none" stroke="#f1ba4d" stroke-width="10" stroke-linecap="round" stroke-dasharray="${dash.toFixed(3)} ${rest.toFixed(3)}" transform="rotate(-90 60 60)"/><text x="60" y="56" text-anchor="middle" fill="#eef5fb" font-size="17" font-weight="700">${strong.toLocaleString('es-CL')}</text><text x="60" y="72" text-anchor="middle" fill="#91a6ba" font-size="8">${share.toLocaleString('es-CL',{maximumFractionDigits:1})}% núcleo fuerte</text></svg>`;
  }

  function repairRings(root){
    let fixed=0;
    const cards=[...root.querySelectorAll('[data-osflr-uaf-snapshot]')];
    cards.forEach(card=>{
      const host=card.querySelector('.osflr-ring,.osflr-donut');
      if(!host) return;
      const legend=[...card.querySelectorAll('.osflr-legend > b,.osflr-legend-row > b')].map(el=>parseClNumber(el.textContent)).filter(Number.isFinite);
      if(legend.length<2) return;
      const strong=(legend[0]||0)+(legend[1]||0),total=Math.max(1,legend.reduce((s,v)=>s+v,0));
      const signature=`ring:${strong}:${total}`;
      if(host.dataset.osflGraphics0953===signature&&host.querySelector('[data-osfl-ring-svg="0953"]')) return;
      host.innerHTML=ringSvg(strong,total,host.classList.contains('osflr-donut')?118:110);
      host.dataset.osflGraphics0953=signature;
      fixed++;
    });
    return fixed;
  }

  function audit(root){
    const rankingRows=root.querySelectorAll('.osflr-bar,.osflr-bar-row').length;
    const rankingSvg=root.querySelectorAll('.osflr-bar [data-osfl-proportional-svg="0953"],.osflr-bar-row [data-osfl-proportional-svg="0953"]').length;
    const distributionRows=root.querySelectorAll('.osflr-dist > div').length;
    const distributionSvg=root.querySelectorAll('.osflr-dist [data-osfl-proportional-svg="0953"]').length;
    const meters=root.querySelectorAll('.osflr-meter').length;
    const meterSvg=root.querySelectorAll('.osflr-meter [data-osfl-proportional-svg="0953"]').length;
    const sectorRows=root.querySelectorAll('.osflr-sectors > div,.osflr-sector-list > div').length;
    const sectorSvg=root.querySelectorAll('.osflr-sectors [data-osfl-proportional-svg="0953"],.osflr-sector-list [data-osfl-proportional-svg="0953"]').length;
    const rings=root.querySelectorAll('.osflr-ring,.osflr-donut').length;
    const ringSvgCount=root.querySelectorAll('[data-osfl-ring-svg="0953"]').length;
    const legacyWidthNodes=root.querySelectorAll('i[style*="width"],em[style*="width"]').length;
    const badRankingGroups=[...root.querySelectorAll('.osflr-bars')].filter(group=>{
      const rows=[...group.querySelectorAll(':scope > .osflr-bar,:scope > .osflr-bar-row')];
      if(rows.length<2) return false;
      const vals=rows.map(r=>parseClNumber(r.querySelector(':scope > b')?.textContent)).filter(Number.isFinite);
      if(vals.length<2||new Set(vals).size<2) return false;
      const widths=rows.map(r=>Number(r.querySelector('[data-osfl-proportional-svg="0953"] rect:last-child')?.getAttribute('width'))).filter(Number.isFinite);
      return widths.length===rows.length&&new Set(widths.map(v=>v.toFixed(3))).size===1;
    }).length;
    return {rankingRows,rankingSvg,distributionRows,distributionSvg,meters,meterSvg,sectorRows,sectorSvg,rings,ringSvg:ringSvgCount,legacyWidthNodes,badRankingGroups};
  }

  function repair(reason='module'){
    const roots=[...document.querySelectorAll(ROOT)];
    const results=[];
    roots.forEach(root=>{
      const changed={
        declared:repairDeclaredWidths(root),
        ranked:repairRanked(root),
        distributions:repairDistributions(root),
        meters:repairMeters(root),
        sectors:repairSectors(root),
        rings:repairRings(root)
      };
      const check=audit(root);
      root.dataset.osflGraphicsModule='0953';
      root.dataset.osflGraphicsVerified=String(check.legacyWidthNodes===0&&check.badRankingGroups===0?1:0);
      root.dataset.osflGraphicsModuleReason=reason;
      results.push({changed,audit:check});
    });
    preserveFinalRuntimeAuthority();
    window.__ATLAS_OSFL_GRAPHICS_LAST_AUDIT__={marker:MARK,reason,roots:results,at:new Date().toISOString()};
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
    if(event.target?.closest?.('[data-view="osfl"],[data-nav="osfl"],[href="#osfl"],[data-osflr-tab],[data-osflr-territory-controls] button,[data-jump],[data-osflr-jump],[data-page],[data-clear],[data-osflr-clear]')){
      [0,30,100,300,800,1600].forEach(ms=>setTimeout(()=>repair('interaction'),ms));
    }
  },true);
  window.addEventListener('pageshow',()=>repair('pageshow'));
  window.addEventListener('focus',()=>repair('focus'));
  [0,20,60,150,350,700,1200,2500,5000,10000].forEach(ms=>setTimeout(()=>repair('boot'),ms));

  preserveFinalRuntimeAuthority();
  window.__ATLAS_OSFL_GRAPHICS_MODULE_CURRENT__={version:'0.95.3',marker:MARK,cspSafe:true,dualDom:true,genericDeclaredWidthRepair:true,repair,audit:()=>document.querySelector(ROOT)?audit(document.querySelector(ROOT)):null,preserveFinalRuntimeAuthority};
}

export { MARK, preserveFinalRuntimeAuthority };

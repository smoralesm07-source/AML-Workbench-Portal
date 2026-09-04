/* ATLAS OSFL · graphics authority 0.95.3
 * Final visual authority for proportional graphics in the OSFL workspace.
 *
 * Fixes three production defects:
 * 1) Atlas CSP blocks inline width styles used by the OSFL renderer.
 * 2) UAF sector bars encoded only internal composition, making 469 and 3 look equal.
 * 3) Regional coverage NULL was rendered as 0.0%, implying a denominator that does not exist.
 *
 * All proportional visuals are replaced with CSP-safe SVG geometry. Rankings are
 * normalized to the maximum of their group; distributions use their declared share;
 * UAF sectors use total sector magnitude while preserving direct/potential composition.
 */
const MARK='OSFL_GRAPHICS_MODULE_0953';
const ROOT='[data-osflr-root]';
const REGION_VIEW='aml_v_osfl_national_region_current';
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

  const regionalCoverage={checked:false,unavailable:false,checking:false,lastError:null};
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
  const percentText=value=>Number(value).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';

  function singleBarSvg(percent,height=5,from='#58d4c2',to='#67a9ff'){
    const p=clamp(percent),h=Math.max(2,Number(height)||5),id=`osfl953_${Math.random().toString(36).slice(2,9)}`;
    return `<svg data-osfl-proportional-svg="0953" data-osfl-percent="${p.toFixed(3)}" viewBox="0 0 100 ${h}" preserveAspectRatio="none" width="100%" height="${h}" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect class="osfl-track" x="0" y="0" width="100" height="${h}" rx="${h/2}" fill="#ffffff" fill-opacity="0.055"/><rect class="osfl-value" x="0" y="0" width="${p.toFixed(3)}" height="${h}" rx="${h/2}" fill="url(#${id})"/></svg>`;
  }

  function sectorSvg(parts,magnitude,total,height=5){
    const h=Math.max(2,Number(height)||5),mag=clamp(magnitude),raw=parts.map(clamp),sum=Math.max(1,raw.reduce((s,v)=>s+v,0));
    const widths=raw.map(v=>mag*v/sum),colors=['#ef8d51','#f1ba4d','#67a9ff','#58d4c2'];
    let x=0;
    const rects=widths.map((width,i)=>{
      const rect=`<rect class="osfl-stack-value" data-osfl-segment="${i}" x="${x.toFixed(3)}" y="0" width="${width.toFixed(3)}" height="${h}" fill="${colors[i%colors.length]}"/>`;
      x+=width;
      return rect;
    }).join('');
    return `<svg data-osfl-proportional-svg="0953" data-osfl-sector-svg="0953" data-osfl-total="${Number(total)||0}" data-osfl-magnitude="${mag.toFixed(3)}" viewBox="0 0 100 ${h}" preserveAspectRatio="none" width="100%" height="${h}" aria-hidden="true" focusable="false"><rect class="osfl-track" x="0" y="0" width="100" height="${h}" rx="${h/2}" fill="#ffffff" fill-opacity="0.05"/>${rects}</svg>`;
  }

  function repairSectorTracks(root){
    let repaired=0;
    root.querySelectorAll('.osflr-sector-list,.osflr-sectors').forEach(group=>{
      const rows=[...group.children].filter(row=>row.nodeType===1);
      const totals=rows.map(row=>parseClNumber(row.querySelector('header b')?.textContent));
      const finiteTotals=totals.filter(Number.isFinite);
      if(!finiteTotals.length)return;
      const max=Math.max(1,...finiteTotals);
      rows.forEach((row,index)=>{
        const total=totals[index];
        if(!Number.isFinite(total))return;
        const track=row.querySelector('.osflr-stackbar,[class*="stackbar"]');
        if(!track)return;
        const existing=track.querySelector('[data-osfl-sector-svg="0953"]');
        const magnitude=clamp(100*total/max);
        if(existing && Math.abs(Number(existing.getAttribute('data-osfl-magnitude'))-magnitude)<0.01)return;
        const visualChildren=[...track.children].filter(node=>/^(I|EM)$/i.test(node.tagName));
        const parts=visualChildren.map(declaredWidth).filter(Number.isFinite);
        if(parts.length<1 && existing)return;
        const effective=parts.length?parts:[100];
        track.innerHTML=sectorSvg(effective,magnitude,total);
        track.dataset.osflGraphics0953=`sector:${total}:${magnitude.toFixed(3)}`;
        repaired++;
      });
    });
    return repaired;
  }

  function repairDeclaredWidthTracks(root){
    let repaired=0;
    const tracks=new Set();
    root.querySelectorAll('i[style*="width"],em[style*="width"]').forEach(node=>{
      const track=node.parentElement;
      if(track?.matches?.('.osflr-stackbar,[class*="stackbar"]'))return;
      tracks.add(track);
    });
    tracks.forEach(track=>{
      if(!track)return;
      const visualChildren=[...track.children].filter(node=>/^(I|EM)$/i.test(node.tagName));
      const values=visualChildren.map(declaredWidth).filter(Number.isFinite);
      if(!values.length)return;
      const value=values[0];
      const signature=value.toFixed(3);
      if(track.dataset.osflGraphics0953===signature&&track.querySelector('[data-osfl-proportional-svg="0953"]'))return;
      track.innerHTML=singleBarSvg(value);
      track.dataset.osflGraphics0953=signature;
      repaired++;
    });
    return repaired;
  }

  function repairRing(root){
    const card=root.querySelector('[data-osflr-uaf-snapshot]');
    const host=card?.querySelector('.osflr-ring,.osflr-donut,.osflr-ring-svg-host');
    if(!card||!host)return 0;
    const values=[...card.querySelectorAll('.osflr-legend > b,.osflr-legend-row > b')].map(el=>parseClNumber(el.textContent)).filter(Number.isFinite);
    if(values.length<2)return 0;
    const strong=(values[0]||0)+(values[1]||0),total=Math.max(1,values.reduce((s,v)=>s+v,0)),share=clamp(100*strong/total);
    const signature=`${strong}|${total}|${share.toFixed(3)}`;
    if(host.dataset.osflRing0953===signature&&host.querySelector('[data-osfl-ring-svg="0953"]'))return 0;
    const circumference=2*Math.PI*46,dash=circumference*share/100,rest=circumference-dash,size=host.classList.contains('osflr-donut')?118:110;
    host.removeAttribute('style');
    host.classList.remove('osflr-donut','osflr-ring');
    host.classList.add('osflr-ring-svg-host');
    host.setAttribute('align','center');
    host.innerHTML=`<svg data-osfl-ring-svg="0953" data-osfl-percent="${share.toFixed(3)}" viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="Núcleo UAF fuerte: ${strong.toLocaleString('es-CL')}, ${percentText(share)}"><rect x="0" y="0" width="120" height="120" rx="60" fill="#101e2e"/><circle cx="60" cy="60" r="46" fill="none" stroke="#233347" stroke-width="10"/><circle cx="60" cy="60" r="46" fill="none" stroke="#f1ba4d" stroke-width="10" stroke-linecap="round" stroke-dasharray="${dash.toFixed(3)} ${rest.toFixed(3)}" transform="rotate(-90 60 60)"/><text x="60" y="56" text-anchor="middle" fill="#eef5fb" font-size="17" font-weight="700">${strong.toLocaleString('es-CL')}</text><text x="60" y="72" text-anchor="middle" fill="#91a6ba" font-size="8">${percentText(share)} núcleo fuerte</text></svg>`;
    host.dataset.osflRing0953=signature;
    return 1;
  }

  async function checkRegionalCoverage(){
    if(regionalCoverage.checked||regionalCoverage.checking)return regionalCoverage;
    const client=window.sb || (typeof sb!=='undefined'?sb:null);
    if(!client)return regionalCoverage;
    regionalCoverage.checking=true;
    try{
      const {data,error}=await client.from(REGION_VIEW).select('region,atlas_coverage_pct').limit(100);
      if(error)throw error;
      const values=(data||[]).map(r=>r?.atlas_coverage_pct);
      regionalCoverage.unavailable=values.length>0&&values.every(v=>v===null||v===undefined||v==='');
      regionalCoverage.checked=true;
      regionalCoverage.lastError=null;
    }catch(error){
      regionalCoverage.lastError=String(error?.message||error);
    }finally{
      regionalCoverage.checking=false;
    }
    return regionalCoverage;
  }

  function applyRegionalCoverageSemantics(root){
    if(!regionalCoverage.unavailable)return 0;
    let changed=0;
    const controls=root.querySelector('[data-osflr-territory-controls]');
    const coverageButton=controls?.querySelector('[data-metric="atlas_coverage_pct"]');
    const observedButton=controls?.querySelector('[data-metric="atlas_observed"]');
    if(coverageButton){
      if(coverageButton.classList.contains('active')&&observedButton){
        setTimeout(()=>observedButton.click(),0);
      }
      coverageButton.disabled=true;
      coverageButton.textContent='Cobertura · sin base regional';
      coverageButton.title='La referencia legal regional no está disponible; Atlas no presenta 0% como si fuera una medición válida.';
      coverageButton.setAttribute('aria-disabled','true');
      changed++;
    }
    const insightRows=[...root.querySelectorAll('[data-osflr-territory-insight] .osflr-insight-stack > div')];
    insightRows.forEach(row=>{
      const label=String(row.querySelector('span')?.textContent||'').toLowerCase();
      if(!label.includes('mayor cobertura'))return;
      const value=row.querySelector('b'),note=row.querySelector('small');
      if(value)value.textContent='—';
      if(note)note.textContent='Denominador legal regional no disponible';
      changed++;
    });
    const table=root.querySelector('[data-osflr-region-table] table');
    if(table){
      const headers=[...table.querySelectorAll('thead th')];
      const index=headers.findIndex(th=>String(th.textContent||'').trim().toLowerCase()==='cobertura');
      if(index>=0){
        headers[index].textContent='Cobertura*';
        table.querySelectorAll('tbody tr').forEach(tr=>{
          const cell=tr.children[index];
          if(cell)cell.innerHTML='<span class="osflr-chip">No disponible</span>';
        });
        changed++;
      }
    }
    return changed;
  }

  function audit(root){
    const rankingGroups=[...root.querySelectorAll('.osflr-bars')];
    let badRankingGroups=0;
    rankingGroups.forEach(group=>{
      const rows=[...group.querySelectorAll(':scope > .osflr-bar,:scope > .osflr-bar-row')];
      if(rows.length<2)return;
      const values=rows.map(row=>parseClNumber(row.querySelector(':scope > b')?.textContent));
      if(values.some(v=>!Number.isFinite(v)))return;
      const max=Math.max(1,...values);
      const widths=rows.map(row=>Number(row.querySelector('[data-osfl-proportional-svg]')?.getAttribute('data-osfl-percent')));
      if(widths.some(v=>!Number.isFinite(v)))return;
      const mismatch=widths.some((width,i)=>Math.abs(width-Math.max(values[i]?2:0,100*values[i]/max))>0.8);
      if(mismatch)badRankingGroups++;
    });

    let distributionMismatch=0;
    root.querySelectorAll('.osflr-dist > div').forEach(row=>{
      const expected=parseClNumber(row.querySelector(':scope > small')?.textContent);
      const actual=Number(row.querySelector('[data-osfl-proportional-svg]')?.getAttribute('data-osfl-percent'));
      if(Number.isFinite(expected)&&Number.isFinite(actual)&&Math.abs(expected-actual)>0.8)distributionMismatch++;
    });

    let sectorMismatch=0;
    root.querySelectorAll('.osflr-sector-list,.osflr-sectors').forEach(group=>{
      const rows=[...group.children].filter(row=>row.nodeType===1);
      const totals=rows.map(row=>parseClNumber(row.querySelector('header b')?.textContent));
      const finite=totals.filter(Number.isFinite);
      if(!finite.length)return;
      const max=Math.max(1,...finite);
      rows.forEach((row,i)=>{
        if(!Number.isFinite(totals[i]))return;
        const svg=row.querySelector('[data-osfl-sector-svg="0953"]');
        const actual=Number(svg?.getAttribute('data-osfl-magnitude'));
        const expected=100*totals[i]/max;
        if(!Number.isFinite(actual)||Math.abs(actual-expected)>0.8)sectorMismatch++;
      });
    });

    const legacyWidthNodes=root.querySelectorAll('i[style*="width"],em[style*="width"]').length;
    const growthSvg=!!root.querySelector('[data-osflr-growth] .osflr-linechart svg path.line');
    const ringSvg=!!root.querySelector('[data-osfl-ring-svg="0953"]');
    return {
      rankingGroups:rankingGroups.length,
      rankingSvg:root.querySelectorAll('.osflr-bars [data-osfl-proportional-svg]').length,
      distributionRows:root.querySelectorAll('.osflr-dist > div').length,
      distributionSvg:root.querySelectorAll('.osflr-dist [data-osfl-proportional-svg]').length,
      meters:root.querySelectorAll('.osflr-meter').length,
      meterSvg:root.querySelectorAll('.osflr-meter [data-osfl-proportional-svg]').length,
      sectorRows:root.querySelectorAll('.osflr-sector-list > div,.osflr-sectors > div').length,
      sectorSvg:root.querySelectorAll('[data-osfl-sector-svg="0953"]').length,
      ringSvg,
      growthSvg,
      regionalCoverageUnavailable:regionalCoverage.unavailable,
      legacyWidthNodes,
      badRankingGroups,
      distributionMismatch,
      sectorMismatch
    };
  }

  function repair(reason='module'){
    const roots=[...document.querySelectorAll(ROOT)],results=[];
    roots.forEach(root=>{
      const changed={
        sectors:repairSectorTracks(root),
        declaredTracks:repairDeclaredWidthTracks(root),
        ring:repairRing(root),
        regionalCoverage:applyRegionalCoverageSemantics(root)
      };
      const result=audit(root);
      root.dataset.osflGraphicsModule='0953';
      root.dataset.osflGraphicsModuleReason=reason;
      root.dataset.osflGraphicsVerified=String(
        result.legacyWidthNodes===0 &&
        result.badRankingGroups===0 &&
        result.distributionMismatch===0 &&
        result.sectorMismatch===0 ? 1 : 0
      );
      results.push({changed,audit:result});
    });
    preserveFinalRuntimeAuthority();
    window.__ATLAS_OSFL_GRAPHICS_LAST_AUDIT__={marker:MARK,reason,regionalCoverage:{...regionalCoverage},roots:results,at:new Date().toISOString()};
    return roots.length>0;
  }

  function refreshRegionalCoverage(reason='coverage'){
    void checkRegionalCoverage().then(()=>repair(reason));
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
      refreshRegionalCoverage('interaction-coverage');
    }
  },true);
  window.addEventListener('pageshow',()=>{repair('pageshow');refreshRegionalCoverage('pageshow-coverage');});
  window.addEventListener('focus',()=>{repair('focus');refreshRegionalCoverage('focus-coverage');});
  [0,20,60,150,350,700,1200,2500,5000,10000].forEach(ms=>setTimeout(()=>repair('boot'),ms));
  [250,1000,3000].forEach(ms=>setTimeout(()=>refreshRegionalCoverage('boot-coverage'),ms));

  preserveFinalRuntimeAuthority();
  window.__ATLAS_OSFL_GRAPHICS_MODULE_CURRENT__={
    version:'0.95.3',marker:MARK,cspSafe:true,classAgnostic:true,
    rankingSemantics:'VALUE_OVER_GROUP_MAX',
    distributionSemantics:'DECLARED_SHARE',
    sectorSemantics:'TOTAL_OVER_SECTOR_MAX_WITH_COMPOSITION',
    regionalCoverageSemantics:'NULL_IS_UNAVAILABLE_NOT_ZERO',
    repair,
    audit:()=>document.querySelector(ROOT)?audit(document.querySelector(ROOT)):null,
    checkRegionalCoverage,
    preserveFinalRuntimeAuthority
  };
}

export { MARK, preserveFinalRuntimeAuthority };

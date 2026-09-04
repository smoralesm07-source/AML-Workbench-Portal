'use strict';
/* ATLAS OSFL · Graphics Final Authority 1.00.1
 * Source-of-truth visual repair for the Radiografía OSFL.
 * Does not trust inline width styles. Geometry is derived from visible values
 * and rebuilt with CSP-safe SVG on every render/re-render.
 */
(function atlasOsflGraphicsFinal1001(){
  if(window.__ATLAS_OSFL_GRAPHICS_FINAL_1001__) return;
  window.__ATLAS_OSFL_GRAPHICS_FINAL_1001__=true;

  const ROOT='[data-osflr-root]';
  const REGION_VIEW='aml_v_osfl_national_region_current';
  const MARK='OSFL_GRAPHICS_FINAL_1001';
  const state={coverageChecked:false,coverageUnavailable:false,coverageChecking:false,lastError:null};

  const clamp=(v,min=0,max=100)=>Math.min(max,Math.max(min,Number.isFinite(Number(v))?Number(v):0));
  const isNumeric=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v));
  const parseNumber=value=>{
    let text=String(value??'').trim();
    if(!text||text==='—'||/no disponible/i.test(text)) return NaN;
    text=text.replace(/\s/g,'').replace(/%$/,'').replace(/\./g,'').replace(',','.').replace(/[^0-9+\-.]/g,'');
    const num=Number(text);
    return Number.isFinite(num)?num:NaN;
  };
  const pctText=v=>`${Number(v).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
  const directChild=(node,tag)=>[...(node?.children||[])].find(el=>el.tagName===tag)||null;

  function barSvg(percent,height=5,from='#58d4c2',to='#67a9ff',kind='bar'){
    const p=clamp(percent),h=Math.max(2,Number(height)||5),id=`osfl1001_${Math.random().toString(36).slice(2,9)}`;
    return `<svg data-osfl-proportional-svg="1001" data-osfl-kind="${kind}" data-osfl-percent="${p.toFixed(3)}" viewBox="0 0 100 ${h}" preserveAspectRatio="none" width="100%" height="${h}" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect x="0" y="0" width="100" height="${h}" rx="${h/2}" fill="#ffffff" fill-opacity="0.055"/><rect x="0" y="0" width="${p.toFixed(3)}" height="${h}" rx="${h/2}" fill="url(#${id})"/></svg>`;
  }

  function sectorSvg(direct,total,magnitude,height=5){
    const h=Math.max(2,Number(height)||5),mag=clamp(magnitude),safeTotal=Math.max(0,Number(total)||0),safeDirect=Math.min(safeTotal,Math.max(0,Number(direct)||0));
    const directWidth=safeTotal>0?mag*safeDirect/safeTotal:0;
    const potentialWidth=Math.max(0,mag-directWidth);
    return `<svg data-osfl-proportional-svg="1001" data-osfl-sector-svg="0953" data-osfl-total="${safeTotal}" data-osfl-magnitude="${mag.toFixed(3)}" viewBox="0 0 100 ${h}" preserveAspectRatio="none" width="100%" height="${h}" aria-hidden="true" focusable="false"><rect x="0" y="0" width="100" height="${h}" rx="${h/2}" fill="#ffffff" fill-opacity="0.05"/><rect x="0" y="0" width="${directWidth.toFixed(3)}" height="${h}" fill="#ef8d51"/><rect x="${directWidth.toFixed(3)}" y="0" width="${potentialWidth.toFixed(3)}" height="${h}" fill="#f1ba4d"/></svg>`;
  }

  function renderRankings(root){
    let changed=0;
    root.querySelectorAll('.osflr-bars').forEach(group=>{
      const rows=[...group.children].filter(row=>row.matches?.('.osflr-bar-row,.osflr-bar'));
      if(rows.length<1)return;
      const labels=rows.map(row=>directChild(row,'B')?.textContent||'');
      const values=labels.map(parseNumber);
      const finite=values.filter(Number.isFinite);
      if(!finite.length)return;
      const percentMode=labels.every(label=>String(label).includes('%'));
      const max=percentMode?100:Math.max(1,...finite);
      rows.forEach((row,i)=>{
        const value=values[i];
        if(!Number.isFinite(value))return;
        const share=percentMode?clamp(value):clamp(100*value/max);
        const track=directChild(row,'DIV');
        if(!track)return;
        const sig=`rank:${value}:${max}:${share.toFixed(3)}`;
        if(track.dataset.osflFinal1001===sig&&track.querySelector('[data-osfl-proportional-svg="1001"]'))return;
        track.innerHTML=barSvg(share,5,'#58d4c2','#67a9ff','ranking');
        track.dataset.osflFinal1001=sig;
        track.setAttribute('aria-label',`${labels[i]} · ${pctText(share)} de escala visual`);
        changed++;
      });
    });
    return changed;
  }

  function renderDistributions(root){
    let changed=0;
    root.querySelectorAll('.osflr-dist > div').forEach(row=>{
      const share=parseNumber(directChild(row,'SMALL')?.textContent);
      if(!Number.isFinite(share))return;
      const track=directChild(row,'DIV');
      if(!track)return;
      const safe=clamp(share),sig=`dist:${safe.toFixed(3)}`;
      if(track.dataset.osflFinal1001===sig&&track.querySelector('[data-osfl-proportional-svg="1001"]'))return;
      track.innerHTML=barSvg(safe,5,'#67a9ff','#58d4c2','distribution');
      track.dataset.osflFinal1001=sig;
      changed++;
    });
    return changed;
  }

  function renderSectors(root){
    let changed=0;
    root.querySelectorAll('.osflr-sector-list,.osflr-sectors').forEach(group=>{
      const rows=[...group.children].filter(el=>el.nodeType===1);
      const totals=rows.map(row=>parseNumber(row.querySelector('header b')?.textContent));
      const finite=totals.filter(Number.isFinite);
      if(!finite.length)return;
      const max=Math.max(1,...finite);
      rows.forEach((row,i)=>{
        const total=totals[i];
        if(!Number.isFinite(total))return;
        const small=row.querySelector('small')?.textContent||'';
        const directMatch=small.match(/([0-9][0-9.]*)\s+direct/i);
        const direct=directMatch?parseNumber(directMatch[1]):0;
        const magnitude=clamp(100*total/max);
        const track=row.querySelector('.osflr-stackbar,[class*="stackbar"]');
        if(!track)return;
        const sig=`sector:${total}:${direct}:${magnitude.toFixed(3)}`;
        if(track.dataset.osflFinal1001===sig&&track.querySelector('[data-osfl-sector-svg="0953"]'))return;
        track.innerHTML=sectorSvg(direct,total,magnitude,5);
        track.dataset.osflFinal1001=sig;
        track.setAttribute('aria-label',`${total.toLocaleString('es-CL')} organizaciones · ${pctText(magnitude)} de la mayor categoría`);
        changed++;
      });
    });
    return changed;
  }

  function renderMeters(root){
    let changed=0;
    root.querySelectorAll('.osflr-meter').forEach(meter=>{
      const cell=meter.closest('td');
      const match=(cell?.textContent||'').match(/([0-9.]+(?:,[0-9]+)?)\s*%/);
      if(!match)return;
      const share=parseNumber(match[1]);
      if(!Number.isFinite(share))return;
      const safe=clamp(share),sig=`meter:${safe.toFixed(3)}`;
      if(meter.dataset.osflFinal1001===sig&&meter.querySelector('[data-osfl-proportional-svg="1001"]'))return;
      meter.innerHTML=barSvg(safe,4,'#58d4c2','#58d4c2','meter');
      meter.dataset.osflFinal1001=sig;
      changed++;
    });
    return changed;
  }

  function renderRing(root){
    const card=root.querySelector('[data-osflr-uaf-snapshot]');
    const host=card?.querySelector('.osflr-donut,.osflr-ring,.osflr-ring-svg-host,[data-osfl-ring-final]');
    if(!card||!host)return 0;
    const values=[...card.querySelectorAll('.osflr-legend-row > b,.osflr-legend > b')].map(el=>parseNumber(el.textContent)).filter(Number.isFinite);
    if(values.length<2)return 0;
    const strong=(values[0]||0)+(values[1]||0),total=Math.max(1,values.reduce((s,v)=>s+v,0)),share=clamp(100*strong/total);
    const sig=`ring:${strong}:${total}:${share.toFixed(3)}`;
    if(host.dataset.osflFinal1001===sig&&host.querySelector('[data-osfl-ring-svg="1001"]'))return 0;
    const circumference=2*Math.PI*46,dash=circumference*share/100,rest=Math.max(0,circumference-dash);
    host.removeAttribute('style');
    host.classList.remove('osflr-donut','osflr-ring');
    host.classList.add('osflr-ring-svg-host');
    host.setAttribute('align','center');
    host.setAttribute('data-osfl-ring-final','1001');
    host.innerHTML=`<svg data-osfl-ring-svg="1001" data-osfl-percent="${share.toFixed(3)}" viewBox="0 0 120 120" width="118" height="118" role="img" aria-label="Núcleo UAF fuerte: ${strong.toLocaleString('es-CL')}, ${pctText(share)}"><rect x="0" y="0" width="120" height="120" rx="60" fill="#101e2e"/><circle cx="60" cy="60" r="46" fill="none" stroke="#233347" stroke-width="10"/><circle cx="60" cy="60" r="46" fill="none" stroke="#f1ba4d" stroke-width="10" stroke-linecap="round" stroke-dasharray="${dash.toFixed(3)} ${rest.toFixed(3)}" transform="rotate(-90 60 60)"/><text x="60" y="56" text-anchor="middle" fill="#eef5fb" font-size="17" font-weight="700">${strong.toLocaleString('es-CL')}</text><text x="60" y="72" text-anchor="middle" fill="#91a6ba" font-size="8">${pctText(share)} núcleo fuerte</text></svg>`;
    host.dataset.osflFinal1001=sig;
    return 1;
  }

  async function checkRegionalCoverage(){
    if(state.coverageChecked||state.coverageChecking)return;
    const c=window.sb || (typeof sb!=='undefined'?sb:null);
    if(!c)return;
    state.coverageChecking=true;
    try{
      const {data,error}=await c.from(REGION_VIEW).select('region,atlas_coverage_pct').limit(100);
      if(error)throw error;
      const values=(data||[]).map(r=>r?.atlas_coverage_pct);
      state.coverageUnavailable=values.length>0&&values.every(v=>!isNumeric(v));
      state.coverageChecked=true;
      state.lastError=null;
    }catch(error){state.lastError=String(error?.message||error);}finally{state.coverageChecking=false;}
  }

  function applyCoverageSemantics(root){
    if(!state.coverageUnavailable)return 0;
    let changed=0;
    const controls=root.querySelector('[data-osflr-territory-controls]');
    const coverageButton=controls?.querySelector('[data-metric="atlas_coverage_pct"]');
    const observedButton=controls?.querySelector('[data-metric="atlas_observed"]');
    if(coverageButton){
      if(coverageButton.classList.contains('active')&&observedButton)setTimeout(()=>observedButton.click(),0);
      coverageButton.disabled=true;
      coverageButton.setAttribute('aria-disabled','true');
      coverageButton.title='Cobertura regional no disponible: la vista no contiene denominador legal regional.';
      coverageButton.textContent='Cobertura · sin base regional';
      changed++;
    }
    root.querySelectorAll('[data-osflr-territory-insight] .osflr-insight-stack > div').forEach(row=>{
      const label=String(row.querySelector('span')?.textContent||'').toLowerCase();
      if(!label.includes('mayor cobertura'))return;
      const b=row.querySelector('b'),small=row.querySelector('small');
      if(b)b.textContent='—';
      if(small)small.textContent='Denominador legal regional no disponible';
      changed++;
    });
    const table=root.querySelector('[data-osflr-region-table] table');
    if(table){
      const headers=[...table.querySelectorAll('thead th')];
      const idx=headers.findIndex(th=>String(th.textContent||'').trim().toLowerCase().startsWith('cobertura'));
      if(idx>=0){
        headers[idx].textContent='Cobertura*';
        table.querySelectorAll('tbody tr').forEach(tr=>{const cell=tr.children[idx];if(cell)cell.textContent='—';});
        changed++;
      }
    }
    return changed;
  }

  function audit(root){
    let rankingMismatch=0;
    root.querySelectorAll('.osflr-bars').forEach(group=>{
      const rows=[...group.children].filter(row=>row.matches?.('.osflr-bar-row,.osflr-bar'));
      const values=rows.map(row=>parseNumber(directChild(row,'B')?.textContent));
      const finite=values.filter(Number.isFinite);
      if(finite.length<2)return;
      const max=Math.max(1,...finite);
      rows.forEach((row,i)=>{
        if(!Number.isFinite(values[i]))return;
        const actual=Number(row.querySelector('[data-osfl-proportional-svg="1001"]')?.getAttribute('data-osfl-percent'));
        const expected=100*values[i]/max;
        if(!Number.isFinite(actual)||Math.abs(actual-expected)>0.8)rankingMismatch++;
      });
    });
    let sectorMismatch=0;
    root.querySelectorAll('.osflr-sector-list,.osflr-sectors').forEach(group=>{
      const rows=[...group.children].filter(el=>el.nodeType===1),totals=rows.map(row=>parseNumber(row.querySelector('header b')?.textContent)),finite=totals.filter(Number.isFinite);
      if(!finite.length)return;
      const max=Math.max(1,...finite);
      rows.forEach((row,i)=>{
        if(!Number.isFinite(totals[i]))return;
        const actual=Number(row.querySelector('[data-osfl-sector-svg="0953"]')?.getAttribute('data-osfl-magnitude'));
        const expected=100*totals[i]/max;
        if(!Number.isFinite(actual)||Math.abs(actual-expected)>0.8)sectorMismatch++;
      });
    });
    return {
      rankingMismatch,
      sectorMismatch,
      rankingSvg:root.querySelectorAll('.osflr-bars [data-osfl-proportional-svg="1001"]').length,
      distributionSvg:root.querySelectorAll('.osflr-dist [data-osfl-proportional-svg="1001"]').length,
      meterSvg:root.querySelectorAll('.osflr-meter [data-osfl-proportional-svg="1001"]').length,
      sectorSvg:root.querySelectorAll('[data-osfl-sector-svg="0953"]').length,
      ringSvg:root.querySelectorAll('[data-osfl-ring-svg="1001"]').length,
      coverageUnavailable:state.coverageUnavailable,
      verified:rankingMismatch===0&&sectorMismatch===0
    };
  }

  function repair(reason='manual'){
    const roots=[...document.querySelectorAll(ROOT)],results=[];
    roots.forEach(root=>{
      const changed={
        rankings:renderRankings(root),
        distributions:renderDistributions(root),
        sectors:renderSectors(root),
        meters:renderMeters(root),
        ring:renderRing(root),
        coverage:applyCoverageSemantics(root)
      };
      const check=audit(root);
      root.dataset.osflGraphicsFinal='1001';
      root.dataset.osflGraphicsFinalVerified=check.verified?'1':'0';
      root.dataset.osflGraphicsFinalReason=reason;
      results.push({changed,audit:check});
    });
    window.__ATLAS_OSFL_GRAPHICS_FINAL_AUDIT__={marker:MARK,reason,state:{...state},roots:results,at:new Date().toISOString()};
    return roots.length>0;
  }

  let queued=false;
  function queue(reason){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;repair(reason);});
  }
  function refreshCoverage(reason){void checkRegionalCoverage().then(()=>repair(reason));}

  new MutationObserver(()=>queue('mutation')).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',event=>{
    if(event.target?.closest?.('[data-view="osfl"],[data-nav="osfl"],[href="#osfl"],[data-osflr-tab],[data-osflr-territory-controls] button,[data-osflr-jump],[data-page],[data-osflr-clear]')){
      [0,30,120,400,1000].forEach(ms=>setTimeout(()=>repair('interaction'),ms));
      refreshCoverage('interaction-coverage');
    }
  },true);
  window.addEventListener('pageshow',()=>{repair('pageshow');refreshCoverage('pageshow-coverage');});
  window.addEventListener('focus',()=>{repair('focus');refreshCoverage('focus-coverage');});
  [0,30,100,300,800,1600,3500,7000,12000].forEach(ms=>setTimeout(()=>repair('boot'),ms));
  [250,1200,4000].forEach(ms=>setTimeout(()=>refreshCoverage('boot-coverage'),ms));

  window.__ATLAS_OSFL_GRAPHICS_FINAL_CURRENT__={version:'1.00.1',marker:MARK,cspSafe:true,sourceIndependent:true,repair,audit:()=>document.querySelector(ROOT)?audit(document.querySelector(ROOT)):null,checkRegionalCoverage};
})();

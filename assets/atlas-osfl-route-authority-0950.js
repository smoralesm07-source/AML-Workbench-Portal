'use strict';

/* ATLAS OSFL 0.95 route/install + CSP-safe graphics authority.
 * Keeps the OSFL 0.95 layer mounted after late navigation and repairs every
 * data bar/progress visual without inline style attributes (blocked by Atlas CSP).
 * Scope: Panorama, Territorio, Actividad & SII, UAF, Fondos and Explorador.
 */
(function atlasOsflRouteAuthority0950(){
  if(window.__ATLAS_OSFL_ROUTE_AUTHORITY_0950__) return;
  window.__ATLAS_OSFL_ROUTE_AUTHORITY_0950__=true;
  window.__ATLAS_OSFL_CSP_SAFE_GRAPHICS_0950__=true;

  const EVENT='atlas:osfl-national-ready';
  const MARK='OSFL_ROUTE_AUTHORITY_0950_CSP_GRAPHICS';
  let lastRoot=null;
  let repairQueued=false;

  const clamp=(value,min=0,max=100)=>Math.min(max,Math.max(min,Number.isFinite(Number(value))?Number(value):0));

  function parseClNumber(value){
    let text=String(value??'').trim();
    if(!text || text==='—') return NaN;
    text=text.replace(/\s/g,'').replace(/%$/,'').replace(/\./g,'').replace(',','.').replace(/[^0-9+\-.]/g,'');
    const number=Number(text);
    return Number.isFinite(number)?number:NaN;
  }

  function svgBar(percent,height=5,fill='#58d4c2',fill2='#67a9ff'){
    const p=clamp(percent);
    const h=Math.max(2,Number(height)||5);
    const id=`osflg${Math.random().toString(36).slice(2,9)}`;
    return `<svg class="osflr-csp-graphic" viewBox="0 0 100 ${h}" preserveAspectRatio="none" width="100%" height="${h}" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${fill}"/><stop offset="1" stop-color="${fill2}"/></linearGradient></defs><rect x="0" y="0" width="${p.toFixed(3)}" height="${h}" rx="${h/2}" fill="url(#${id})"/></svg>`;
  }

  function svgStack(firstPct,secondPct,height=5){
    const first=clamp(firstPct);
    const second=clamp(secondPct,0,100-first);
    const h=Math.max(2,Number(height)||5);
    return `<svg class="osflr-csp-graphic" viewBox="0 0 100 ${h}" preserveAspectRatio="none" width="100%" height="${h}" aria-hidden="true" focusable="false"><rect x="0" y="0" width="${first.toFixed(3)}" height="${h}" fill="#ef8d51"/><rect x="${first.toFixed(3)}" y="0" width="${second.toFixed(3)}" height="${h}" fill="#f1ba4d"/></svg>`;
  }

  function repairRankedBars(root){
    root.querySelectorAll('.osflr-bars').forEach(group=>{
      const rows=[...group.querySelectorAll('.osflr-bar')];
      if(!rows.length) return;
      const labels=rows.map(row=>row.querySelector(':scope > b')?.textContent||'');
      const values=labels.map(parseClNumber);
      const percentageMode=labels.some(label=>String(label).includes('%'));
      const finite=values.filter(Number.isFinite);
      const max=percentageMode?100:Math.max(1,...finite);
      rows.forEach((row,index)=>{
        const track=row.querySelector(':scope > div');
        if(!track) return;
        const value=Number.isFinite(values[index])?values[index]:0;
        const share=percentageMode?clamp(value):clamp(100*value/max);
        const signature=share.toFixed(3);
        if(track.dataset.osflGraphicFixed==='ranked' && track.dataset.osflGraphicShare===signature) return;
        track.innerHTML=svgBar(share,5);
        track.dataset.osflGraphicFixed='ranked';
        track.dataset.osflGraphicShare=signature;
        track.setAttribute('aria-label',`${labels[index]} · ${share.toLocaleString('es-CL',{maximumFractionDigits:1})}% de escala visual`);
      });
    });
  }

  function repairDistributionBars(root){
    root.querySelectorAll('.osflr-dist > div').forEach(row=>{
      const track=row.querySelector(':scope > div');
      if(!track) return;
      const share=parseClNumber(row.querySelector(':scope > small')?.textContent);
      const safeShare=Number.isFinite(share)?share:0;
      const signature=clamp(safeShare).toFixed(3);
      if(track.dataset.osflGraphicFixed==='distribution' && track.dataset.osflGraphicShare===signature) return;
      track.innerHTML=svgBar(safeShare,5,'#67a9ff','#58d4c2');
      track.dataset.osflGraphicFixed='distribution';
      track.dataset.osflGraphicShare=signature;
    });
  }

  function repairMeters(root){
    root.querySelectorAll('.osflr-meter').forEach(meter=>{
      const cell=meter.closest('td');
      const match=(cell?.textContent||'').match(/([0-9.]+(?:,[0-9]+)?)\s*%/);
      const share=match?parseClNumber(match[1]):NaN;
      if(!Number.isFinite(share)) return;
      const signature=clamp(share).toFixed(3);
      if(meter.dataset.osflGraphicFixed==='meter' && meter.dataset.osflGraphicShare===signature) return;
      meter.innerHTML=svgBar(share,4,'#58d4c2','#58d4c2');
      meter.dataset.osflGraphicFixed='meter';
      meter.dataset.osflGraphicShare=signature;
    });
  }

  function repairSectorStacks(root){
    root.querySelectorAll('.osflr-sectors > div').forEach(row=>{
      const track=row.querySelector(':scope > div');
      const small=row.querySelector(':scope > small');
      if(!track||!small) return;
      const nums=(small.textContent||'').match(/\d[\d.]*/g)?.map(parseClNumber).filter(Number.isFinite)||[];
      const direct=nums[0]||0;
      const high=nums[1]||0;
      const total=Math.max(1,direct+high);
      const directPct=100*direct/total;
      const highPct=100*high/total;
      const signature=`${clamp(directPct).toFixed(3)}:${clamp(highPct).toFixed(3)}`;
      if(track.dataset.osflGraphicFixed==='sector-stack' && track.dataset.osflGraphicShare===signature) return;
      track.innerHTML=svgStack(directPct,highPct,5);
      track.dataset.osflGraphicFixed='sector-stack';
      track.dataset.osflGraphicShare=signature;
    });
  }

  function repairUafRing(root){
    const card=root.querySelector('[data-osflr-uaf-snapshot]');
    const ring=card?.querySelector('.osflr-ring');
    if(!card||!ring) return;
    const values=[...card.querySelectorAll('.osflr-legend b')].map(x=>parseClNumber(x.textContent)).filter(Number.isFinite);
    if(values.length<2) return;
    const strong=(values[0]||0)+(values[1]||0);
    const total=Math.max(1,values.reduce((sum,value)=>sum+value,0));
    const share=clamp(100*strong/total);
    const circumference=2*Math.PI*46;
    const dash=circumference*share/100;
    const rest=Math.max(0,circumference-dash);
    const signature=`${strong}:${share.toFixed(3)}`;
    if(ring.dataset.osflGraphicFixed==='uaf-ring' && ring.dataset.osflGraphicShare===signature) return;
    ring.innerHTML=`<svg class="osflr-csp-ring" viewBox="0 0 120 120" width="110" height="110" role="img" aria-label="Núcleo UAF fuerte: ${strong.toLocaleString('es-CL')}, ${share.toLocaleString('es-CL',{maximumFractionDigits:1})}% del universo analítico UAF"><circle cx="60" cy="60" r="59" fill="#101e2e"/><circle cx="60" cy="60" r="46" fill="none" stroke="#233347" stroke-width="10"/><circle cx="60" cy="60" r="46" fill="none" stroke="#f1ba4d" stroke-width="10" stroke-linecap="round" stroke-dasharray="${dash.toFixed(3)} ${rest.toFixed(3)}" transform="rotate(-90 60 60)"/><text x="60" y="57" text-anchor="middle" fill="#eef5fb" font-size="17" font-weight="700">${strong.toLocaleString('es-CL')}</text><text x="60" y="73" text-anchor="middle" fill="#91a6ba" font-size="8">${share.toLocaleString('es-CL',{maximumFractionDigits:1})}% núcleo fuerte</text></svg>`;
    ring.dataset.osflGraphicFixed='uaf-ring';
    ring.dataset.osflGraphicShare=signature;
  }

  function repairAll(reason){
    const root=document.querySelector('[data-osflr-root]');
    if(!root) return false;
    repairRankedBars(root);
    repairDistributionBars(root);
    repairMeters(root);
    repairSectorStacks(root);
    repairUafRing(root);
    root.dataset.osflGraphics='csp-safe';
    root.dataset.osflGraphicsReason=reason||'repair';
    return true;
  }

  function queueRepair(reason){
    if(repairQueued) return;
    repairQueued=true;
    setTimeout(()=>{
      repairQueued=false;
      repairAll(reason);
    },0);
  }

  function signal(reason){
    const root=document.querySelector('[data-osfln-root]');
    if(!root) return false;
    const economic=document.querySelector('[data-osfl95-root]');
    if(!economic || root!==lastRoot){
      lastRoot=root;
      document.dispatchEvent(new CustomEvent(EVENT,{detail:{source:MARK,reason:reason||'root-ready'}}));
    }
    queueRepair(reason||'signal');
    return true;
  }

  function schedule(reason){
    [0,50,180,450,900,1600].forEach(ms=>setTimeout(()=>{
      signal(reason);
      repairAll(reason);
    },ms));
  }

  function pinLoader(){
    if(typeof window.v030LoadOsfl!=='function') return false;
    if(window.v030LoadOsfl.__osflRoute0950) return true;
    const base=window.v030LoadOsfl;
    const wrapped=async function(){
      const out=await base.apply(this,arguments);
      schedule('v030LoadOsfl');
      return out;
    };
    wrapped.__osflRoute0950=true;
    wrapped.__base=base;
    window.v030LoadOsfl=wrapped;
    return true;
  }

  document.addEventListener('click',ev=>{
    const trigger=ev.target?.closest?.('[data-view="osfl"], [data-nav="osfl"], [href="#osfl"]');
    if(trigger) schedule('navigation');
    if(ev.target?.closest?.('[data-osflr-territory-controls] button,[data-osflr-tab],[data-jump]')){
      [0,30,100].forEach(ms=>setTimeout(()=>repairAll('interaction'),ms));
    }
  },true);

  const observer=new MutationObserver(()=>{
    pinLoader();
    signal('mutation');
    queueRepair('mutation');
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  let tries=0;
  const pinTimer=setInterval(()=>{
    tries++;
    pinLoader();
    signal('timer');
    repairAll('timer');
    if(tries>120 && typeof window.v030LoadOsfl==='function') clearInterval(pinTimer);
  },250);

  window.addEventListener('load',()=>schedule('window-load'),{once:true});
  document.addEventListener(EVENT,()=>setTimeout(()=>{
    signal('event-echo');
    repairAll('event-echo');
  },0));

  window.__ATLAS_OSFL_ROUTE_CURRENT__={
    version:'0.95.0',
    build:'0950',
    marker:MARK,
    cspSafeGraphics:true,
    signal:()=>signal('manual'),
    repair:()=>repairAll('manual'),
    schedule
  };
  schedule('boot');
})();

'use strict';

/* ATLAS OSFL 0.95 route/install + graphics authority 0.95.1.
 * Keeps the Radiografía OSFL mounted and repairs every proportional graphic
 * with SVG geometry attributes. No inline CSS widths are used, so the visuals
 * remain compatible with Atlas CSP (style-src 'self').
 * Scope: Panorama, Territorio, Actividad & SII, UAF, Fondos and Explorador.
 */
(function atlasOsflGraphicsAuthority0951(){
  if(window.__ATLAS_OSFL_GRAPHICS_AUTHORITY_0951__) return;
  window.__ATLAS_OSFL_GRAPHICS_AUTHORITY_0951__=true;
  window.__ATLAS_OSFL_ROUTE_AUTHORITY_0950__=true;

  const EVENT='atlas:osfl-national-ready';
  const MARK='OSFL_GRAPHICS_AUTHORITY_0951';
  const ROOT='[data-osflr-root]';
  let repairQueued=false;
  let lastRoot=null;

  const clamp=(value,min=0,max=100)=>Math.min(max,Math.max(min,Number.isFinite(Number(value))?Number(value):0));

  function parseClNumber(value){
    let text=String(value??'').trim();
    if(!text || text==='—') return NaN;
    text=text.replace(/\s/g,'').replace(/%$/,'').replace(/\./g,'').replace(',','.').replace(/[^0-9+\-.]/g,'');
    const number=Number(text);
    return Number.isFinite(number)?number:NaN;
  }

  function barSvg(percent,height=5,from='#58d4c2',to='#67a9ff'){
    const p=clamp(percent);
    const h=Math.max(2,Number(height)||5);
    const id=`osflbar${Math.random().toString(36).slice(2,9)}`;
    return `<svg data-osfl-proportional-svg="1" viewBox="0 0 100 ${h}" preserveAspectRatio="none" width="100%" height="${h}" role="img" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect x="0" y="0" width="100" height="${h}" rx="${h/2}" fill="#ffffff" fill-opacity="0.055"/><rect x="0" y="0" width="${p.toFixed(3)}" height="${h}" rx="${h/2}" fill="url(#${id})"/></svg>`;
  }

  function stackSvg(firstValue,secondValue,height=5){
    const total=Math.max(1,Number(firstValue)||0,0)+Math.max(0,Number(secondValue)||0);
    const first=clamp(100*Math.max(0,Number(firstValue)||0)/total);
    const second=clamp(100*Math.max(0,Number(secondValue)||0)/total,0,100-first);
    const h=Math.max(2,Number(height)||5);
    return `<svg data-osfl-proportional-svg="1" viewBox="0 0 100 ${h}" preserveAspectRatio="none" width="100%" height="${h}" role="img" aria-hidden="true" focusable="false"><rect x="0" y="0" width="100" height="${h}" rx="${h/2}" fill="#ffffff" fill-opacity="0.05"/><rect x="0" y="0" width="${first.toFixed(3)}" height="${h}" fill="#ef8d51"/><rect x="${first.toFixed(3)}" y="0" width="${second.toFixed(3)}" height="${h}" fill="#f1ba4d"/></svg>`;
  }

  function replaceTrack(track,html,kind,signature){
    if(!track) return;
    if(track.dataset.osflGraphicAuthority===kind && track.dataset.osflGraphicSignature===signature && track.querySelector('[data-osfl-proportional-svg]')) return;
    track.innerHTML=html;
    track.dataset.osflGraphicAuthority=kind;
    track.dataset.osflGraphicSignature=signature;
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
        const signature=`${value}:${share.toFixed(3)}:${max}`;
        replaceTrack(track,barSvg(share,5),'ranked',signature);
        track.setAttribute('aria-label',`${labels[index]} · ${share.toLocaleString('es-CL',{maximumFractionDigits:1})}% de escala visual`);
      });
    });
  }

  function repairDistributionBars(root){
    root.querySelectorAll('.osflr-dist > div').forEach(row=>{
      const track=row.querySelector(':scope > div');
      if(!track) return;
      const share=parseClNumber(row.querySelector(':scope > small')?.textContent);
      const safe=Number.isFinite(share)?clamp(share):0;
      replaceTrack(track,barSvg(safe,5,'#67a9ff','#58d4c2'),'distribution',safe.toFixed(3));
    });
  }

  function repairMeters(root){
    root.querySelectorAll('.osflr-meter').forEach(meter=>{
      const cell=meter.closest('td');
      const match=(cell?.textContent||'').match(/([0-9.]+(?:,[0-9]+)?)\s*%/);
      const share=match?parseClNumber(match[1]):NaN;
      if(!Number.isFinite(share)) return;
      const safe=clamp(share);
      replaceTrack(meter,barSvg(safe,4,'#58d4c2','#58d4c2'),'meter',safe.toFixed(3));
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
      replaceTrack(track,stackSvg(direct,high,5),'sector-stack',`${direct}:${high}`);
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
    const signature=`${strong}:${total}:${share.toFixed(3)}`;
    if(ring.dataset.osflGraphicAuthority==='uaf-ring' && ring.dataset.osflGraphicSignature===signature && ring.querySelector('[data-osfl-ring-svg]')) return;
    ring.innerHTML=`<svg data-osfl-ring-svg="1" viewBox="0 0 120 120" width="110" height="110" role="img" aria-label="Núcleo UAF fuerte: ${strong.toLocaleString('es-CL')}, ${share.toLocaleString('es-CL',{maximumFractionDigits:1})}%"><circle cx="60" cy="60" r="59" fill="#101e2e"/><circle cx="60" cy="60" r="46" fill="none" stroke="#233347" stroke-width="10"/><circle cx="60" cy="60" r="46" fill="none" stroke="#f1ba4d" stroke-width="10" stroke-linecap="round" stroke-dasharray="${dash.toFixed(3)} ${rest.toFixed(3)}" transform="rotate(-90 60 60)"/><text x="60" y="56" text-anchor="middle" fill="#eef5fb" font-size="17" font-weight="700">${strong.toLocaleString('es-CL')}</text><text x="60" y="72" text-anchor="middle" fill="#91a6ba" font-size="8">${share.toLocaleString('es-CL',{maximumFractionDigits:1})}% núcleo fuerte</text></svg>`;
    ring.dataset.osflGraphicAuthority='uaf-ring';
    ring.dataset.osflGraphicSignature=signature;
  }

  function repairAll(reason){
    const roots=[...document.querySelectorAll(ROOT)];
    if(!roots.length) return false;
    roots.forEach(root=>{
      repairRankedBars(root);
      repairDistributionBars(root);
      repairMeters(root);
      repairSectorStacks(root);
      repairUafRing(root);
      root.dataset.osflGraphics='0951-source-independent';
      root.dataset.osflGraphicsReason=reason||'repair';
    });
    return true;
  }

  function queueRepair(reason){
    if(repairQueued) return;
    repairQueued=true;
    requestAnimationFrame(()=>{
      repairQueued=false;
      repairAll(reason);
    });
  }

  function signal(reason){
    const root=document.querySelector(ROOT);
    if(!root) return false;
    if(root!==lastRoot){
      lastRoot=root;
      document.dispatchEvent(new CustomEvent(EVENT,{detail:{source:MARK,reason:reason||'root-ready'}}));
    }
    queueRepair(reason||'signal');
    return true;
  }

  function schedule(reason){
    [0,20,60,150,350,700,1200,2500,5000].forEach(ms=>setTimeout(()=>{
      signal(reason);
      repairAll(reason);
    },ms));
  }

  function pinLoader(){
    if(typeof window.v030LoadOsfl!=='function') return false;
    if(window.v030LoadOsfl.__osflGraphics0951) return true;
    const base=window.v030LoadOsfl;
    const wrapped=async function(){
      const out=await base.apply(this,arguments);
      schedule('v030LoadOsfl');
      return out;
    };
    wrapped.__osflGraphics0951=true;
    wrapped.__base=base;
    window.v030LoadOsfl=wrapped;
    return true;
  }

  document.addEventListener('click',ev=>{
    if(ev.target?.closest?.('[data-view="osfl"], [data-nav="osfl"], [href="#osfl"], [data-osflr-tab], [data-osflr-territory-controls] button, [data-jump], [data-page], [data-clear]')) schedule('interaction');
  },true);

  ['pageshow','focus'].forEach(name=>window.addEventListener(name,()=>schedule(name)));
  document.addEventListener(EVENT,()=>schedule('event-echo'));

  const observer=new MutationObserver(()=>{
    pinLoader();
    queueRepair('mutation');
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  let ticks=0;
  const timer=setInterval(()=>{
    ticks++;
    pinLoader();
    repairAll('interval');
    if(ticks>=240) clearInterval(timer);
  },250);

  pinLoader();
  schedule('boot');

  window.__ATLAS_OSFL_GRAPHICS_CURRENT__={
    version:'0.95.1',
    build:'0950',
    marker:MARK,
    cspSafe:true,
    repair:()=>repairAll('manual'),
    schedule
  };
})();

/* ATLAS OSFL · graphics authority 0.95.1
 * Unique module runtime: forces a new browser resource and repairs every
 * proportional OSFL graphic with CSP-safe SVG geometry.
 */
const MARK='OSFL_GRAPHICS_MODULE_0951';
const ROOT='[data-osflr-root]';

if(!window.__ATLAS_OSFL_GRAPHICS_MODULE_0951__){
  window.__ATLAS_OSFL_GRAPHICS_MODULE_0951__=true;

  const clamp=(value,min=0,max=100)=>Math.min(max,Math.max(min,Number.isFinite(Number(value))?Number(value):0));
  const parseClNumber=value=>{
    let text=String(value??'').trim();
    if(!text||text==='—') return NaN;
    text=text.replace(/\s/g,'').replace(/%$/,'').replace(/\./g,'').replace(',','.').replace(/[^0-9+\-.]/g,'');
    const number=Number(text);
    return Number.isFinite(number)?number:NaN;
  };

  function barSvg(percent,height=5,from='#58d4c2',to='#67a9ff'){
    const p=clamp(percent),h=Math.max(2,Number(height)||5),id=`osflm${Math.random().toString(36).slice(2,9)}`;
    return `<svg data-osfl-proportional-svg="0951" viewBox="0 0 100 ${h}" preserveAspectRatio="none" width="100%" height="${h}" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect x="0" y="0" width="100" height="${h}" rx="${h/2}" fill="#ffffff" fill-opacity="0.055"/><rect x="0" y="0" width="${p.toFixed(3)}" height="${h}" rx="${h/2}" fill="url(#${id})"/></svg>`;
  }

  function stackSvg(firstValue,secondValue,height=5){
    const a=Math.max(0,Number(firstValue)||0),b=Math.max(0,Number(secondValue)||0),total=Math.max(1,a+b),first=clamp(100*a/total),second=clamp(100*b/total,0,100-first),h=Math.max(2,Number(height)||5);
    return `<svg data-osfl-proportional-svg="0951" viewBox="0 0 100 ${h}" preserveAspectRatio="none" width="100%" height="${h}" aria-hidden="true" focusable="false"><rect x="0" y="0" width="100" height="${h}" rx="${h/2}" fill="#ffffff" fill-opacity="0.05"/><rect x="0" y="0" width="${first.toFixed(3)}" height="${h}" fill="#ef8d51"/><rect x="${first.toFixed(3)}" y="0" width="${second.toFixed(3)}" height="${h}" fill="#f1ba4d"/></svg>`;
  }

  function replaceTrack(track,html,signature){
    if(!track) return;
    if(track.dataset.osflGraphics0951===signature&&track.querySelector('[data-osfl-proportional-svg="0951"]')) return;
    track.innerHTML=html;
    track.dataset.osflGraphics0951=signature;
  }

  function ranked(root){
    root.querySelectorAll('.osflr-bars').forEach(group=>{
      const rows=[...group.querySelectorAll('.osflr-bar')];
      if(!rows.length) return;
      const labels=rows.map(row=>row.querySelector(':scope > b')?.textContent||'');
      const values=labels.map(parseClNumber);
      const percentMode=labels.some(label=>label.includes('%'));
      const max=percentMode?100:Math.max(1,...values.filter(Number.isFinite));
      rows.forEach((row,index)=>{
        const value=Number.isFinite(values[index])?values[index]:0,share=percentMode?clamp(value):clamp(100*value/max),track=row.querySelector(':scope > div');
        replaceTrack(track,barSvg(share),`rank:${value}:${max}:${share.toFixed(3)}`);
      });
    });
  }

  function distributions(root){
    root.querySelectorAll('.osflr-dist > div').forEach(row=>{
      const share=parseClNumber(row.querySelector(':scope > small')?.textContent),safe=Number.isFinite(share)?clamp(share):0;
      replaceTrack(row.querySelector(':scope > div'),barSvg(safe,5,'#67a9ff','#58d4c2'),`dist:${safe.toFixed(3)}`);
    });
  }

  function meters(root){
    root.querySelectorAll('.osflr-meter').forEach(meter=>{
      const match=(meter.closest('td')?.textContent||'').match(/([0-9.]+(?:,[0-9]+)?)\s*%/),share=match?parseClNumber(match[1]):NaN;
      if(Number.isFinite(share)) replaceTrack(meter,barSvg(clamp(share),4,'#58d4c2','#58d4c2'),`meter:${clamp(share).toFixed(3)}`);
    });
  }

  function sectors(root){
    root.querySelectorAll('.osflr-sectors > div').forEach(row=>{
      const text=row.querySelector(':scope > small')?.textContent||'',nums=(text.match(/\d[\d.]*/g)||[]).map(parseClNumber).filter(Number.isFinite),a=nums[0]||0,b=nums[1]||0;
      replaceTrack(row.querySelector(':scope > div'),stackSvg(a,b),`sector:${a}:${b}`);
    });
  }

  function ring(root){
    const card=root.querySelector('[data-osflr-uaf-snapshot]'),host=card?.querySelector('.osflr-ring');
    if(!card||!host) return;
    const values=[...card.querySelectorAll('.osflr-legend b')].map(el=>parseClNumber(el.textContent)).filter(Number.isFinite);
    if(values.length<2) return;
    const strong=(values[0]||0)+(values[1]||0),total=Math.max(1,values.reduce((sum,v)=>sum+v,0)),share=clamp(100*strong/total),circ=2*Math.PI*46,dash=circ*share/100,rest=circ-dash,signature=`ring:${strong}:${total}:${share.toFixed(3)}`;
    if(host.dataset.osflGraphics0951===signature&&host.querySelector('[data-osfl-ring-svg="0951"]')) return;
    host.innerHTML=`<svg data-osfl-ring-svg="0951" viewBox="0 0 120 120" width="110" height="110" role="img" aria-label="Núcleo UAF fuerte: ${strong.toLocaleString('es-CL')}"><circle cx="60" cy="60" r="59" fill="#101e2e"/><circle cx="60" cy="60" r="46" fill="none" stroke="#233347" stroke-width="10"/><circle cx="60" cy="60" r="46" fill="none" stroke="#f1ba4d" stroke-width="10" stroke-linecap="round" stroke-dasharray="${dash.toFixed(3)} ${rest.toFixed(3)}" transform="rotate(-90 60 60)"/><text x="60" y="56" text-anchor="middle" fill="#eef5fb" font-size="17" font-weight="700">${strong.toLocaleString('es-CL')}</text><text x="60" y="72" text-anchor="middle" fill="#91a6ba" font-size="8">${share.toLocaleString('es-CL',{maximumFractionDigits:1})}% núcleo fuerte</text></svg>`;
    host.dataset.osflGraphics0951=signature;
  }

  function repair(reason='module'){
    const roots=[...document.querySelectorAll(ROOT)];
    roots.forEach(root=>{
      ranked(root);distributions(root);meters(root);sectors(root);ring(root);
      root.dataset.osflGraphicsModule='0951';
      root.dataset.osflGraphicsModuleReason=reason;
    });
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
    if(event.target?.closest?.('[data-view="osfl"],[data-nav="osfl"],[href="#osfl"],[data-osflr-tab],[data-osflr-territory-controls] button,[data-jump],[data-page],[data-clear]')) [0,30,100,300,800,1800].forEach(ms=>setTimeout(()=>repair('interaction'),ms));
  },true);
  window.addEventListener('pageshow',()=>repair('pageshow'));
  window.addEventListener('focus',()=>repair('focus'));
  [0,20,60,150,350,700,1200,2500,5000,10000,20000].forEach(ms=>setTimeout(()=>repair('boot'),ms));

  window.__ATLAS_OSFL_GRAPHICS_MODULE_CURRENT__={version:'0.95.1',marker:MARK,cspSafe:true,repair};
}

export { MARK };

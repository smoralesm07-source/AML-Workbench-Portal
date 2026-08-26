'use strict';
/* ATLAS AML · Universo SO · Contacto OSINT intelligence layer 0.84.2 */
(function atlasUniversoSOContactOSINT0842(){
  if(window.AtlasUniversoSOContactOSINT0842)return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const rutFromSheet=sheet=>{const txt=sheet.querySelector('header p')?.textContent||'';const m=txt.match(/\b\d{7,8}-[0-9Kk]\b/);return m?m[0]:''};
  const nameFromSheet=sheet=>sheet.querySelector('header h3')?.textContent?.trim()||'';
  const google=(name,rut,extra='')=>`https://www.google.com/search?q=${encodeURIComponent([`"${name}"`,`"${rut}"`,extra].filter(Boolean).join(' '))}`;
  const cmf=(name,rut)=>`https://www.google.com/search?q=${encodeURIComponent(`site:cmfchile.cl "${name}" "${rut}"`)}`;
  const res=(name,rut)=>`https://www.google.com/search?q=${encodeURIComponent(`site:registrodeempresasysociedades.cl "${name}" "${rut}"`)}`;

  function sourceTier(row){
    const t=(row.querySelector('small')?.textContent||'').toUpperCase();
    if(t.includes('CMF')||t.includes('SII')||t.includes('UAF')||t.includes('MERCADO PÚBLICO')||t.includes('MERCADOPUBLICO'))return['OFICIAL','official'];
    if(t.includes('RES ·')||t.includes('REGISTRODEEMPRESASYSOCIEDADES'))return['REGISTRO PÚBLICO','registry'];
    if(t.includes('BING')||t.includes('DUCKDUCKGO')||t.includes('WEB ABIERTA')||t.includes('DESCUBRIMIENTO WEB'))return['OSINT WEB','web'];
    return['EVIDENCIA ATLAS','atlas'];
  }
  function confidence(row){const t=row.querySelector('small')?.textContent||'';const m=t.match(/confianza\s+(\d+)%/i);return m?Number(m[1]):null}
  function decorateRows(sheet){sheet.querySelectorAll('.uso830-contact').forEach(row=>{if(row.dataset.uso842Decorated==='1')return;row.dataset.uso842Decorated='1';const [label,cls]=sourceTier(row);const tag=document.createElement('span');tag.className=`uso840-tier ${cls}`;tag.textContent=label;row.querySelector('.uso830-contact-main')?.prepend(tag);const c=confidence(row);if(c!==null)row.dataset.uso840Confidence=String(c)})}
  function renameSearch(sheet){const web=sheet.querySelector('.uso820-web h4');if(web&&web.textContent!=='Búsqueda manual y contraste de fuentes')web.textContent='Búsqueda manual y contraste de fuentes';const p=sheet.querySelector('.uso820-web p');const txt='Mantiene las consultas manuales por razón social + RUT para ampliar o contrastar la evidencia automática. Los resultados manuales no se incorporan como oficiales hasta ser registrados y revisados.';if(p&&p.textContent!==txt)p.textContent=txt}
  function summary(sheet){
    const rows=[...sheet.querySelectorAll('.uso830-contact')];const counts={DIRECCION:0,EMAIL:0,TELEFONO:0,WEB:0};let official=0,probable=0,high=0;
    for(const r of rows){const type=(r.querySelector('.uso830-contact-main>span:not(.uso840-tier)')?.textContent||'').trim().toUpperCase();if(counts[type]!==undefined)counts[type]++;const tier=sourceTier(r)[1];if(tier==='official'||tier==='registry')official++;else probable++;const c=confidence(r);if(c!==null&&c>=85)high++}
    const coverage=rows.length===0?'Sin hallazgos':official>0&&probable>0?'Oficial + probable':official>0?'Datos oficiales':'Coincidencias probables';const quality=rows.length===0?'Pendiente':official>0?'Fuente oficial detectada':high>0?'Coincidencia fuerte':'Por revisar';
    const note=rows.length?`${official} dato(s) de fuente oficial/registro público y ${probable} coincidencia(s) probable(s). La procedencia y el estado analista se mantienen separados.`:'No hay contactos materializados todavía. Puedes reejecutar la búsqueda automática o usar la búsqueda manual.';
    const sig=[counts.DIRECCION,counts.EMAIL,counts.TELEFONO,counts.WEB,official,probable,coverage,quality].join('|');let box=sheet.querySelector('.uso840-summary');if(box?.dataset.sig===sig)return;
    const html=`<div class="uso840-summary-head"><div><span>COBERTURA DE CONTACTO</span><b>${esc(coverage)}</b></div><span class="uso840-quality">${esc(quality)}</span></div><div class="uso840-metrics"><div><b>${counts.DIRECCION}</b><span>domicilios</span></div><div><b>${counts.EMAIL}</b><span>correos</span></div><div><b>${counts.TELEFONO}</b><span>teléfonos</span></div><div><b>${counts.WEB}</b><span>web</span></div></div><p>${esc(note)}</p>`;
    if(!box){box=document.createElement('section');box.className='uso840-summary';const warning=sheet.querySelector('.uso820-warning');if(warning)warning.insertAdjacentElement('afterend',box);else sheet.querySelector('header')?.insertAdjacentElement('afterend',box)}box.dataset.sig=sig;box.innerHTML=html;
  }
  function splitEvidence(sheet){
    if(sheet.querySelector('.uso842-evidence-split'))return;
    const grid=sheet.querySelector('.uso820-contact-grid');if(!grid)return;
    const rows=[...grid.querySelectorAll('.uso830-contact')];
    const wrap=document.createElement('section');wrap.className='uso842-evidence-split';
    const official=document.createElement('article');official.className='uso842-evidence official';official.innerHTML='<header><div><span>FUENTES OFICIALES</span><h4>Datos oficiales detectados</h4><p>Información atribuible a organismos públicos o registros oficiales. Sigue siendo revisable por el analista.</p></div><b class="uso842-count">0</b></header><div class="uso842-list"></div>';
    const probable=document.createElement('article');probable.className='uso842-evidence probable';probable.innerHTML='<header><div><span>COINCIDENCIAS OSINT</span><h4>Datos probables</h4><p>Coincidencias halladas en web abierta o evidencia Atlas. Deben contrastarse antes de asumir correspondencia.</p></div><b class="uso842-count">0</b></header><div class="uso842-list"></div>';
    let oc=0,pc=0;for(const row of rows){const cls=sourceTier(row)[1];if(cls==='official'||cls==='registry'){official.querySelector('.uso842-list').appendChild(row);oc++}else{probable.querySelector('.uso842-list').appendChild(row);pc++}}
    official.querySelector('.uso842-count').textContent=String(oc);probable.querySelector('.uso842-count').textContent=String(pc);
    if(!oc)official.querySelector('.uso842-list').innerHTML='<p class="uso842-empty">No se detectaron datos oficiales para esta entidad.</p>';
    if(!pc)probable.querySelector('.uso842-list').innerHTML='<p class="uso842-empty">No se detectaron coincidencias probables adicionales.</p>';
    wrap.append(official,probable);grid.hidden=true;grid.insertAdjacentElement('afterend',wrap);
  }
  function sourceActions(sheet){const box=sheet.querySelector('.uso820-web');if(!box||box.querySelector('.uso840-source-actions'))return;const rut=rutFromSheet(sheet),name=nameFromSheet(sheet);if(!rut&&!name)return;const wrap=document.createElement('div');wrap.className='uso840-source-actions';wrap.innerHTML=`<a target="_blank" rel="noopener noreferrer" href="${esc(cmf(name,rut))}"><b>CMF</b><span>registro oficial</span></a><a target="_blank" rel="noopener noreferrer" href="${esc(res(name,rut))}"><b>RES</b><span>sociedad y domicilio</span></a><a target="_blank" rel="noopener noreferrer" href="${esc(google(name,rut,'contacto email telefono direccion'))}"><b>Google</b><span>búsqueda exacta</span></a>`;box.querySelector('h4')?.insertAdjacentElement('afterend',wrap)}
  function decorate(){const sheet=document.querySelector('#uso830-sheet');if(!sheet||!sheet.classList.contains('open'))return;const marker=sheet.querySelector('header span');if(!marker||!/FICHA DE CONTACTO OSINT|CONTACTO OSINT/i.test(marker.textContent||''))return;sheet.classList.add('uso840-contact-sheet');const markerText='CONTACTO OSINT · EVIDENCIA OFICIAL Y PROBABLE · 0.84.2';if(marker.textContent!==markerText)marker.textContent=markerText;const warning=sheet.querySelector('.uso820-warning');const warningHtml='<b>Separación por procedencia.</b> ATLAS muestra primero datos obtenidos desde fuentes oficiales o registros públicos y, aparte, coincidencias probables OSINT. La validación analista continúa disponible para cada hallazgo.';if(warning&&warning.innerHTML!==warningHtml)warning.innerHTML=warningHtml;decorateRows(sheet);summary(sheet);splitEvidence(sheet);renameSearch(sheet);sourceActions(sheet)}
  let timer=0;const schedule=()=>{clearTimeout(timer);timer=setTimeout(decorate,60)};const observer=new MutationObserver(muts=>{if(muts.some(m=>m.target?.closest?.('#uso830-sheet')||[...m.addedNodes].some(n=>n.nodeType===1&&(n.id==='uso830-sheet'||n.querySelector?.('#uso830-sheet')))))schedule()});const start=()=>{if(document.body)observer.observe(document.body,{childList:true,subtree:true});decorate()};document.addEventListener('click',e=>{if(e.target.closest?.('[data-uso830-contact],#uso830-rerun,.uso830-contact-state'))setTimeout(decorate,120)},true);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();window.AtlasUniversoSOContactOSINT0842={version:'0.84.2',decorate};
})();
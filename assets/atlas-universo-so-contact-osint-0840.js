'use strict';
/* ATLAS AML · Universo SO · Contacto OSINT intelligence layer 0.84.0 */
(function atlasUniversoSOContactOSINT0840(){
  if(window.AtlasUniversoSOContactOSINT0840)return;
  const rerunAttempted=new Set();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cleanRut=v=>String(v||'').toUpperCase().replace(/[^0-9K]/g,'');
  const rutFromSheet=sheet=>{const txt=sheet.querySelector('header p')?.textContent||'';const m=txt.match(/\b\d{7,8}-[0-9Kk]\b/);return m?m[0]:''};
  const nameFromSheet=sheet=>sheet.querySelector('header h3')?.textContent?.trim()||'';
  const google=(name,rut,extra='')=>`https://www.google.com/search?q=${encodeURIComponent([`"${name}"`,`"${rut}"`,extra].filter(Boolean).join(' '))}`;
  const cmf=(name,rut)=>`https://www.google.com/search?q=${encodeURIComponent(`site:cmfchile.cl "${name}" "${rut}"`)}`;
  const res=(name,rut)=>`https://www.google.com/search?q=${encodeURIComponent(`site:registrodeempresasysociedades.cl "${name}" "${rut}"`)}`;

  function sourceTier(row){
    const t=(row.querySelector('small')?.textContent||'').toUpperCase();
    if(t.includes('CMF'))return['OFICIAL','official'];
    if(t.includes('RES ·')||t.includes('REGISTRODEEMPRESASYSOCIEDADES'))return['REGISTRO PÚBLICO','registry'];
    if(t.includes('BING')||t.includes('DUCKDUCKGO')||t.includes('WEB ABIERTA')||t.includes('DESCUBRIMIENTO WEB'))return['OSINT WEB','web'];
    return['EVIDENCIA ATLAS','atlas'];
  }
  function confidence(row){
    const t=row.querySelector('small')?.textContent||'';const m=t.match(/confianza\s+(\d+)%/i);return m?Number(m[1]):null;
  }
  function decorateRows(sheet){
    sheet.querySelectorAll('.uso830-contact').forEach(row=>{
      if(row.querySelector('.uso840-tier'))return;
      const [label,cls]=sourceTier(row);const tag=document.createElement('span');tag.className=`uso840-tier ${cls}`;tag.textContent=label;
      row.querySelector('.uso830-contact-main')?.prepend(tag);
      const c=confidence(row);if(c!==null)row.dataset.uso840Confidence=String(c);
    });
  }
  function renameSections(sheet){
    const articles=[...sheet.querySelectorAll('.uso820-contact-grid>article')];
    const labels=['Domicilio y ubicación','Correos electrónicos','Teléfonos','Presencia web y otros'];
    articles.forEach((a,i)=>{const h=a.querySelector('h4');if(h&&labels[i])h.textContent=labels[i]});
    const web=sheet.querySelector('.uso820-web h4');if(web)web.textContent='Búsqueda asistida y contraste de fuentes';
    const p=sheet.querySelector('.uso820-web p');if(p)p.textContent='Abre consultas exactas por razón social + RUT para contrastar hallazgos. ATLAS prioriza fuentes oficiales y conserva la procedencia de cada dato.';
  }
  function summary(sheet){
    sheet.querySelector('.uso840-summary')?.remove();
    const rows=[...sheet.querySelectorAll('.uso830-contact')];
    const counts={DIRECCION:0,EMAIL:0,TELEFONO:0,WEB:0};let official=0,probable=0,high=0;
    for(const r of rows){const type=(r.querySelector('.uso830-contact-main>span:not(.uso840-tier)')?.textContent||'').trim().toUpperCase();if(counts[type]!==undefined)counts[type]++;const tier=sourceTier(r)[1];if(tier==='official'||tier==='registry')official++;const c=confidence(r);if(c!==null&&c>=85)high++;if(r.classList.contains('probable')||r.classList.contains('verificado'))probable++}
    const coverage=rows.length===0?'Sin hallazgos':official>0?'Oficial + OSINT':'OSINT web';
    const quality=rows.length===0?'Pendiente':high>0?'Alta evidencia':probable>0?'Con señales':'Por revisar';
    const html=`<section class="uso840-summary"><div class="uso840-summary-head"><div><span>COBERTURA DE CONTACTO</span><b>${esc(coverage)}</b></div><span class="uso840-quality">${esc(quality)}</span></div><div class="uso840-metrics"><div><b>${counts.DIRECCION}</b><span>domicilios</span></div><div><b>${counts.EMAIL}</b><span>correos</span></div><div><b>${counts.TELEFONO}</b><span>teléfonos</span></div><div><b>${counts.WEB}</b><span>web</span></div></div><p>${rows.length?`${rows.length} hallazgo(s) materializados. ${official} provienen de fuente oficial o registro público. Cada dato mantiene fuente, confianza y estado de verificación.`:'No hay contactos materializados todavía. ATLAS reintentará automáticamente con registros oficiales y descubrimiento web ampliado.'}</p></section>`;
    const warning=sheet.querySelector('.uso820-warning');if(warning)warning.insertAdjacentHTML('afterend',html);
  }
  function sourceActions(sheet){
    const box=sheet.querySelector('.uso820-web');if(!box||box.querySelector('.uso840-source-actions'))return;
    const rut=rutFromSheet(sheet),name=nameFromSheet(sheet);if(!rut&&!name)return;
    const wrap=document.createElement('div');wrap.className='uso840-source-actions';
    wrap.innerHTML=`<a target="_blank" rel="noopener noreferrer" href="${esc(cmf(name,rut))}"><b>CMF</b><span>registro oficial</span></a><a target="_blank" rel="noopener noreferrer" href="${esc(res(name,rut))}"><b>RES</b><span>sociedad y domicilio</span></a><a target="_blank" rel="noopener noreferrer" href="${esc(google(name,rut,'contacto email telefono direccion'))}"><b>Web</b><span>búsqueda exacta</span></a>`;
    const h=box.querySelector('h4');h?.insertAdjacentElement('afterend',wrap);
  }
  function autoRecover(sheet){
    const rut=rutFromSheet(sheet);if(!rut||rerunAttempted.has(cleanRut(rut)))return;
    const rows=sheet.querySelectorAll('.uso830-contact').length;const jobText=sheet.querySelector('.uso830-job-panel')?.textContent||'';
    if(rows>0&&!/0\s+hallazgos/i.test(jobText))return;
    const btn=sheet.querySelector('#uso830-rerun');if(!btn)return;
    rerunAttempted.add(cleanRut(rut));
    const state=sheet.querySelector('.uso830-run-state');if(state)state.textContent='ATLAS detectó cobertura vacía: reintentando con CMF, registros públicos y búsqueda web ampliada…';
    setTimeout(()=>{if(document.body.contains(btn))btn.click()},220);
  }
  function decorate(){
    const sheet=document.querySelector('#uso830-sheet');if(!sheet||!sheet.classList.contains('open'))return;
    const marker=sheet.querySelector('header span');if(!marker||!/FICHA DE CONTACTO OSINT|CONTACTO OSINT/i.test(marker.textContent||''))return;
    sheet.classList.add('uso840-contact-sheet');marker.textContent='CONTACTO OSINT · IDENTIDAD Y EVIDENCIA · 0.84';
    const warning=sheet.querySelector('.uso820-warning');if(warning)warning.innerHTML='<b>Hallazgo asistido, no conclusión.</b> ATLAS cruza razón social + RUT, prioriza registros oficiales y luego amplía a web abierta. Un dato automático queda Probable/No verificado hasta validación del analista.';
    renameSections(sheet);decorateRows(sheet);summary(sheet);sourceActions(sheet);autoRecover(sheet);
  }
  let queued=false;const queue=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;decorate()})};
  const observer=new MutationObserver(queue);observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-uso830-contact],#uso830-rerun,.uso830-contact-state'))setTimeout(decorate,80)},true);
  window.addEventListener('load',()=>setTimeout(decorate,150));setTimeout(decorate,0);
  window.AtlasUniversoSOContactOSINT0840={version:'0.84.0',decorate};
})();
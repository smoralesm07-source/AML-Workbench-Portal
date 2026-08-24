'use strict';

/* ATLAS AML 0.52.0 · Entidades · Identidad digital OSINT (Sherlock)
 *
 * - Ejecuta búsquedas sólo por acción explícita del analista.
 * - Reutiliza la sesión Supabase para autenticar el microservicio OSINT.
 * - Mantiene semántica conservadora: username coincidente != identidad confirmada.
 * - No persiste resultados ni consultas en localStorage/sessionStorage.
 * - Auditoría del frontend usa hash SHA-256; no envía username en texto plano.
 */
(function atlasEntityOsintSherlock0520(){
  const RELEASE='0.52.0';
  const BUILD='0520';
  const AUTHORITY='ENTITY_OSINT_SHERLOCK_0520';
  const BASE_RENDER=typeof window.v0203RenderEntity==='function'?window.v0203RenderEntity:null;
  if(!BASE_RENDER){
    window.__ATLAS_ENTITY_OSINT_0520__={active:false,reason:'entity-renderer-unavailable'};
    return;
  }

  const CONFIG=()=>window.__ATLAS_OSINT_CONFIG__||{};
  const MEMORY=new Map();
  let sequence=0;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const selected=()=>{try{return (typeof state!=='undefined'?state:(window.state||null))?.selectedEntity||null;}catch(_e){return null;}};
  const currentSb=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  const normalize=v=>String(v||'').trim();
  const validUsername=v=>/^[A-Za-z0-9_.-]{2,64}$/.test(normalize(v));

  async function sha256(value){
    const data=new TextEncoder().encode(String(value));
    const digest=await crypto.subtle.digest('SHA-256',data);
    return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  function profileCandidates(entity){
    const p=entity?.profile||{};
    const raw=[
      ...(Array.isArray(p.usernames)?p.usernames:[]),
      ...(Array.isArray(p.aliases)?p.aliases:[]),
      ...(Array.isArray(p.aliases_es)?p.aliases_es:[]),
      p.username,p.handle,p.alias
    ].filter(Boolean);
    const seen=new Set();
    return raw.map(normalize).filter(validUsername).filter(x=>{
      const key=x.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;
    }).slice(0,8);
  }

  function endpoint(){
    const base=normalize(CONFIG().apiBase).replace(/\/$/,'');
    return base?`${base}/v1/username`:'';
  }

  async function accessToken(){
    const client=currentSb();
    if(!client?.auth?.getSession)throw new Error('Sesión Supabase no disponible.');
    const {data,error}=await client.auth.getSession();
    if(error)throw error;
    const token=data?.session?.access_token;
    if(!token)throw new Error('Sesión expirada o no autenticada.');
    return token;
  }

  function statusBadge(){
    const cfg=CONFIG();
    const ready=cfg.enabled!==false&&!!endpoint();
    return `<span class="aos-status ${ready?'ready':'pending'}"><i></i>${ready?'conector disponible':'servicio pendiente'}</span>`;
  }

  function methodology(){
    return `<details class="aos-method">
      <summary>Cómo leer esta búsqueda</summary>
      <div class="aos-method-body">
        <p><b>Sherlock detecta presencia de un mismo nombre de usuario en sitios públicos.</b> Una coincidencia no demuestra que las cuentas pertenezcan a la entidad investigada.</p>
        <ul>
          <li>El resultado se registra como <b>candidato de identidad digital</b>.</li>
          <li>No transfiere atributos, relaciones ni riesgo hacia la entidad.</li>
          <li>El analista debe corroborar identidad con evidencia adicional antes de promover un vínculo.</li>
          <li>Errores, bloqueos WAF o sitios no consultables se muestran como cobertura técnica, no como ausencia.</li>
        </ul>
      </div>
    </details>`;
  }

  function baseMarkup(entity){
    const suggestions=profileCandidates(entity);
    const cfg=CONFIG();
    const ready=cfg.enabled!==false&&!!endpoint();
    return `<article class="aed-card aos-card" id="aos-sherlock">
      <header class="aos-head">
        <div><h3>Identidad digital · OSINT</h3><span class="aed-src">SHERLOCK · FUENTE ABIERTA</span></div>
        ${statusBadge()}
      </header>
      <div class="aos-intro">
        <div><b>Buscar presencia por username</b><span>Consulta transversal de cuentas públicas sin promover identidad automáticamente.</span></div>
        <span class="aos-semantic">USERNAME_COINCIDENCE_ONLY</span>
      </div>
      ${suggestions.length?`<div class="aos-suggestions"><span>Alias observados en el perfil</span>${suggestions.map(x=>`<button type="button" data-aos-suggest="${esc(x)}">${esc(x)}</button>`).join('')}</div>`:''}
      <form class="aos-form" id="aos-form">
        <label for="aos-username">Username</label>
        <div class="aos-input-row">
          <input id="aos-username" autocomplete="off" spellcheck="false" maxlength="64" placeholder="ej. jperez_77" aria-describedby="aos-help" ${ready?'':'disabled'} />
          <button type="submit" class="aed-btn primary" ${ready?'':'disabled'}>Buscar presencia</button>
        </div>
        <small id="aos-help">2–64 caracteres: letras, números, punto, guion o guion bajo.</small>
      </form>
      ${ready?'':`<div class="aos-pending"><b>La interfaz está instalada.</b><span>Falta publicar el microservicio Sherlock y definir <code>apiBase</code> en <code>atlas-osint-config.js</code>. Atlas seguirá funcionando normalmente hasta entonces.</span></div>`}
      <div id="aos-result" class="aos-result" aria-live="polite"></div>
      ${methodology()}
    </article>`;
  }

  function ensureHolder(pkg){
    const root=document.querySelector('#content .a45');
    if(!root)return null;
    const panel=root.querySelector('[data-a45-panel="identity"]');
    if(!panel)return null;
    let holder=panel.querySelector('[data-aos-holder="sherlock"]');
    if(!holder){
      holder=document.createElement('div');
      holder.dataset.aosHolder='sherlock';
      holder.className='aos-holder';
      panel.appendChild(holder);
    }
    holder.innerHTML=baseMarkup(pkg?.e||{});
    return holder;
  }

  function renderResults(container,payload,username){
    const summary=payload?.summary||{};
    const rows=Array.isArray(payload?.results)?payload.results:[];
    const observed=payload?.evidence?.observed_at?new Date(payload.evidence.observed_at).toLocaleString('es-CL'):'—';
    const coverageIssue=(Number(summary.unknown_count)||0)+(Number(summary.blocked_count)||0);
    container.innerHTML=`
      <div class="aos-summary">
        <div><b>${rows.length}</b><span>coincidencias</span></div>
        <div><b>${Number(summary.sites_checked)||0}</b><span>sitios evaluados</span></div>
        <div><b>${coverageIssue}</b><span>sin conclusión técnica</span></div>
        <div><b>${Math.max(0,Math.round((Number(summary.duration_ms)||0)/1000))} s</b><span>duración</span></div>
      </div>
      <div class="aos-query-line"><span>Consulta</span><code>${esc(username)}</code><span>· observada ${esc(observed)}</span><button type="button" id="aos-clear">Limpiar</button></div>
      ${rows.length?`<div class="aos-results-grid">${rows.map(r=>`<a class="aos-result-row" href="${esc(r.url||'#')}" target="_blank" rel="noopener noreferrer nofollow">
          <span class="aos-platform"><i>${esc(String(r.platform||'?').slice(0,1).toUpperCase())}</i><b>${esc(r.platform||'Sitio')}</b></span>
          <span class="aos-evidence"><em>coincidencia de username</em><small>${r.http_status?`HTTP ${esc(r.http_status)}`:'respuesta evaluada'}${r.query_time_ms!=null?` · ${esc(r.query_time_ms)} ms`:''}</small></span>
          <span class="aos-open">Abrir ↗</span>
        </a>`).join('')}</div>`:`<div class="aos-empty"><b>Sin coincidencias positivas observadas.</b><span>Esto no prueba ausencia de presencia digital. La cobertura técnica fue ${Number(summary.sites_checked)||0} sitios; bloqueos y estados desconocidos se contabilizan aparte.</span></div>`}
      <div class="aos-caution"><b>No promover identidad automáticamente.</b> Las cuentas encontradas comparten el username consultado; requieren corroboración independiente antes de vincularlas con esta entidad.</div>`;
    container.querySelector('#aos-clear')?.addEventListener('click',()=>{container.innerHTML='';});
  }

  async function query(holder,pkg,username){
    const result=holder.querySelector('#aos-result');
    const form=holder.querySelector('#aos-form');
    const submit=form?.querySelector('button[type="submit"]');
    if(!validUsername(username)){
      result.innerHTML='<div class="aos-error">Username inválido. Usa sólo letras, números, punto, guion o guion bajo.</div>';
      return;
    }
    const requestId=++sequence;
    result.innerHTML='<div class="aos-loading"><i></i><span>Consultando fuentes públicas con Sherlock…</span></div>';
    if(submit)submit.disabled=true;
    try{
      const token=await accessToken();
      const response=await fetch(endpoint(),{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        body:JSON.stringify({username,entity_id:pkg?.e?.entity_id||null}),
        cache:'no-store',
        credentials:'omit',
        referrerPolicy:'no-referrer'
      });
      if(!response.ok){
        let detail='';try{detail=(await response.json())?.detail||'';}catch(_e){}
        const labels={rate_limit_exceeded:'Se alcanzó el límite de consultas OSINT.',invalid_session:'La sesión ya no es válida.',engine_timeout:'Sherlock excedió el tiempo máximo.',engine_failure:'El motor Sherlock no pudo completar la consulta.'};
        throw new Error(labels[detail]||`Servicio OSINT respondió HTTP ${response.status}.`);
      }
      const payload=await response.json();
      if(payload?.schema!=='ATLAS_OSINT_USERNAME_V1')throw new Error('Contrato OSINT inesperado.');
      if(requestId!==sequence||selected()!==pkg?.e?.entity_id)return;
      MEMORY.set(pkg.e.entity_id,{username,payload,loadedAt:Date.now()});
      renderResults(result,payload,username);
      if(typeof audit==='function'){
        const hash=await sha256(username.toLowerCase());
        await audit('OSINT_QUERY',{objectType:'entity',objectId:pkg.e.entity_id,payload:{engine:'sherlock',query_sha256:hash,query_length:username.length,found_count:payload?.summary?.found_count||0,schema:payload.schema,build:BUILD}}).catch(()=>{});
      }
    }catch(error){
      if(requestId!==sequence)return;
      result.innerHTML=`<div class="aos-error"><b>No fue posible completar la búsqueda.</b><span>${esc(error?.message||error)}</span></div>`;
    }finally{
      if(submit)submit.disabled=false;
    }
  }

  function bind(holder,pkg){
    holder.querySelectorAll('[data-aos-suggest]').forEach(btn=>btn.addEventListener('click',()=>{
      const input=holder.querySelector('#aos-username');if(input){input.value=btn.dataset.aosSuggest||'';input.focus();}
    }));
    holder.querySelector('#aos-form')?.addEventListener('submit',event=>{
      event.preventDefault();
      const username=normalize(holder.querySelector('#aos-username')?.value);
      void query(holder,pkg,username);
    });
    const cached=MEMORY.get(pkg?.e?.entity_id);
    if(cached&&Date.now()-cached.loadedAt<10*60*1000){
      const result=holder.querySelector('#aos-result');
      if(result)renderResults(result,cached.payload,cached.username);
    }
  }

  function decorate(pkg){
    if(!pkg?.e?.entity_id)return;
    const holder=ensureHolder(pkg);
    if(holder)bind(holder,pkg);
    window.__ATLAS_ENTITY_OSINT_0520__={active:true,release:RELEASE,build:BUILD,authority:AUTHORITY,entityId:pkg.e.entity_id,configured:!!endpoint(),cachePolicy:'MEMORY_ONLY',identitySemantics:'USERNAME_COINCIDENCE_ONLY',renderedAt:new Date().toISOString()};
  }

  function render(pkg,preserve=false){
    const output=BASE_RENDER(pkg,preserve);
    try{decorate(pkg);}catch(_e){}
    return output;
  }

  try{v0203RenderEntity=render;}catch(_e){}
  window.v0203RenderEntity=render;
  window.__ATLAS_ENTITY_OSINT_0520__={active:true,release:RELEASE,build:BUILD,authority:AUTHORITY,configured:!!endpoint(),cachePolicy:'MEMORY_ONLY',installedAt:new Date().toISOString()};
})();

'use strict';

/* ATLAS AML 0.52.1 · Sherlock OSINT under demand */
(function atlasSherlock0521(){
  const FN='aml-entity-sherlock-live';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const client=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null);}catch(_e){return window.sb||null;}};
  function host(){
    const groups=[...document.querySelectorAll('.aei-group')];
    const group=groups.find(g=>/Profundización OSINT/i.test(g.querySelector('h4')?.textContent||''));
    return group?.querySelector('.aei-source-grid')||null;
  }
  function markup(){
    return `<article class="aei-source-card aei-sherlock-card" data-sherlock-card>
      <div class="aei-source-head"><div><b>Sherlock</b><small>OSINT de username · bajo demanda</small></div><span class="aei-status neutral" data-sherlock-status>Preparado</span></div>
      <p>Busca el mismo alias en plataformas públicas usando el catálogo y reglas mantenidas por Sherlock. El username coincidente no prueba identidad.</p>
      <div class="aei-sherlock-form"><input type="text" data-sherlock-username autocomplete="off" spellcheck="false" placeholder="username o alias" aria-label="Username para buscar con Sherlock"/><button type="button" data-sherlock-run>Buscar</button></div>
      <div class="aei-sherlock-results" data-sherlock-results><span>Sin consulta todavía.</span></div>
      <footer><span>No modifica IPA3</span><span>No persiste la consulta</span></footer>
    </article>`;
  }
  function renderResult(data){
    const a=data?.analytics||{},rows=Array.isArray(data?.records)?data.records:[];
    const head=`<div class="aei-sherlock-kpis"><span><b>${Number(a.tested||0)}</b><small>sitios probados</small></span><span><b>${Number(a.claimed||0)}</b><small>perfiles observados</small></span><span><b>${Number(a.unknown||0)}</b><small>indeterminados</small></span></div>`;
    const list=rows.length?`<div class="aei-sherlock-list">${rows.slice(0,16).map(r=>`<a href="${esc(r.source_url||'#')}" target="_blank" rel="noopener noreferrer"><b>${esc(r.evidence?.platform||r.title||'Perfil')}</b><span>${esc(r.evidence?.username||'')}</span><small>possible match · requiere corroboración</small></a>`).join('')}</div>`:'<div class="aei-sherlock-empty">No se observaron perfiles reclamados en el conjunto probado.</div>';
    return head+list;
  }
  async function run(card){
    const input=card.querySelector('[data-sherlock-username]'),button=card.querySelector('[data-sherlock-run]'),status=card.querySelector('[data-sherlock-status]'),out=card.querySelector('[data-sherlock-results]');
    const username=String(input?.value||'').trim();if(username.length<2){out.textContent='Ingresa un username de al menos 2 caracteres.';return;}
    const db=client();if(!db){out.textContent='Supabase no disponible.';return;}
    button.disabled=true;status.textContent='Consultando';status.className='aei-status warn';out.textContent='Consultando catálogo Sherlock y plataformas públicas…';
    try{
      const {data,error}=await db.functions.invoke(FN,{body:{username}});if(error)throw error;if(!data?.ok)throw new Error(data?.error||'Sherlock no disponible');
      status.textContent='Live';status.className='aei-status ok';out.innerHTML=renderResult(data);
      window.__ATLAS_SHERLOCK_0521__={active:true,username,analytics:data.analytics||{},registry:data.registry||null,checkedAt:data.checked_at||null,identityAssertion:false,scoreMutation:false};
    }catch(e){status.textContent='Degradado';status.className='aei-status bad';out.textContent='No fue posible completar la consulta Sherlock: '+String(e?.message||e);}
    finally{button.disabled=false;}
  }
  function mount(){const h=host();if(!h||h.querySelector('[data-sherlock-card]'))return;h.insertAdjacentHTML('beforeend',markup());const card=h.querySelector('[data-sherlock-card]');card.querySelector('[data-sherlock-run]')?.addEventListener('click',()=>void run(card));card.querySelector('[data-sherlock-username]')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void run(card);}});}
  const obs=new MutationObserver(()=>mount());obs.observe(document.documentElement,{subtree:true,childList:true});mount();
  window.__ATLAS_SHERLOCK_0521__={active:true,mode:'ON_DEMAND_USERNAME',identityAssertion:false,scoreMutation:false,installedAt:new Date().toISOString()};
})();
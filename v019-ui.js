'use strict';

const V19='0.19.0';

function v19Tab(view,label){
  return `<button type="button" class="v19-tab ${state.view===view?'active':''}" data-view="${esc(view)}">${esc(label)}</button>`;
}

function v19Shell(title,subtitle){
  const role=state.access?.role||'viewer';
  const email=state.user?.email||'usuario';
  app.innerHTML=`<div class="v19-shell">
    <header class="v19-topbar">
      <div class="v19-brand"><span class="v19-mark">AML</span><strong>Analytical Workbench</strong></div>
      <nav class="v19-tabs" aria-label="Navegación principal">
        ${v19Tab('overview','Panorama')}
        ${v19Tab('findings','Hallazgos')}
        ${v19Tab('patterns','Fenómenos')}
        ${v19Tab('sanctions','Sanciones')}
        ${v19Tab('entities','Entidades')}
      </nav>
      <div class="v19-session"><span class="v19-role">${esc(role)}</span><button type="button" id="logout" class="v19-logout" title="${esc(email)}">Salir</button></div>
    </header>
    <main class="v19-main">
      <div class="v19-page-title"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div></div>
      <section id="content"><div class="loading">Consultando datos autorizados…</div></section>
    </main>
  </div>`;
  document.querySelector('#logout').onclick=signOut;
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>navigate(b.dataset.view));
}

shell=v19Shell;

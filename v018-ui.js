'use strict';

const V18='0.18.0';

function v18NavButton(view,label){
  return `<button type="button" class="v18-nav-btn ${state.view===view?'active':''}" data-view="${esc(view)}">${esc(label)}</button>`;
}

function v18Shell(title,subtitle){
  const role=state.access?.role||'viewer';
  const email=state.user?.email||'usuario';
  app.innerHTML=`<div class="v18-shell">
    <header class="v18-appbar">
      <div class="v18-brand"><div class="brand-mark">AML</div><div><strong>Analytical Workbench</strong><span>Inteligencia financiera basada en evidencia</span></div></div>
      <nav class="v18-nav" aria-label="Navegación principal">
        ${v18NavButton('overview','Panorama')}
        ${v18NavButton('entities','Entidades')}
        ${v18NavButton('findings','Hallazgos')}
        ${v18NavButton('sanctions','Sanciones')}
        ${v18NavButton('patterns','Fenómenos')}
      </nav>
      <div class="v18-session"><span class="v18-secure-dot">●</span><span>${esc(role)}</span><button type="button" class="v18-session-btn" id="logout" title="${esc(email)}">Salir</button></div>
    </header>
    <main class="v18-main">
      <header class="v18-pagehead">
        <div><div class="eyebrow">AML Workbench · v${V18}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>
        <div class="v18-page-actions">${v17InfoButton('Cómo leer esta pantalla','<p>La interfaz prioriza hechos y comparaciones observables. Un puntaje o índice ordena revisión; no representa probabilidad de delito. Los detalles metodológicos quedan disponibles sólo cuando se necesitan.</p>',true)}</div>
      </header>
      <section id="content"><div class="loading">Consultando datos autorizados…</div></section>
    </main>
  </div>`;
  document.querySelector('#logout').onclick=signOut;
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>navigate(b.dataset.view));
}

shell=v18Shell;

'use strict';

const SUPABASE_URL = 'https://ldmtlwzqaqmegedktlxr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Nu21dZFBM3NwtIvOwIM8ag_9tyfDJyR';
const REDIRECT_TO = 'https://smoralesm07-source.github.io/AML-Workbench-Portal/';
const APP_VERSION = '0.15.0';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const app = document.querySelector('#app');
const state = { user: null, access: null, view: 'overview', selectedEntity: null };

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const fmtNum = (v) => new Intl.NumberFormat('es-CL').format(Number(v || 0));
const fmtDate = (v) => v ? new Intl.DateTimeFormat('es-CL', { year:'numeric', month:'short', day:'2-digit' }).format(new Date(`${v}T12:00:00`)) : '—';
const fmtDateTime = (v) => v ? new Intl.DateTimeFormat('es-CL', { dateStyle:'medium', timeStyle:'short' }).format(new Date(v)) : '—';
const fmtScore = (v) => Number.isFinite(Number(v)) ? Number(v).toFixed(1) : '—';
const scoreClass = (v) => Number(v) >= 75 ? 'high' : Number(v) >= 50 ? 'med' : 'low';
const truncate = (v, n = 150) => { const s = String(v ?? ''); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const cleanSearch = (v) => String(v ?? '').trim().replace(/[%_]/g, '').slice(0, 120);

function renderAuthCard({ eyebrow='AML Analytical Workbench', title, body, action='', error='' }) {
  app.innerHTML = `<section class="auth-screen"><div class="auth-card">
    <div class="brand-mark">AML</div><div class="eyebrow">${esc(eyebrow)}</div>
    <h1>${esc(title)}</h1><p>${esc(body)}</p>${error ? `<p class="error">${esc(error)}</p>` : ''}${action}
  </div></section>`;
}

async function signIn() {
  const { error } = await sb.auth.signInWithOAuth({ provider:'azure', options:{ scopes:'email', redirectTo:REDIRECT_TO } });
  if (error) renderAuthCard({ title:'No fue posible iniciar sesión', body:'La autenticación no pudo iniciarse.', error:error.message, action:'<button class="primary" id="retry">Reintentar</button>' });
  document.querySelector('#retry')?.addEventListener('click', signIn);
}
async function signOut() { await sb.auth.signOut(); location.href = REDIRECT_TO; }

function renderLogin() {
  renderAuthCard({
    eyebrow:'Acceso controlado', title:'AML Analytical Workbench',
    body:'Entorno analítico OSINT/AML protegido por Microsoft Entra, Supabase Auth, allowlist y Row Level Security.',
    action:'<button class="primary" id="login">Ingresar con Microsoft</button><p class="small muted">Autenticarse no otorga acceso automático: la autorización AML se valida por separado.</p>'
  });
  document.querySelector('#login').addEventListener('click', signIn);
}
function renderPending() {
  renderAuthCard({ eyebrow:'Autenticación correcta', title:'Acceso pendiente de habilitación', body:'La identidad fue autenticada, pero RLS mantiene los datos cerrados hasta que la cuenta sea habilitada en aml_allowed_users.', action:'<button class="ghost" id="logout">Cerrar sesión</button>' });
  document.querySelector('#logout').addEventListener('click', signOut);
}
function renderError(message) {
  renderAuthCard({ eyebrow:'Error', title:'No fue posible abrir el Workbench', body:'Se produjo un error al validar la sesión o consultar los datos.', error:message, action:'<button class="ghost" id="logout">Cerrar sesión</button>' });
  document.querySelector('#logout').addEventListener('click', signOut);
}

function shell(viewTitle, viewSubtitle) {
  const role = state.access?.role || 'viewer';
  const email = state.user?.email || 'usuario';
  app.innerHTML = `<div class="shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">AML</div><div class="brand-copy"><strong>Analytical Workbench</strong><span>Fusion Intelligence</span></div></div>
      <nav class="nav">
        ${navButton('overview','Resumen','01')}${navButton('entities','Entity 360','02')}${navButton('findings','Hallazgos','03')}${navButton('sanctions','Sanciones','04')}${navButton('patterns','Patrones','05')}
      </nav>
      <div class="sidebar-foot"><div class="small muted">${esc(email)}</div><span class="role">${esc(role)}</span><button class="ghost" id="logout">Cerrar sesión</button></div>
    </aside>
    <main class="main">
      <header class="topbar"><div><div class="eyebrow">AML Analytical Workbench · v${APP_VERSION}</div><h1>${esc(viewTitle)}</h1><p>${esc(viewSubtitle)}</p></div>
      <div class="status"><span class="status-pill good">● Entra + Auth OK</span><span class="status-pill good">● RLS activo</span><span class="status-pill">${esc(role)}</span></div></header>
      <div class="notice">Herramienta de priorización analítica basada en evidencia OSINT. Los scores expresan prioridad comparativa, no probabilidad de delito. “No observado UAF” no equivale a no inscripción.</div>
      <section id="content"><div class="loading">Consultando Fusion…</div></section>
    </main>
  </div>`;
  document.querySelector('#logout').addEventListener('click', signOut);
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.view)));
}
function navButton(id, label, number) { return `<button class="nav-btn ${state.view===id?'active':''}" data-view="${id}">${label}<span>${number}</span></button>`; }
function content() { return document.querySelector('#content'); }

async function audit(eventType, { objectType=null, objectId=null, queryHash=null, queryLength=null, payload={} } = {}) {
  if (!state.user) return;
  const row = { user_id:state.user.id, event_type:eventType, object_type:objectType, object_id:objectId, query_sha256:queryHash, query_length:queryLength, payload };
  const { error } = await sb.from('aml_audit_log').insert(row);
  if (error) console.warn('Audit insert failed:', error.message);
}
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2,'0')).join('');
}
async function auditSession() {
  const key = `aml-session-audited:${state.user.id}`;
  if (sessionStorage.getItem(key)) return;
  await audit('SESSION_START', { objectType:'workbench', objectId:APP_VERSION, payload:{ role:state.access.role } });
  sessionStorage.setItem(key,'1');
}

async function countRows(table, applyFilter) {
  let q = sb.from(table).select('*', { count:'exact', head:true });
  if (applyFilter) q = applyFilter(q);
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

async function navigate(view) {
  state.view = view;
  if (view === 'overview') return loadOverview();
  if (view === 'entities') return loadEntities();
  if (view === 'findings') return loadFindings();
  if (view === 'sanctions') return loadSanctions();
  if (view === 'patterns') return loadPatterns();
}

async function loadOverview() {
  state.view='overview'; shell('Resumen operativo','Vista ejecutiva del corte Fusion disponible en Supabase.');
  try {
    const [entities, findings, sanctions, patterns, uafObserved, laftSanctions, topFindingsRes, recentSanctionsRes, patternsRes] = await Promise.all([
      countRows('aml_entities'), countRows('aml_findings'), countRows('aml_sanctions'), countRows('aml_pattern_alerts'),
      countRows('aml_entities', q => q.eq('is_uaf_observed', true)), countRows('aml_sanctions', q => q.eq('laft_direct', true)),
      sb.from('aml_findings').select('finding_key,finding_type,entity_id,title,region,commune,score_investigate,source_count,evidence_count').order('score_investigate',{ascending:false,nullsFirst:false}).limit(8),
      sb.from('aml_sanctions').select('sanction_id,event_date,regulator,entity_name,entity_id,identity_status,laft_direct,subject').order('event_date',{ascending:false,nullsFirst:false}).limit(8),
      sb.from('aml_pattern_alerts').select('alert_id,family,pattern_type,scope_type,scope_id,scope_label,strength,priority,title,summary').order('strength',{ascending:false,nullsFirst:false}).limit(6)
    ]);
    [topFindingsRes,recentSanctionsRes,patternsRes].forEach((r) => { if (r.error) throw r.error; });
    content().innerHTML = `<div class="kpis">
      ${kpi('Entidades Fusion',entities,'Entity 360 disponibles')}${kpi('Hallazgos',findings,'Señales analíticas priorizadas')}${kpi('Sanciones',sanctions,`${fmtNum(laftSanctions)} con vínculo LA/FT directo`)}${kpi('Patrones',patterns,patterns ? 'Alertas de patrón canonizadas' : 'Capa preparada; sin carga actual')}
    </div>
    <div class="grid-2">
      <section class="panel"><div class="panel-head"><h2>Hallazgos de mayor prioridad investigativa</h2><span>Top 8</span></div><div class="panel-body"><div class="list">${renderFindingList(topFindingsRes.data || [])}</div></div></section>
      <section class="panel"><div class="panel-head"><h2>Cobertura rápida</h2><span>Corte actual</span></div><div class="panel-body">
        <div class="list"><div class="list-item"><strong>${fmtNum(uafObserved)} entidades observadas en corte público UAF</strong><div class="meta">Cobertura pública, no padrón operacional.</div></div>
        <div class="list-item"><strong>${fmtNum(laftSanctions)} eventos sancionatorios marcados LA/FT directo</strong><div class="meta">La sanción por sí sola no implica lavado de activos.</div></div>
        <div class="list-item"><strong>${fmtNum(patterns)} alertas de patrón cargadas</strong><div class="meta">Strength = fuerza comparativa de regla; no probabilidad.</div></div></div>
      </div></section>
      <section class="panel"><div class="panel-head"><h2>Sanciones recientes</h2><span>Últimos eventos</span></div><div class="panel-body"><div class="list">${renderSanctionList(recentSanctionsRes.data || [])}</div></div></section>
      <section class="panel"><div class="panel-head"><h2>Patrones</h2><span>${fmtNum(patterns)} disponibles</span></div><div class="panel-body">${patterns ? `<div class="list">${renderPatternList(patternsRes.data || [])}</div>` : empty('Sin patrones cargados aún','La tabla aml_pattern_alerts está protegida y disponible, pero el corte actual contiene 0 alertas.')}</div></section>
    </div><div class="footer-note">Los conteos se consultan en línea bajo la sesión actual y RLS; no están embebidos en el sitio público.</div>`;
  } catch (e) { showContentError(e); }
}
function kpi(label,value,sub){ return `<div class="kpi"><div class="label">${esc(label)}</div><div class="value">${fmtNum(value)}</div><div class="sub">${esc(sub)}</div></div>`; }
function renderFindingList(rows){ return rows.length ? rows.map((r)=>`<div class="list-item"><strong>${esc(r.title || r.finding_type || r.finding_key)}</strong><div class="meta"><span>${esc(r.finding_type)}</span><span>${esc(r.region || 'Sin región')}</span><span class="score ${scoreClass(r.score_investigate)}">Investigate ${fmtScore(r.score_investigate)}</span><span>${fmtNum(r.evidence_count)} evidencias</span></div></div>`).join('') : empty('Sin hallazgos','No se recibieron filas bajo la política actual.'); }
function renderSanctionList(rows){ return rows.length ? rows.map((r)=>`<div class="list-item"><strong>${esc(r.entity_name || r.subject || r.sanction_id)}</strong><div class="meta"><span>${fmtDate(r.event_date)}</span><span>${esc(r.regulator || '—')}</span>${r.laft_direct?'<span class="tag warn">LA/FT directo</span>':''}<span>${esc(r.identity_status || '')}</span></div></div>`).join('') : empty('Sin sanciones','No se recibieron eventos sancionatorios.'); }
function renderPatternList(rows){ return rows.length ? rows.map((r)=>`<div class="list-item"><strong>${esc(r.title || r.pattern_type || r.alert_id)}</strong><div class="meta"><span>${esc(r.family || '')}</span><span>${esc(r.scope_label || r.scope_id || '')}</span><span>Strength ${fmtScore(r.strength)}</span><span>${esc(r.priority || '')}</span></div></div>`).join('') : empty('Sin patrones','No hay alertas de patrón en el corte actual.'); }
function empty(title,body){ return `<div class="empty"><strong>${esc(title)}</strong>${esc(body)}</div>`; }

async function loadEntities() {
  state.view='entities'; shell('Entity 360','Búsqueda por nombre, RUT o Entity ID con cruces Fusion bajo demanda.');
  content().innerHTML = `<div class="panel"><div class="panel-head"><h2>Buscar entidad</h2><span>Máximo 50 resultados</span></div><div class="panel-body">
    <form class="toolbar" id="entity-search"><div class="search"><input id="entity-q" autocomplete="off" placeholder="Ej.: Banco Falabella, 96509660-4 o ENT-RUT-…" /><button class="secondary" type="submit">Buscar</button></div></form>
    <div id="entity-results">${empty('Inicia una búsqueda','La consulta se ejecutará en Supabase; el texto se audita sólo como SHA-256 y longitud.')}</div>
  </div></div>`;
  document.querySelector('#entity-search').addEventListener('submit', searchEntities);
}
async function searchEntities(ev) {
  ev.preventDefault(); const q = cleanSearch(document.querySelector('#entity-q').value); const box = document.querySelector('#entity-results');
  if (q.length < 2) { box.innerHTML='<div class="flash error">Ingresa al menos 2 caracteres.</div>'; return; }
  box.innerHTML='<div class="loading">Buscando en Entity 360…</div>';
  try {
    const hash = await sha256(q.toLocaleLowerCase('es-CL'));
    await audit('SEARCH', { objectType:'entity', queryHash:hash, queryLength:q.length, payload:{ mode:'entity_360' } });
    let query = sb.from('aml_entities').select('entity_id,rut,name,entity_type,region,commune,source_count,is_uaf_observed,is_sanctioned,snapshot_id,updated_at');
    if (/^ENT-/i.test(q)) query = query.eq('entity_id', q.toUpperCase());
    else if (/^[0-9kK.\-\s]+$/.test(q)) query = query.ilike('rut', `%${q.replace(/[.\s]/g,'')}%`);
    else query = query.ilike('name', `%${q}%`);
    const { data, error } = await query.order('source_count',{ascending:false}).limit(50);
    if (error) throw error;
    box.innerHTML = data?.length ? `<div class="results">${data.map(entityRow).join('')}</div>` : empty('Sin coincidencias','Prueba con una razón social más corta o con el RUT sin puntos.');
    box.querySelectorAll('[data-entity]').forEach((el)=>el.addEventListener('click',()=>openEntity(el.dataset.entity)));
  } catch (e) { box.innerHTML=`<div class="flash error">${esc(e.message)}</div>`; }
}
function entityRow(r){ return `<button class="entity-row" data-entity="${esc(r.entity_id)}"><div><div class="entity-name">${esc(r.name)}</div><div class="entity-id">${esc(r.entity_id)} · ${esc(r.rut || 'RUT no disponible')}</div></div><div class="entity-place">${esc(r.commune || '—')}<br>${esc(r.region || '—')}</div><div class="entity-flags"><span class="tag info">${fmtNum(r.source_count)} fuentes</span>${r.is_uaf_observed?'<span class="tag good">UAF observado</span>':'<span class="tag">UAF no observado</span>'}${r.is_sanctioned?'<span class="tag warn">Sanciones</span>':''}</div></button>`; }

async function openEntity(entityId) {
  state.selectedEntity=entityId; shell('Entity 360','Perfil consolidado con hallazgos, sanciones y evidencia derivada del corte Fusion.');
  try {
    const [entityRes, findingsRes, sanctionsRes, patternsRes] = await Promise.all([
      sb.from('aml_entities').select('*').eq('entity_id',entityId).maybeSingle(),
      sb.from('aml_findings').select('finding_key,finding_id,finding_type,title,region,commune,score_explore,score_supervise,score_investigate,source_count,evidence_count,snapshot_id,updated_at').eq('entity_id',entityId).order('score_investigate',{ascending:false,nullsFirst:false}).limit(100),
      sb.from('aml_sanctions').select('sanction_id,event_date,regulator,entity_name,identity_status,laft_direct,amount_uf,subject,snapshot_id,updated_at').eq('entity_id',entityId).order('event_date',{ascending:false,nullsFirst:false}).limit(100),
      sb.from('aml_pattern_alerts').select('alert_id,family,pattern_type,scope_type,scope_id,scope_label,strength,priority,title,summary,snapshot_id,updated_at').eq('scope_id',entityId).order('strength',{ascending:false,nullsFirst:false}).limit(100)
    ]);
    [entityRes,findingsRes,sanctionsRes,patternsRes].forEach((r)=>{ if(r.error) throw r.error; });
    if (!entityRes.data) throw new Error('Entidad no disponible bajo la política actual.');
    await audit('OPEN_ENTITY',{objectType:'entity',objectId:entityId,payload:{findings:findingsRes.data?.length||0,sanctions:sanctionsRes.data?.length||0}});
    renderEntityDetail(entityRes.data, findingsRes.data||[], sanctionsRes.data||[], patternsRes.data||[]);
  } catch(e){ showContentError(e); }
}
function renderEntityDetail(e, findings, sanctions, patterns){
  content().innerHTML = `<button class="ghost" id="back-entities">← Volver a búsqueda</button>
    <div class="detail-head"><div><div class="eyebrow">${esc(e.entity_type || 'Entidad')}</div><h2>${esc(e.name)}</h2><div class="muted mono small">${esc(e.entity_id)}</div></div><div class="entity-flags">${e.is_uaf_observed?'<span class="tag good">Observado en corte UAF</span>':'<span class="tag">No observado en corte UAF</span>'}${e.is_sanctioned?'<span class="tag warn">Eventos sancionatorios</span>':''}<span class="tag info">${fmtNum(e.source_count)} fuentes</span></div></div>
    <div class="detail-core">${datum('RUT',e.rut)}${datum('Región',e.region)}${datum('Comuna',e.commune)}${datum('Snapshot',e.snapshot_id)}</div>
    <div class="kpis">${kpi('Hallazgos',findings.length,'Vinculados a Entity ID')}${kpi('Sanciones',sanctions.length,'Eventos resueltos al Entity ID')}${kpi('Patrones',patterns.length,'Alertas de patrón vinculadas')}${kpi('Evidencias',findings.reduce((a,r)=>a+Number(r.evidence_count||0),0),'Suma de evidencia en hallazgos')}</div>
    <div class="grid-2"><section class="panel"><div class="panel-head"><h2>Hallazgos</h2><span>${findings.length}</span></div><div class="panel-body">${renderFindingsTable(findings)}</div></section>
    <section class="panel"><div class="panel-head"><h2>Sanciones</h2><span>${sanctions.length}</span></div><div class="panel-body">${renderSanctionsTable(sanctions)}</div></section></div>
    <section class="panel" style="margin-top:18px"><div class="panel-head"><h2>Patrones y perfil Fusion</h2><span>${patterns.length} patrones</span></div><div class="panel-body">${patterns.length?`<div class="list">${renderPatternList(patterns)}</div>`:empty('Sin patrones vinculados','El corte actual no contiene alertas de patrón para esta entidad.')}${renderProfile(e.profile)}</div></section>
    <div class="footer-note">Última actualización de la entidad: ${esc(fmtDateTime(e.updated_at))}. La ausencia de observación UAF no acredita ausencia de inscripción u obligación legal.</div>`;
  document.querySelector('#back-entities').addEventListener('click',loadEntities);
  content().querySelectorAll('[data-open-entity]').forEach((el)=>el.addEventListener('click',()=>openEntity(el.dataset.openEntity)));
}
function datum(label,value){ return `<div class="datum"><span>${esc(label)}</span><strong>${esc(value || '—')}</strong></div>`; }
function renderProfile(profile){
  if (!profile || typeof profile !== 'object') return '';
  const entries=Object.entries(profile).slice(0,20);
  if(!entries.length) return '';
  return `<details class="profile"><summary>Metadatos del perfil Fusion</summary><div class="profile-grid">${entries.map(([k,v])=>`<div class="profile-item"><span>${esc(k)}</span><code>${esc(typeof v==='object'?truncate(JSON.stringify(v),500):truncate(v,500))}</code></div>`).join('')}</div></details>`;
}

async function loadFindings(){
  state.view='findings'; shell('Hallazgos','Priorización analítica por score investigativo y evidencia disponible.');
  try{
    const {data,error}=await sb.from('aml_findings').select('finding_key,finding_id,finding_type,entity_id,title,region,commune,score_explore,score_supervise,score_investigate,source_count,evidence_count,snapshot_id,updated_at').order('score_investigate',{ascending:false,nullsFirst:false}).limit(100);
    if(error)throw error;
    content().innerHTML=`<section class="panel"><div class="panel-head"><h2>Top hallazgos</h2><span>100 por prioridad investigativa</span></div><div class="panel-body">${renderFindingsTable(data||[])}</div></section>`;
    content().querySelectorAll('[data-open-entity]').forEach((el)=>el.addEventListener('click',()=>openEntity(el.dataset.openEntity)));
  }catch(e){showContentError(e)}
}
function renderFindingsTable(rows){
  if(!rows.length)return empty('Sin hallazgos','No hay filas vinculadas en este corte.');
  return `<div class="table-wrap"><table class="table"><thead><tr><th>Hallazgo</th><th>Tipo</th><th>Territorio</th><th>Explore</th><th>Supervise</th><th>Investigate</th><th>Evidencia</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="title-cell"><strong>${esc(r.title||r.finding_id||r.finding_key)}</strong>${r.entity_id?`<br><button class="chip-btn" data-open-entity="${esc(r.entity_id)}">${esc(r.entity_id)}</button>`:''}</td><td>${esc(r.finding_type||'—')}</td><td>${esc(r.commune||r.region||'—')}</td><td class="score ${scoreClass(r.score_explore)}">${fmtScore(r.score_explore)}</td><td class="score ${scoreClass(r.score_supervise)}">${fmtScore(r.score_supervise)}</td><td class="score ${scoreClass(r.score_investigate)}">${fmtScore(r.score_investigate)}</td><td>${fmtNum(r.evidence_count)}</td></tr>`).join('')}</tbody></table></div>`;
}

async function loadSanctions(){
  state.view='sanctions'; shell('Sanciones','Eventos sancionatorios con resolución de identidad y marca LA/FT cuando existe vínculo directo.');
  try{
    const {data,error}=await sb.from('aml_sanctions').select('sanction_id,event_date,regulator,entity_name,entity_id,identity_status,laft_direct,amount_uf,subject,snapshot_id,updated_at').order('event_date',{ascending:false,nullsFirst:false}).limit(150);
    if(error)throw error;
    content().innerHTML=`<section class="panel"><div class="panel-head"><h2>Sanciones recientes</h2><span>150 eventos</span></div><div class="panel-body">${renderSanctionsTable(data||[])}</div></section>`;
    content().querySelectorAll('[data-open-entity]').forEach((el)=>el.addEventListener('click',()=>openEntity(el.dataset.openEntity)));
  }catch(e){showContentError(e)}
}
function renderSanctionsTable(rows){
  if(!rows.length)return empty('Sin sanciones','No hay eventos vinculados en este corte.');
  return `<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Regulador</th><th>Entidad</th><th>Identidad</th><th>LA/FT</th><th>Materia</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${fmtDate(r.event_date)}</td><td>${esc(r.regulator||'—')}</td><td><strong>${esc(r.entity_name||'—')}</strong>${r.entity_id?`<br><button class="chip-btn" data-open-entity="${esc(r.entity_id)}">Abrir Entity 360</button>`:''}</td><td>${esc(r.identity_status||'—')}</td><td>${r.laft_direct?'<span class="tag warn">Directo</span>':'<span class="tag">No directo</span>'}</td><td class="title-cell">${esc(truncate(r.subject,240))}</td></tr>`).join('')}</tbody></table></div>`;
}

async function loadPatterns(){
  state.view='patterns'; shell('Patrones','Alertas comparativas para detectar recurrencia, concentración o configuraciones de interés.');
  try{
    const {data,error,count}=await sb.from('aml_pattern_alerts').select('alert_id,family,pattern_type,scope_type,scope_id,scope_label,strength,priority,title,summary,snapshot_id,updated_at',{count:'exact'}).order('strength',{ascending:false,nullsFirst:false}).limit(150);
    if(error)throw error;
    content().innerHTML=`<section class="panel"><div class="panel-head"><h2>Pattern Intelligence</h2><span>${fmtNum(count||0)} alertas</span></div><div class="panel-body">${data?.length?`<div class="list">${renderPatternList(data)}</div>`:empty('Capa disponible, sin alertas cargadas','La tabla aml_pattern_alerts está operativa y protegida por RLS, pero todavía no contiene el set de Pattern Intelligence del Workbench.')}</div></section><div class="footer-note">Strength representa fuerza comparativa de una regla o patrón. No debe interpretarse como probabilidad de LA/FT.</div>`;
  }catch(e){showContentError(e)}
}

function showContentError(e){ const c=content(); if(c)c.innerHTML=`<div class="flash error">${esc(e?.message||e)}</div>`; else renderError(e?.message||String(e)); }

async function boot(){
  try{
    const {data:{session},error}=await sb.auth.getSession();
    if(error)throw error;
    if(!session)return renderLogin();
    state.user=session.user;
    const {data:access,error:accessError}=await sb.from('aml_allowed_users').select('role,enabled').eq('user_id',state.user.id).maybeSingle();
    if(accessError || !access?.enabled)return renderPending();
    state.access=access;
    await auditSession();
    await loadOverview();
  }catch(e){renderError(e?.message||String(e));}
}

sb.auth.onAuthStateChange((event,session)=>{
  if(event==='SIGNED_OUT')renderLogin();
  if(event==='SIGNED_IN' && session && !state.user) boot();
});
boot();

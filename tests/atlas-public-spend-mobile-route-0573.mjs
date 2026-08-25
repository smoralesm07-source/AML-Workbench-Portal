import fs from 'node:fs';

const route=fs.readFileSync('assets/atlas-public-spend-mobile-route-0573.js','utf8');
const authority=fs.readFileSync('assets/atlas-public-spend-route-authority-0578.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('assets/atlas-public-spend-progressive-0577.css','utf8');
const mobile=fs.readFileSync('assets/atlas-mobile-nav.js','utf8');
const build=fs.readFileSync('tools/build_atlas_site.py','utf8');

function ok(value,message){if(!value)throw new Error(message)}

ok(route.includes("const VIEW='public-spend'"),'la ruta progresiva debe limitarse a Gasto Público');
ok(route.includes("const HOST_CLASS='atlas-public-spend-fast-host'"),'debe usar un host rápido aislado');
ok(route.includes("LOCAL_URL='./data/public-spend/spend_view_v2.json'"),'debe preferir snapshot compacto same-origin');
ok(route.includes('AbortController'),'debe tener timeout/cancelación de red');
ok(route.includes('cache:cacheMode'),'debe permitir caché en la ruta rápida');
ok(route.includes('window.__AML_PUBLIC_SPEND__?.load'),'el histórico completo debe seguir disponible bajo demanda');
ok(!route.includes('class="v037-spend'),'la entrada rápida no debe crear el host legado y disparar Audit/Guided');
ok(!route.includes('<style'),'la ruta no debe inyectar estilos inline bloqueados por CSP');
ok(route.includes('event.stopImmediatePropagation()'),'debe impedir doble despacho de clic');
ok(route.includes("version:'0577.0'"),'debe publicar telemetría 0577');

ok(authority.includes("const VERSION='0579.0'"),'la autoridad endurecida debe publicar versión 0579');
ok(authority.includes("if(view===VIEW)return openFast('window.navigate')"),'public-spend debe ir siempre a la entrada rápida');
ok(authority.includes('AtlasPublicSpendRoute0573'),'la autoridad debe delegar en la ruta progresiva');
ok(authority.includes('event.stopImmediatePropagation()'),'debe impedir que listeners posteriores invoquen el histórico');
ok(authority.includes('MutationObserver'),'debe vigilar reemplazos incidentales del host SPA');
ok(authority.includes('scheduleRecovery'),'debe recuperar el host rápido si otro módulo lo elimina');
ok(authority.includes('deferred-'),'debe revalidar autoridad tras cargar scripts posteriores');
ok(authority.includes('__atlasPublicSpendAuthority0579'),'debe marcar y comprobar el wrapper vigente');
ok(!authority.includes('__AML_PUBLIC_SPEND__'),'la autoridad no debe abrir el histórico directamente');

const routePos=index.indexOf('atlas-public-spend-mobile-route-0573.js?v=0577-1');
const authorityPos=index.indexOf('atlas-public-spend-route-authority-0578.js?v=0579-1');
ok(routePos>=0,'index debe cargar la ruta progresiva 0577');
ok(authorityPos>routePos,'la autoridad 0579 debe cargar después de la ruta');
ok(index.includes('atlas-public-spend-progressive-0577.css?v=0577-1'),'index debe cargar CSS externo CSP-safe');
ok(css.includes('.atlas-public-spend-fast-host'),'el CSS debe cubrir el host rápido');
ok(index.includes('data-aml-version="0.51.1"')&&index.includes('data-aml-build="0511"'),'el fix no debe alterar el release global');
ok(mobile.includes("view:'public-spend'"),'el menú móvil debe conservar Gasto Público');
ok(build.includes('COMPILED_BUNDLES_ONLY')&&build.includes('historical source assets'),'el build debe mantener política compiled-only');

console.log('OK atlas-public-spend progressive 0577 + hardened authority 0579');

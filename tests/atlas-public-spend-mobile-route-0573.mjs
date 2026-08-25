import fs from 'node:fs';

const patch=fs.readFileSync('assets/atlas-public-spend-mobile-route-0573.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const mobile=fs.readFileSync('assets/atlas-mobile-nav.js','utf8');
const guided=fs.readFileSync('assets/atlas-public-spend-guided-0570.css','utf8');
const build=fs.readFileSync('tools/build_atlas_site.py','utf8');

function ok(value,message){if(!value)throw new Error(message)}

ok(patch.includes("const VIEW='public-spend'"),'la autoridad debe estar limitada a Gasto Público');
ok(patch.includes("[data-atlas-mobile-view=\"public-spend\"]"),'debe interceptar la entrada móvil explícita');
ok(patch.includes("[data-view=\"public-spend\"]"),'debe interceptar también la entrada desktop');
ok(patch.includes("window.__AML_PUBLIC_SPEND__?.load"),'debe reutilizar el loader compilado cuando esté disponible');
ok(!patch.includes("./v037-public-spend.js")&&!patch.includes("./v037-public-spend.css"),'producción no debe intentar cargar fragmentos fuente no publicados');
ok(patch.includes("COMPILED_BUNDLES_ONLY_NO_SOURCE_FETCH"),'debe declarar el contrato de despliegue compilado');
ok(patch.includes("createStableHost")&&patch.includes("recoverVisibleSurface"),'debe reconstruir un host visible si el loader no lo deja montado');
ok(patch.includes("data-atlas-public-spend-recovery=\"0575\""),'el host de recuperación debe ser identificable');
ok(patch.includes("record.removedNodes"),'debe preservar nodos al desmontar la vista SPA');
ok(patch.includes("savedAudit")&&patch.includes("savedGuided"),'debe conservar audit 0550 y guided 0570');
ok(patch.includes("host.classList.add('mpa-strategic-host')"),'debe restaurar el contrato visual del host');
ok(patch.includes("refreshAudit()"),'debe refrescar datos después del remount');
ok(patch.includes('MutationObserver'),'debe observar reemplazos del host SPA');
ok(patch.includes('event.stopImmediatePropagation()'),'la ruta corregida debe evitar doble despacho');
ok(!patch.includes('location.reload'),'no debe resolver el bug recargando la aplicación');
ok(!patch.includes('service_role')&&!patch.includes('SUPABASE_SERVICE_ROLE_KEY'),'no debe introducir credenciales');
ok(build.includes('COMPILED_BUNDLES_ONLY')&&build.includes('historical source assets'),'el build debe conservar la política de no publicar fragmentos fuente');

const contextPos=index.indexOf('atlas-public-spend-context-0571.js?v=0571-1');
const fixPos=index.indexOf('atlas-public-spend-mobile-route-0573.js?v=0573-1');
const mobilePos=index.indexOf('atlas-mobile-nav.js?v=0469-1');
ok(contextPos>=0&&fixPos>contextPos,'la autoridad debe cargar después del contexto 0571');
ok(mobilePos>fixPos,'debe registrar captura antes del listener móvil delegado');
ok(index.includes('data-aml-version="0.51.1"')&&index.includes('data-aml-build="0511"'),'el fix no debe alterar el release global');
ok(mobile.includes("view:'public-spend'"),'el menú móvil debe conservar Gasto público');
ok(guided.includes('@media(max-width:760px)'),'la UI guiada debe conservar reglas responsive móviles');

console.log('OK atlas-public-spend-mobile-route-0575');

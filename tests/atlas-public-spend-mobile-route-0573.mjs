import fs from 'node:fs';

const patch=fs.readFileSync('assets/atlas-public-spend-mobile-route-0573.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const mobile=fs.readFileSync('assets/atlas-mobile-nav.js','utf8');
const guided=fs.readFileSync('assets/atlas-public-spend-guided-0570.css','utf8');

function ok(value,message){if(!value)throw new Error(message)}

ok(patch.includes("const VIEW='public-spend'"),'0573 debe estar limitado a Gasto Público');
ok(patch.includes("[data-atlas-mobile-view=\"public-spend\"]"),'0573 debe interceptar la entrada móvil explícita');
ok(patch.includes("window.__AML_PUBLIC_SPEND__?.load"),'0573 debe reutilizar el cargador oficial v037');
ok(patch.includes("record.removedNodes"),'0573 debe preservar nodos al desmontar la vista SPA');
ok(patch.includes("savedAudit")&&patch.includes("savedGuided"),'0573 debe conservar audit 0550 y guided 0570');
ok(patch.includes("host.classList.add('mpa-strategic-host')"),'0573 debe restaurar el contrato visual del host');
ok(patch.includes("diag())refreshAudit"),'0573 debe refrescar datos después del remount');
ok(patch.includes('MutationObserver'),'0573 debe observar reemplazos del host SPA');
ok(patch.includes('event.stopImmediatePropagation()'),'la ruta móvil corregida debe evitar el doble despacho del menú');
ok(!patch.includes('location.reload'),'0573 no debe resolver el bug recargando la aplicación');
ok(!patch.includes('service_role')&&!patch.includes('SUPABASE_SERVICE_ROLE_KEY'),'0573 no debe introducir credenciales');

const contextPos=index.indexOf('atlas-public-spend-context-0571.js?v=0571-1');
const fixPos=index.indexOf('atlas-public-spend-mobile-route-0573.js?v=0573-1');
const mobilePos=index.indexOf('atlas-mobile-nav.js?v=0469-1');
ok(contextPos>=0&&fixPos>contextPos,'0573 debe cargar después del contexto 0571');
ok(mobilePos>fixPos,'0573 debe registrar captura antes del listener móvil delegado');
ok(index.includes('data-aml-version="0.51.1"')&&index.includes('data-aml-build="0511"'),'el fix no debe alterar el release global');
ok(mobile.includes("view:'public-spend'"),'el menú móvil debe conservar Gasto público');
ok(guided.includes('@media(max-width:760px)'),'la UI guiada debe conservar reglas responsive móviles');

console.log('OK atlas-public-spend-mobile-route-0573');

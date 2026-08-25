import fs from 'node:fs';

const route=fs.readFileSync('assets/atlas-public-spend-v2.js','utf8');
const authority=fs.readFileSync('assets/atlas-public-spend-route-authority-0578.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('assets/atlas-public-spend-progressive-0577.css','utf8');
const mobile=fs.readFileSync('assets/atlas-mobile-nav.js','utf8');
const build=fs.readFileSync('tools/build_atlas_site.py','utf8');

function ok(value,message){if(!value)throw new Error(message)}

ok(route.includes("const VIEW='public-spend', VERSION='GP2.1'"),'v2 debe publicar la versión GP2.1');
ok(route.includes("const S={data:null,index:null,tab:'overview'"),'debe existir un único store operativo');
ok(route.includes("LOCAL_URL='./data/public-spend/spend_view_v2.json'"),'debe priorizar snapshot same-origin');
ok(route.includes('AbortController'),'debe controlar timeout/cancelación de red');
ok(route.includes('function buildIndex(D)'),'debe indexar servicios, proveedores y relaciones una sola vez');
ok(route.includes("['overview','Resumen']")&&route.includes("['services','Servicios']")&&route.includes("['providers','Proveedores']")&&route.includes("['relations','Relaciones']")&&route.includes("['method','Metodología']"),'debe exponer cinco vistas nativas');
ok(route.includes('serviceFlows')&&route.includes('providerFlows'),'debe mantener índices comprador/proveedor');
ok(route.includes('function concentration(')&&route.includes('function dependency('),'debe explicar concentración y dependencia');
ok(route.includes('data-gp2-detail'),'debe ofrecer fichas de detalle');
ok(route.includes('AtlasPublicSpendV2'),'debe publicar una API nativa única');
ok(route.includes('stopImmediatePropagation'),'debe bloquear doble navegación');
ok(!route.includes('__AML_PUBLIC_SPEND__'),'v2 no debe invocar el loader histórico');
ok(!route.includes('v037-spend'),'v2 no debe crear el host legado');
ok(!route.includes('<style'),'v2 debe respetar CSP sin estilos inline');

ok(authority.includes("const VERSION='GP2-AUTH.1'"),'la autoridad debe corresponder a GP2');
ok(authority.includes('window.AtlasPublicSpendV2'),'la autoridad debe preferir la API v2');
ok(authority.includes("if(view===VIEW)return open('window.navigate')"),'window.navigate debe resolver public-spend a v2');
ok(authority.includes('__atlasGp2Authority'),'el wrapper debe comprobar su vigencia');
ok(authority.includes('MutationObserver'),'debe recuperar la vista ante reemplazos SPA');
ok(authority.includes('atlas:public-spend-v2-ready'),'debe escuchar disponibilidad v2');
ok(!authority.includes('__AML_PUBLIC_SPEND__'),'la autoridad no debe abrir el histórico');

ok(index.includes('atlas-public-spend-mobile-route-0573.js?v=0577-1'),'la fuente histórica debe seguir trazable en index fuente');
ok(build.includes("'./assets/atlas-public-spend-v2.js?v=gp2-1'"),'el build debe sustituir 0573 por el runtime v2');
ok(build.includes("'./assets/atlas-public-spend-route-authority-0578.js?v=gp2-a1'"),'el build debe cache-bustear la autoridad');
ok(build.includes("'./assets/atlas-public-spend-progressive-0577.css?v=gp2-1'"),'el build debe cache-bustear el CSS');
ok(build.includes('legacy public-spend route remains in built index'),'el build debe impedir fuga de 0573 a producción');
ok(css.includes('.gp2-hero')&&css.includes('.gp2-kpis')&&css.includes('.gp2-drawer'),'CSS debe cubrir portada, KPIs y detalle v2');
ok(css.includes('@media(max-width:820px)'),'v2 debe ser responsive');
ok(index.includes('data-aml-version="0.51.1"')&&index.includes('data-aml-build="0511"'),'la reconstrucción no debe alterar el release global');
ok(mobile.includes("view:'public-spend'"),'el menú móvil debe conservar Gasto Público');
ok(build.includes('COMPILED_BUNDLES_ONLY'),'el build debe mantener política compiled-only');

console.log('OK ATLAS Gasto Público GP2.1 native runtime + production replacement');

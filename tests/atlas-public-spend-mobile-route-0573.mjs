import fs from 'node:fs';

const route=fs.readFileSync('assets/atlas-public-spend-mobile-route-0573.js','utf8');
const authority=fs.readFileSync('assets/atlas-public-spend-route-authority-0578.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('assets/atlas-public-spend-progressive-0577.css','utf8');
const mobile=fs.readFileSync('assets/atlas-mobile-nav.js','utf8');
const build=fs.readFileSync('tools/build_atlas_site.py','utf8');

function ok(value,message){if(!value)throw new Error(message)}

ok(route.includes("const VIEW='public-spend'"),'v2 debe limitarse a Gasto Público');
ok(route.includes("const VERSION='GP2.0'"),'debe publicar la versión nativa GP2.0');
ok(route.includes("const S={data:null,index:null,tab:'overview'"),'debe existir un único store operativo');
ok(route.includes("LOCAL_URL='./data/public-spend/spend_view_v2.json'"),'debe priorizar snapshot same-origin');
ok(route.includes('AbortController'),'debe controlar timeout/cancelación de red');
ok(route.includes('function buildIndex(D)'),'debe indexar servicios, proveedores y relaciones una sola vez');
ok(route.includes("['overview','Resumen']")&&route.includes("['services','Servicios']")&&route.includes("['providers','Proveedores']")&&route.includes("['relations','Relaciones']")&&route.includes("['method','Metodología']"),'debe exponer las cinco vistas nativas');
ok(route.includes('serviceFlows')&&route.includes('providerFlows'),'debe mantener índices comprador/proveedor');
ok(route.includes('shareSignal'),'debe explicar concentración y dependencia');
ok(route.includes('data-gp2-detail'),'debe ofrecer fichas de detalle');
ok(route.includes('AtlasPublicSpendV2'),'debe publicar una API nativa única');
ok(route.includes('event.stopImmediatePropagation()'),'debe bloquear doble navegación');
ok(!route.includes('__AML_PUBLIC_SPEND__'),'v2 no debe invocar el loader histórico');
ok(!route.includes('class="v037-spend'),'v2 no debe crear el host legado');
ok(!route.includes('<style'),'v2 debe respetar CSP sin estilos inline');

ok(authority.includes("const VERSION='GP2-AUTH.1'"),'la autoridad debe corresponder a GP2');
ok(authority.includes('window.AtlasPublicSpendV2'),'la autoridad debe preferir la API v2');
ok(authority.includes("if(view===VIEW)return open('window.navigate')"),'window.navigate debe resolver public-spend a v2');
ok(authority.includes('__atlasGp2Authority'),'el wrapper debe poder comprobar su propia vigencia');
ok(authority.includes('MutationObserver'),'debe recuperar la vista ante reemplazos SPA');
ok(authority.includes('atlas:public-spend-v2-ready'),'debe escuchar el evento de disponibilidad v2');
ok(authority.includes('event.stopImmediatePropagation()'),'la autoridad debe bloquear listeners posteriores');
ok(!authority.includes('__AML_PUBLIC_SPEND__'),'la autoridad no debe abrir el histórico');

const routePos=index.indexOf('atlas-public-spend-mobile-route-0573.js?v=0577-1');
const authorityPos=index.indexOf('atlas-public-spend-route-authority-0578.js?v=0579-1');
ok(routePos>=0,'index debe cargar el runtime de Gasto Público');
ok(authorityPos>routePos,'la autoridad debe cargar después del runtime');
ok(index.includes('atlas-public-spend-progressive-0577.css?v=0577-1'),'index debe cargar CSS externo CSP-safe');
ok(css.includes('.gp2-hero')&&css.includes('.gp2-kpis')&&css.includes('.gp2-drawer'),'CSS debe cubrir portada, KPIs y detalle v2');
ok(css.includes('@media(max-width:820px)'),'v2 debe tener comportamiento responsive');
ok(index.includes('data-aml-version="0.51.1"')&&index.includes('data-aml-build="0511"'),'la reconstrucción no debe alterar el release global');
ok(mobile.includes("view:'public-spend'"),'el menú móvil debe conservar Gasto Público');
ok(build.includes('COMPILED_BUNDLES_ONLY')&&build.includes('historical source assets'),'el build debe mantener política compiled-only');

console.log('OK ATLAS Gasto Público v2 native runtime + sole navigation authority');

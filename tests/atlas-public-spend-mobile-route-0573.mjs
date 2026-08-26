import fs from 'node:fs';

const route=fs.readFileSync('assets/atlas-public-spend-v2.js','utf8');
const authority=fs.readFileSync('assets/atlas-public-spend-route-authority-0578.js','utf8');
const css=fs.readFileSync('assets/atlas-public-spend-v2.css','utf8');
const mobile=fs.readFileSync('assets/atlas-mobile-nav.js','utf8');
const build=fs.readFileSync('tools/build_atlas_site.py','utf8');

function ok(value,message){if(!value)throw new Error(message)}

ok(route.includes("const VIEW='public-spend', VERSION='GP2.2'"),'GP2 debe publicar versión GP2.2');
ok(route.includes("HOST_CLASS='atlas-public-spend-v2-host'"),'GP2 debe usar host nativo propio');
ok(route.includes("DATA_URL='https://raw.githubusercontent.com/smoralesm07-source/Rada_Presupuesto_Abierto/main/docs/data/spend_view_v2.json'"),'GP2 debe consumir snapshot compacto gobernado');
ok(route.includes('AbortController')&&route.includes('15000'),'GP2 debe controlar timeout de red');
ok(route.includes("cache:force?'reload':'force-cache'"),'GP2 debe reutilizar caché salvo actualización explícita');
ok(route.includes("D?.schema!=='PRESUPUESTO_SPEND_VIEW_V2'"),'GP2 debe validar contrato de datos');
ok(route.includes('function buildIndex(D)'),'GP2 debe construir índices una vez');
ok(route.includes('flowsByS')&&route.includes('flowsByP'),'GP2 debe indexar relaciones comprador/proveedor');
ok(route.includes("['overview','Resumen']")&&route.includes("['services','Servicios']")&&route.includes("['providers','Proveedores']")&&route.includes("['relations','Relaciones']")&&route.includes("['method','Metodología']"),'GP2 debe exponer cinco vistas');
ok(route.includes('function context()')&&route.includes('function trend(ctx)'),'filtros y serie deben compartir contexto');
ok(route.includes('function concentration(')&&route.includes('function dependency('),'debe explicar concentración y dependencia');
ok(route.includes('HHI')&&route.includes('Top 10 proveedores'),'debe cubrir concentración agregada');
ok(route.includes('data-gp2-detail')&&route.includes('gp2-drawer'),'debe ofrecer fichas de detalle');
ok(route.includes('data-gp2-region')&&route.includes('data-gp2-service')&&route.includes('data-gp2-provider'),'gráficos deben ser navegables');
ok(route.includes('Metodología')&&route.includes('Concentración alta')&&route.includes('Dependencia alta'),'debe conservar metodología y ayuda explicativa de señales AML');
ok(route.includes('window.__ATLAS_PUBLIC_SPEND_PERF__'),'debe exponer telemetría de carga');
ok(route.includes('AtlasPublicSpendV2'),'debe publicar API nativa');
ok(route.includes('stopImmediatePropagation'),'debe bloquear doble navegación');
ok(!route.includes('__AML_PUBLIC_SPEND__'),'GP2 no debe invocar loader v037');
ok(!route.includes('v037-spend'),'GP2 no debe crear host legado');
ok(!route.includes('<style'),'GP2 debe respetar CSP sin estilos inline');

ok(authority.includes("VERSION='GP-AUTH.0720'"),'autoridad debe corresponder a la autoridad vigente 0720');
ok(authority.includes('AtlasPublicSpendIntelligence0720')&&authority.includes('AtlasPublicSpendV2'),'autoridad debe preferir Intelligence 0720 con fallback GP2');
ok(authority.includes("if(view===VIEW)return open('window.navigate')"),'window.navigate debe resolver public-spend a la autoridad vigente');
ok(authority.includes('__atlasGpAuthority0720'),'wrapper debe marcar la autoridad 0720');
ok(authority.includes("freezeGuard:'NO_GLOBAL_DOM_OBSERVER'"),'autoridad debe declarar guardarraíl sin observador global');
ok(!authority.includes('MutationObserver'),'autoridad vigente no debe reinstalar un observador DOM global');
ok(authority.includes('atlas:public-spend-v2-ready'),'debe escuchar disponibilidad GP2');
ok(!authority.includes('__AML_PUBLIC_SPEND__')&&!authority.includes('AtlasPublicSpendMobile0573'),'autoridad no debe volver a runtimes históricos');

ok(css.includes('.gp2-hero')&&css.includes('.gp2-kpis')&&css.includes('.gp2-drawer'),'CSS GP2 debe cubrir portada, KPIs y detalle');
ok(css.includes('.gp2-flow')&&css.includes('.gp2-chart')&&css.includes('.gp2-method'),'CSS debe cubrir relaciones, tendencias y metodología');
ok(css.includes('@media(max-width:720px)'),'GP2 debe ser responsive');

ok(build.includes('RETIRED_PUBLIC_SPEND_FRAGMENTS'),'build debe retirar v037 del runtime compilado');
ok(build.includes('strip_legacy_public_spend_tags'),'build debe retirar standalones históricos del index productivo');
ok(build.includes('GP2_CSS = "assets/atlas-public-spend-v2.css"'),'build debe publicar CSS GP2');
ok(build.includes('GP2_JS = "assets/atlas-public-spend-v2.js"'),'build debe publicar runtime GP2');
ok(build.includes('GP2_VERSION = "gp2-2"'),'build debe cache-bustear GP2.2');
ok(build.includes('GP2_AUTH_VERSION'),'build debe cache-bustear la autoridad final');
ok(build.includes('legacy public-spend runtime remains in built index'),'build debe impedir fuga de runtime histórico');
ok(build.includes('retired public-spend fragment leaked into compiled runtime'),'build debe impedir fuga de v037 a bundles');
ok(build.includes('COMPILED_BUNDLES_ONLY'),'build debe mantener política compiled-only para el manifiesto canónico');
ok(mobile.includes("view:'public-spend'"),'menú móvil debe conservar Gasto Público');

console.log('OK ATLAS Gasto Público GP2.2 + autoridad 0720 + production contract');

import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const html=read('assets/territorio-aml-beta.html');
const territoryCss=read('assets/atlas-territory-igr-v2a-0911.css');
const responsiveCss=read('assets/atlas-territory-igr-v2a-0914.css');
const core=read('assets/atlas-territory-igr-v2a-core-0911.js');
const history=read('assets/atlas-territory-igr-v2a-history-0911.js');
const ui=read('assets/atlas-territory-igr-v2a-ui-0911.js');
const authority=read('assets/atlas-territory-threat-cead-v1.js');
const v032=read('v032-irg-territory.js');
const ve=read('assets/atlas-irg-ve-v2.module.js');
const irarAdapter=read('assets/atlas-irg-irar-adapter.module.js');
const refinement=read('assets/atlas-irg-refinement.js');
const threatAnalytics=read('assets/atlas-territory-threat-analytics-v2.js');
const copyCleanup=read('assets/atlas-territory-copy-cleanup.js');
const oldBeta=read('assets/territorio-igr-real-beta-v4.html');
const methods=read('assets/atlas-indicator-methodology-0910.js');
const doc=read('docs/atlas-indicator-architecture-v1.md');
const contract=JSON.parse(read('data/atlas_igr_v2a_contract.json'));
const registry=JSON.parse(read('data/atlas_indicator_methodology_v1.json'));
const index=read('index.html');

// Product surface.
assert.match(html,/Territorio · Índice de Riesgo Geográfico/);
assert.match(html,/IGR · v2A operativo/);
assert.match(html,/Amenazas precedentes LA/);
assert.match(html,/pipeline en construcción/);
for(const asset of ['atlas-territory-igr-v2a-0911.css','atlas-territory-igr-v2a-0914.css','atlas-territory-igr-v2a-core-0911.js','atlas-territory-igr-v2a-history-0911.js','atlas-territory-igr-v2a-ui-0911.js'])assert.ok(html.includes(asset),`missing ${asset}`);
assert.match(html,/territory-stage/);
assert.match(html,/analysis-grid/);
assert.match(html,/governance-grid/);
assert.match(html,/viewport-fit=cover/);
assert.match(html,/0914-html1/);
assert.doesNotMatch(html,/0913-atlas1/);
assert.doesNotMatch(html,/45\s*%\s*V\/E/i);
assert.doesNotMatch(html,/Densidad SO/);

// Native ATLAS visual contract: full width, ATLAS palette and balanced hierarchy.
assert.match(territoryCss,/--bg:#07111f/);
assert.match(territoryCss,/--panel:#0c1728/);
assert.match(territoryCss,/--panel2:#101d30/);
assert.match(territoryCss,/--text:#e8eef7/);
assert.match(territoryCss,/--muted:#9aa8bc/);
assert.match(territoryCss,/--accent:#f28c28/);
assert.match(territoryCss,/--cyan:var\(--accent\)/);
assert.match(territoryCss,/\.shell\{width:100%;max-width:none/);
assert.match(territoryCss,/\.territory-stage\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
assert.match(territoryCss,/#map\{height:clamp\(/);
assert.doesNotMatch(territoryCss,/max-width:1560px/);
assert.doesNotMatch(territoryCss,/--cyan:#54bfd1/i);
assert.doesNotMatch(territoryCss,/background:#071019/i);

// Standalone HTML is the mobile visual authority. No transparent iframe canvas or horizontal overflow.
assert.match(responsiveCss,/HTML responsive authority 0\.91\.4/);
assert.match(responsiveCss,/html\[data-atlas-embedded\]/);
assert.match(responsiveCss,/background:var\(--territory-page-bg\)!important/);
assert.match(responsiveCss,/@media \(max-width:700px\)/);
assert.match(responsiveCss,/grid-template-columns:minmax\(0,\.72fr\) minmax\(0,1\.28fr\)/);
assert.match(responsiveCss,/white-space:normal!important/);
assert.match(responsiveCss,/overflow-wrap:anywhere!important/);
assert.match(responsiveCss,/#map\{[\s\S]*height:min\(58vh,560px\)!important/);
assert.match(responsiveCss,/@supports \(-webkit-touch-callout:none\)/);
assert.doesNotMatch(responsiveCss,/background:transparent!important/);

// CEAD-LA methodology and real history.
assert.match(core,/layerWeights:\{predicate_direct:\.55,criminal_economy:\.35,criminogenic_context:\.10\}/);
assert.match(core,/\.40\*intensity\+\.25\*persistence\+\.20\*trend\+\.15\*anomaly/);
assert.match(core,/Tráfico de sustancias/);
assert.match(core,/Microtráfico de sustancias/);
assert.match(core,/Elaboración o producción de sustancias/);
assert.match(core,/HISTORY_YEARS=\[2020,2021,2022,2023,2024,2025\]/);
assert.match(history,/IGR anual/);
assert.match(history,/casos policiales CEAD \(denuncias \+ hechos conocidos por detención en flagrancia\)/i);
assert.match(ui,/Las capas transfronteriza y evidencia territorial LA aún no aportan puntaje/);
assert.match(ui,/85% CEAD-LA \+ 15% frontera\/logística/);
assert.match(ui,/75% CEAD-LA \+ 15% transfronteriza \+ 10% evidencia LA/);

// Atlas-wide authority.
assert.match(authority,/IGR-2A-1\.0\.0/);
assert.match(authority,/weights:\{cead_la:1\}/);
assert.match(authority,/window\.AML_IRG_TERRITORY=api/);
assert.match(authority,/window\.v019LoadTerritory=open/);
assert.match(authority,/V032_STATE\.computed=state\.computed/);
assert.match(authority,/CONFIDENCE_WEIGHTED_COMMUNE_MEAN/);
assert.match(authority,/topLevelWeight:1/);
assert.doesNotMatch(authority,/topLevelWeight:0\.15/);

// Territorio behaves as a mounted standalone HTML, not as a transparent framed mini-app.
assert.match(authority,/seamlessAtlasHost:true/);
assert.match(authority,/fullWidthAtlasLayout:true/);
assert.match(authority,/standaloneHtmlAuthority:true/);
assert.match(authority,/body>\.shell>\.header\{display:none!important\}/);
assert.match(authority,/ResizeObserver/);
assert.match(authority,/scrolling=\"no\"/);
assert.match(authority,/border:0!important/);
assert.match(authority,/max-width:none!important/);
assert.match(authority,/root\.style\.maxWidth='none'/);
assert.match(authority,/0914-html1/);
assert.match(authority,/--atlas-accent/);
assert.match(authority,/background:var\(--atlas-bg,#07111f\)!important/);
assert.match(authority,/\.v019-content\[data-atlas-territory-fullscreen="1"\]\{padding-left:0!important;padding-right:0!important\}/);
assert.doesNotMatch(authority,/background:transparent!important/);
assert.doesNotMatch(authority,/0913-atlas1/);
assert.doesNotMatch(authority,/height:calc\(100vh\s*-\s*86px\)/);
assert.doesNotMatch(authority,/#map\{min-height:620px\}/);

// Historical v032 must be a compatibility delegate, never a second calculator.
assert.match(v032,/0\.32\.0-retired/);
assert.match(v032,/retired:true/);
assert.match(v032,/contributesToIgr:false/);
assert.match(v032,/delegatesTo:'AtlasIGRV2A'/);
assert.match(v032,/weights:\{cead_la:1\}/);
assert.doesNotMatch(v032,/0\.45\s*\*/);
assert.doesNotMatch(v032,/V032_WEIGHTS/);
assert.doesNotMatch(v032,/IRG-LAFT-0\.32\.0'\s*;/);
assert.doesNotMatch(v032,/v032StrictIRG/);

// Retired paths cannot reintroduce old IGR.
assert.match(ve,/retired:true/);assert.match(ve,/contributesToIgr:false/);
assert.match(irarAdapter,/retired:true/);assert.match(irarAdapter,/contributesToIgr:false/);
assert.match(refinement,/retired:true/);
assert.match(threatAnalytics,/retired:true/);
assert.match(copyCleanup,/retired:true/);
assert.doesNotMatch(refinement,/45% V\/E/);
assert.doesNotMatch(irarAdapter,/\.45\*Number\(p\.vulnerability\)/);
assert.match(oldBeta,/territorio-aml-beta\.html\?v=0914-html1/);
assert.doesNotMatch(oldBeta,/0913-atlas1/);

// Machine contracts.
assert.equal(contract.schema,'ATLAS_IGR_V2A');
assert.equal(contract.method_version,'IGR-2A-1.0.0');
assert.deepEqual(contract.formula,{cead_la:1});
assert.deepEqual(contract.cead_la.layers,{amenazas_precedentes_la:.55,economia_criminal_facilitadores:.35,contexto_criminogeno:.10});
assert.deepEqual(contract.cead_la.features,{intensidad:.40,persistencia:.25,tendencia:.20,anomalia:.15});
for(const excluded of ['sector_vulnerability','so_density','regulatory_coverage_gap','icr','irar','ipa','ivo'])assert.ok(contract.excluded_inputs.includes(excluded),`IGR must exclude ${excluded}`);
assert.equal(contract.history.synthetic_series,false);
assert.equal(contract.regional_aggregation,'CONFIDENCE_WEIGHTED_COMMUNE_MEAN');
assert.equal(registry.indicators.IGR.method_version,'IGR-2A-1.0.0');
assert.deepEqual(registry.indicators.IGR.weights,{amenaza_territorial_cead_la:1});
assert.match(registry.indicators.IGR.methodology,/No incorpora vulnerabilidad sectorial/i);
assert.match(methods,/Territorio · IGR v2A · activo/);
assert.match(methods,/No incorpora vulnerabilidad sectorial, densidad SO, brecha, reportabilidad, IPA ni IVO/);

// Documentation and load point.
assert.match(doc,/IGR v2A = 1,00 × Amenaza territorial CEAD-LA/);
assert.match(doc,/IRAR-E = sector/);
assert.match(doc,/IGR = territorio/);
assert.match(doc,/IPA = entidad/);
assert.ok(index.includes('atlas-territory-threat-cead-v1.js'),'index must retain the synchronous IGR authority load point');

console.log('atlas-igr-v2a-0911: OK');

import fs from 'node:fs';
const js=fs.readFileSync('assets/atlas-entity-osint-auto-fallback-0532.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const checks=[
  ['auto fallback',js.includes('autoEscalate')],
  ['internal first',js.includes("from('aml_entities')")],
  ['external fallback',js.includes('__ATLAS_RUN_EXTERNAL_OSINT_0531__')],
  ['explicit search only',js.includes("#aex-run")&&js.includes("event.key!=='Enter'")],
  ['no canonical creation',js.includes('canonicalEntityCreated:false')],
  ['no score mutation',js.includes('scoreMutation:false')],
  ['runtime loaded',html.includes('atlas-entity-osint-auto-fallback-0532.js')]
];
const failed=checks.filter(([,ok])=>!ok);
if(failed.length){console.error(failed.map(([n])=>n).join('\n'));process.exit(1)}
console.log('atlas entity osint auto fallback 0532: ok');

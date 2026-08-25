import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('assets/atlas-universo-so-0630.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.match(js,/individualReportingBehavior:false/);
assert.match(js,/conducta efectiva ROS\/ROE por RUT no es observable en fuentes abiertas/);
assert.match(js,/aml_v_uaf_supervision_360_current/);
assert.match(js,/Señales supervisoras observables/);
assert.match(js,/Sanciones UAF observadas/);
assert.match(js,/Compras públicas/);
assert.match(js,/Estructura societaria/);
assert.match(js,/OSFL observado/);
assert.doesNotMatch(js,/ROS últimos 12 meses/);
assert.doesNotMatch(js,/Percentil ROS sector/);
assert.match(index,/atlas-universo-so-0630\.js\?v=0630-1/);
console.log('Universo SO 0.63 public-source supervision contract OK');

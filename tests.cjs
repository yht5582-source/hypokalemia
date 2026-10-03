// Rule tests for the decision engine embedded in index.html.
// Run: node tests.cjs
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/\/\*ENGINE-START\*\/([\s\S]*?)\/\*ENGINE-END\*\//);
if (!m) throw new Error('engine block not found');
const mod = { exports: {} };
new Function('module', m[1])(mod);
const HK = mod.exports;

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}
const ev = s => HK.evaluate(s);
const askKeys = r => r.asks.map(a => a.key);
const status = (r, id) => (r.cands.find(c => c.id === id) || {}).status;
const SAFE = { sym: 'mild', ecg: 'normal', egfr: 90, po: 'yes', mg: 2.0, riskDone: true, histDone: true };

console.log('First contact — incomplete data');
t('nothing entered → only asks for K', () => { const r = ev({}); assert.deepEqual(askKeys(r), ['k']); assert.equal(r.stage, 1); });
t('K alone → safety asks come first and are all "now"', () => {
  const r = ev({ k: 2.4 });
  const now = r.asks.filter(a => a.pri === 'now').map(a => a.key);
  assert.deepEqual(now, ['ecg', 'sym', 'mg', 'renal', 'po', 'risk', 'hist']);
  assert.equal(r.asks[0].key, 'ecg');
});
t('K 2.4 alone is already emergent (no ECG needed to escalate)', () => assert.equal(ev({ k: 2.4 }).u.lvl, 'emergent'));
t('K 3.2 without ECG/symptoms → routine but provisional', () => { const u = ev({ k: 3.2 }).u; assert.equal(u.lvl, 'routine'); assert.ok(u.provisional); });
t('first-round labs requested together with safety items', () => { const k = askKeys(ev({ k: 2.8 })); ['urineK', 'hco3', 'bp'].forEach(x => assert.ok(k.includes(x), x)); });
t('treatment plan exists from K alone (IV+PO pending confirmation)', () => { const tx = ev({ k: 2.4 }).tx; assert.ok(tx); assert.ok(tx.route.startsWith('IV')); });
t('K ≥3.5 → not hypokalemia, no asks', () => { const r = ev({ k: 3.8 }); assert.ok(r.notHypo); assert.equal(r.asks.length, 0); assert.equal(r.tx, null); });
t('provisional ddx from history before urine K (diarrhea + acidosis)', () => {
  const r = ev({ k: 2.9, h_diarrhea: true, hco3: 15 }); assert.equal(r.stageCore, false); assert.equal(status(r, 'lowerGI'), 'likely');
});

console.log('Stage progression');
t('safety complete → stage 3 (history)', () => assert.equal(ev({ k: 2.8, ...SAFE, histDone: false }).stage, 3));
t('history done, no urine → stage 4', () => assert.equal(ev({ k: 2.8, ...SAFE }).stage, 4));
t('urine done, no HCO3 → stage 5', () => assert.equal(ev({ k: 2.8, ...SAFE, ukcr: 30 }).stage, 5));
t('evidence → stage 8 final', () => assert.equal(ev({ k: 2.6, ...SAFE, ukcr: 50, hco3: 31, bp: 'high', raas: 'lh', evidence: 'pa' }).stage, 8));

console.log('Urine potassium localisation (UpToDate thresholds)');
t('UK/UCr computed from spot UK and UCr (mg/dL)', () => assert.equal(HK.derive({ uk: 20, ucr: 100 }).ukcr, 20));
t('UK/UCr 13 → extrarenal; 13.1 → renal', () => { assert.equal(HK.derive({ ukcr: 13 }).route, 'extra'); assert.equal(HK.derive({ ukcr: 13.1 }).route, 'renal'); });
t('24h UK >30 renal, <25 extrarenal, 25–30 grey', () => {
  assert.equal(HK.derive({ uk24: 31 }).route, 'renal'); assert.equal(HK.derive({ uk24: 20 }).route, 'extra'); assert.equal(HK.derive({ uk24: 28 }).route, 'grey');
});
t('grey zone asks for spot UK/UCr', () => assert.ok(askKeys(ev({ k: 2.8, ...SAFE, uk24: 28 })).includes('urineKcr')));
t('UNa <30 flags spot urine unreliability', () => assert.ok(HK.derive({ una: 20 }).spotUnreliable));

console.log('Pending (送檢待回報)');
t('pending keys are excluded from the asks UI by key but still generated', () => {
  const r = ev({ k: 2.8, ...SAFE, _pending: ['urineK'] }); assert.ok(askKeys(r).includes('urineK'));
});

console.log('Etiology branches');
t('extrarenal + acidosis → lower GI likely', () => assert.equal(status(ev({ k: 2.9, ...SAFE, ukcr: 8, hco3: 15, bp: 'low' }), 'lowerGI'), 'likely'));
t('active vomiting: renal K + alkalosis + low UCl → upperGI likely', () => {
  const r = ev({ k: 2.7, ...SAFE, h_vomit: true, ukcr: 50, hco3: 36, bp: 'low', ucl: 8 }); assert.equal(r.lead[0].id, 'upperGI');
});
t('no vomiting history but alkalosis + low UCl → hidden vomiting possible', () => assert.equal(status(ev({ k: 2.9, ...SAFE, ukcr: 30, hco3: 33, bp: 'low', ucl: 10 }), 'upperGI'), 'possible'));
t('renal + alkalosis + normal BP + UCl ≥20 → asks diuretic screen and urine Ca', () => {
  const k = askKeys(ev({ k: 2.8, ...SAFE, ukcr: 40, hco3: 31, bp: 'low', ucl: 100 })); assert.ok(k.includes('diurscreen')); assert.ok(k.includes('uca'));
});
t('Gitelman needs low UCa AND negative diuretic screen to be "likely"', () => {
  const base = { k: 2.8, ...SAFE, mg: 1.3, ukcr: 40, hco3: 31, bp: 'low', ucl: 100, uca: 'low' };
  assert.equal(status(ev(base), 'gitelman'), 'possible');
  assert.equal(status(ev({ ...base, diurscreen: 'neg' }), 'gitelman'), 'likely');
  assert.equal(status(ev({ ...base, diurscreen: 'pos' }), 'gitelman'), 'unlikely');
  assert.equal(status(ev({ ...base, diurscreen: 'pos' }), 'diuretic'), 'likely');
});
t('Bartter: normal UCa + negative screen → likely; low UCa → unlikely', () => {
  const base = { k: 2.8, ...SAFE, ukcr: 40, hco3: 31, bp: 'low', ucl: 100, diurscreen: 'neg' };
  assert.equal(status(ev({ ...base, uca: 'normal' }), 'bartter'), 'likely');
  assert.equal(status(ev({ ...base, uca: 'low' }), 'bartter'), 'unlikely');
});
t('thiazide user with Gitelman phenotype stays "possible" (mimic)', () => assert.equal(status(ev({ k: 2.8, ...SAFE, h_diuretic: true, ukcr: 40, hco3: 31, bp: 'low', ucl: 100, uca: 'low' }), 'gitelman'), 'possible'));
t('hypertension → asks renin/aldosterone; PA possible before RAAS', () => {
  const r = ev({ k: 2.6, ...SAFE, ukcr: 50, hco3: 31, bp: 'high' }); assert.ok(askKeys(r).includes('raas')); assert.equal(status(r, 'pa'), 'possible');
});
t('low renin + high aldo → PA likely (ES 2025: no mandatory confirmatory test)', () => {
  const r = ev({ k: 2.6, ...SAFE, ukcr: 50, hco3: 31, bp: 'high', raas: 'lh' }); assert.equal(r.lead[0].id, 'pa');
  assert.ok(/確認試驗不再必要/.test(r.lead[0].next));
});
t('PA "normal" screen with hypokalemia → retest after K correction', () => assert.ok(ev({ k: 2.6, ...SAFE, ukcr: 50, hco3: 31, bp: 'high', raas: 'normal' }).cands.find(c => c.id === 'pa').why.some(w => /補鉀後/.test(w))));
t('high renin + high aldo → secondary hyperaldosteronism', () => assert.equal(ev({ k: 2.6, ...SAFE, ukcr: 50, hco3: 31, bp: 'high', raas: 'hh' }).lead[0].id, 'secAldo'));
t('low/low + licorice → AME likely; + family hx without exposure → Liddle likely', () => {
  const b = { k: 2.6, ...SAFE, ukcr: 50, hco3: 31, bp: 'high', raas: 'll' };
  assert.equal(status(ev({ ...b, h_mc: true }), 'ame'), 'likely');
  assert.equal(status(ev({ ...b, h_family: true }), 'liddle'), 'likely');
  assert.equal(status(ev(b), 'cushing'), 'possible');
});
t('renal + acidosis + normal AG + urine pH 6.8 → distal RTA likely', () => {
  const r = ev({ k: 2.5, ...SAFE, uk: 30, ucr: 60, una: 50, ucl: 60, hco3: 14, na: 138, cl: 114, bp: 'low', upH: 6.8 });
  assert.equal(r.lead[0].id, 'dRTA'); assert.equal(r.d.uag, 20);
});
t('renal + acidosis + high AG → ketoacid/anion likely, dRTA unlikely', () => {
  const r = ev({ k: 2.9, ...SAFE, ukcr: 40, hco3: 12, na: 140, cl: 100, bp: 'low' });
  assert.equal(status(r, 'anion'), 'likely'); assert.equal(status(r, 'dRTA'), 'unlikely');
});
t('renal + acidosis asks AG, urine pH', () => { const k = askKeys(ev({ k: 2.9, ...SAFE, ukcr: 40, hco3: 15, bp: 'low' })); assert.ok(k.includes('ag')); assert.ok(k.includes('upH')); });
t('acetazolamide → proximal RTA likely', () => assert.equal(status(ev({ k: 3.0, ...SAFE, h_cai: true, ukcr: 30, hco3: 17, na: 140, cl: 115, bp: 'low' }), 'pRTA'), 'likely'));
t('paralysis + UK/UCr <22 + normal acid-base → TPP likely; asks TSH', () => {
  const r = ev({ k: 1.9, ...SAFE, sym: 'paralysis', h_paralysis: true, uk: 5, ucr: 70, hco3: 24, bp: 'low' });
  assert.equal(status(r, 'tpp'), 'likely'); assert.ok(askKeys(r).includes('tsh'));
});
t('paralysis with UK/UCr ≥22 → TPP unlikely', () => assert.equal(status(ev({ k: 2.0, ...SAFE, sym: 'paralysis', ukcr: 36, hco3: 14, bp: 'low' }), 'tpp'), 'unlikely'));
t('hypomagnesemia alone with renal loss → hypoMg likely; otherwise contributing', () => {
  assert.equal(status(ev({ k: 3.0, ...SAFE, mg: 1.2, ukcr: 30, hco3: 25, bp: 'low' }), 'hypoMg'), 'likely');
  assert.equal(status(ev({ k: 2.9, ...SAFE, mg: 1.2, h_diarrhea: true, ukcr: 8, hco3: 15, bp: 'low' }), 'hypoMg'), 'contrib');
});

console.log('Unique final diagnosis');
t('evidence confirms exactly one primary cause', () => {
  const r = ev({ k: 2.6, ...SAFE, ukcr: 50, hco3: 31, bp: 'high', raas: 'lh', evidence: 'pa' });
  assert.equal(r.final.id, 'pa'); assert.equal(r.cands.filter(c => c.status === 'confirmed').length, 1);
});
t('evidence contradicting the data is flagged, not finalised', () => {
  const r = ev({ k: 2.8, ...SAFE, ukcr: 40, hco3: 31, bp: 'low', ucl: 100, uca: 'normal', diurscreen: 'neg', evidence: 'gitelman' });
  assert.equal(r.final, null); assert.ok(r.conflict);
});
t('likely lead → asks for confirmation evidence', () => assert.ok(askKeys(ev({ k: 2.6, ...SAFE, ukcr: 50, hco3: 31, bp: 'high', raas: 'lh' })).includes('evidence')));

console.log('Treatment');
t('emergent: IV 10–20 mEq/h, up to 40 only life-threatening', () => {
  const tx = ev({ k: 2.2, ...SAFE }).tx; assert.ok(tx.k.some(x => /10–20 mEq\/h/.test(x))); assert.ok(tx.k.some(x => /40 mEq\/h/.test(x)));
});
t('routine oral: 20–80 mEq/day', () => assert.ok(ev({ k: 3.3, ...SAFE }).tx.k.some(x => /20–80 mEq\/day/.test(x))));
t('cannot take PO → IV route', () => assert.equal(ev({ k: 3.3, ...SAFE, po: 'no' }).tx.route, 'IV'));
t('IV plan forbids dextrose diluent and states bag limits', () => {
  const tx = ev({ k: 2.2, ...SAFE }).tx; assert.ok(tx.k.some(x => /避免含葡萄糖/.test(x))); assert.ok(tx.k.some(x => /≤60 mEq/.test(x)));
});
t('deficit estimate 200–400 mEq per 1 mEq/L (K 2.0 → 400–800)', () => assert.deepEqual(ev({ k: 2.0, ...SAFE }).tx.deficit, { lo: 400, hi: 800 }));
t('shift/TPP → low dose, rebound warning, no deficit, propranolol', () => {
  const tx = ev({ k: 1.9, ...SAFE, sym: 'paralysis', h_paralysis: true, h_thyro: true, uk: 5, ucr: 70, hco3: 24, bp: 'low', tsh: 'low' }).tx;
  assert.ok(tx.shiftDom); assert.equal(tx.deficit, null); assert.ok(tx.k.some(x => /反彈/.test(x))); assert.ok(tx.k.some(x => /propranolol/.test(x)));
});
t('DKA: start 10 mmol/h (2024 consensus), escalate to 20–30 mEq/h (UpToDate)', () => assert.ok(ev({ k: 3.1, ...SAFE, dka: true }).tx.special.some(x => /10 mmol\/h/.test(x) && /20–30 mEq\/h/.test(x))));
t('DKA with K 3.1 is at least urgent', () => assert.equal(ev({ k: 3.1, ...SAFE, dka: true }).u.lvl, 'urgent'));
t('DKA: hold insulin while K <3.5',() => assert.ok(ev({ k: 3.1, ...SAFE, dka: true }).tx.special.some(x => /暫緩胰島素/.test(x) && /3\.5/.test(x))));
t('acidosis → potassium citrate/bicarbonate; correct K before alkali', () => {
  const tx = ev({ k: 2.9, ...SAFE, ukcr: 8, hco3: 15, bp: 'low' }).tx; assert.ok(tx.prep.some(x => /citrate/.test(x))); assert.ok(tx.special.some(x => /先補鉀/.test(x)));
});
t('alkalosis → KCl', () => assert.ok(ev({ k: 2.9, ...SAFE, ukcr: 40, hco3: 33, bp: 'low' }).tx.prep[0].includes('KCl')));
t('low Mg → magnesium replacement + order', () => { const tx = ev({ k: 2.9, ...SAFE, mg: 1.3 }).tx; assert.ok(tx.mg[0].includes('MgSO₄')); assert.ok(tx.orders.some(o => /MgSO₄/.test(o))); });
t('Mg unknown → prompt to measure', () => assert.ok(ev({ k: 2.9 }).tx.mg[0].includes('尚未驗 Mg')));
t('eGFR <30 → reduce dose/rate, avoid K-sparing', () => assert.ok(ev({ k: 2.6, ...SAFE, egfr: 20 }).tx.k.some(x => /減半/.test(x) && /保鉀/.test(x))));
t('cardiac/digoxin → target ≥4.0', () => assert.ok(ev({ k: 3.3, ...SAFE, digoxin: true }).tx.target.startsWith('≥4.0')));
t('renal wasting (PA) → MRA / K-sparing advice', () => assert.ok(ev({ k: 2.6, ...SAFE, ukcr: 50, hco3: 31, bp: 'high', raas: 'lh', evidence: 'pa' }).tx.follow.some(x => /spironolactone/.test(x))));
t('central access order uses 20 mEq/100 mL', () => assert.ok(ev({ k: 2.2, ...SAFE, access: 'central' }).tx.orders.some(o => /20 mEq \+ 水 100 mL/.test(o))));

console.log('Summary');
t('summary includes K, path, and outstanding items', () => {
  const s = { k: 2.4, sym: 'weak' }; const txt = HK.summary(s, ev(s)); assert.ok(/K 2\.4/.test(txt)); assert.ok(/待補/.test(txt));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

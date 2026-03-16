/**
 * CHECKLIST SOLAR — Test Suite
 * 
 * Run with: node tests.js
 * 
 * Tests all business logic: distances, tolerances, defaults,
 * status calculation, admin checks, lock, field counts, etc.
 */

// ============================================================
// MOCK BROWSER GLOBALS
// ============================================================
const _storage = {};
global.localStorage = {
  getItem: (k) => _storage[k] || null,
  setItem: (k, v) => { _storage[k] = v; }
};
global.navigator = { geolocation: null, serviceWorker: null };
global.document = {
  getElementById: (id) => ({ innerHTML: '', classList: { add: () => {}, remove: () => {} }, value: '', dataset: {}, querySelectorAll: () => [] }),
  querySelectorAll: () => [],
  createElement: (tag) => ({ style: {}, appendChild: () => {}, click: () => {}, onchange: null, name: '', value: '', method: '', action: '', target: '' }),
  head: { appendChild: () => {}, removeChild: () => {} },
  body: { appendChild: () => {}, removeChild: () => {} }
};
global.window = { addEventListener: () => {}, _plT: 0 };
global.Image = function() {};
global.FileReader = function() {};
global.XLSX = {
  utils: { book_new: () => ({}), aoa_to_sheet: () => ({}), book_append_sheet: () => {}, sheet_to_json: () => [] },
  write: () => new Uint8Array(), read: () => ({ SheetNames: [], Sheets: {} })
};

// Load master data
eval(require('fs').readFileSync(__dirname + '/master.js', 'utf8').replace(/^const /,'var '));

// Load app code - convert const/let to var, stub browser functions
const _appRaw = require('fs').readFileSync(__dirname + '/index.html', 'utf8');
const _jsMatch = _appRaw.match(/<script>([\s\S]*?)<\/script>/);
let _appCode = _jsMatch[1]
  .replace(/^const /gm, 'var ')
  .replace(/^let /gm, 'var ');

// Remove browser-dependent blocks
_appCode = _appCode.replace(/function startGPS\(\)[\s\S]*?\n\}/m, 'function startGPS(){}');
_appCode = _appCode.replace(/document\.getElementById\('cam'\)\.onchange[\s\S]*?;\n\};/m, '');
_appCode = _appCode.replace(/startGPS\(\);R\(\);.*$/m, '// init skipped');
_appCode = _appCode.replace(/if\('serviceWorker'.*$/m, '');

// Stub render functions to avoid DOM errors
_appCode = _appCode.replace(/function R\(\)\{.*\}/, 'function R(){}');

eval(_appCode);

// ============================================================
// TEST FRAMEWORK
// ============================================================
let passed = 0, failed = 0, errors = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    errors.push({ name, error: e.message });
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

function eq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg || ''} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function ok(val, msg) {
  if (!val) throw new Error(msg || 'Expected truthy value');
}

// ============================================================
// TESTS
// ============================================================

console.log('\n📋 MASTER DATA');
console.log('─'.repeat(50));

test('Master data has 1756 trackers', () => {
  eq(Object.keys(MASTER_DATA).length, 1756);
});

test('TR14.122 exists and is bifila_largo', () => {
  const t = MASTER_DATA['TR14.122'];
  ok(t, 'TR14.122 not found');
  eq(t.type, 'bifila_largo');
  eq(t.n, 18);
  eq(t.pv, 14);
});

test('TR04.113 exists and is bifila_corto with subcampo', () => {
  const t = MASTER_DATA['TR04.113'];
  ok(t, 'TR04.113 not found');
  eq(t.type, 'bifila_corto');
  eq(t.n, 10);
  ok(t.sub > 0, 'Should have subcampo');
});

test('All trackers have required fields', () => {
  let missing = [];
  Object.entries(MASTER_DATA).forEach(([code, d]) => {
    if (d.pv == null) missing.push(code + ':pv');
    if (d.num == null) missing.push(code + ':num');
    if (!d.type) missing.push(code + ':type');
    if (d.n == null) missing.push(code + ':n');
  });
  eq(missing.length, 0, 'Missing fields: ' + missing.slice(0, 5).join(', '));
});

test('All tracker types are valid', () => {
  const valid = ['monofila_corto', 'monofila_largo', 'bifila_corto', 'bifila_largo'];
  Object.entries(MASTER_DATA).forEach(([code, d]) => {
    ok(valid.includes(d.type), `${code} has invalid type: ${d.type}`);
  });
});

test('Tracker support counts match type', () => {
  const expected = { monofila_corto: 5, monofila_largo: 9, bifila_corto: 10, bifila_largo: 18 };
  Object.entries(MASTER_DATA).forEach(([code, d]) => {
    eq(d.n, expected[d.type], `${code}: expected ${expected[d.type]} supports, got ${d.n}`);
  });
});

console.log('\n📐 PILLAR CONFIG');
console.log('─'.repeat(50));

test('PCFG has all 4 types', () => {
  eq(Object.keys(PCFG).length, 4);
  ok(PCFG.monofila_corto);
  ok(PCFG.monofila_largo);
  ok(PCFG.bifila_corto);
  ok(PCFG.bifila_largo);
});

test('Monofila has no conducida', () => {
  eq(PCFG.monofila_corto.conducida, null);
  eq(PCFG.monofila_largo.conducida, null);
});

test('Bifila has conducida', () => {
  ok(PCFG.bifila_corto.conducida);
  ok(PCFG.bifila_largo.conducida);
});

test('Motor pillar counts correct', () => {
  eq(PCFG.monofila_corto.motor.length, 5);
  eq(PCFG.monofila_largo.motor.length, 9);
  eq(PCFG.bifila_corto.motor.length, 5);
  eq(PCFG.bifila_largo.motor.length, 9);
});

test('Conducida pillar counts correct', () => {
  eq(PCFG.bifila_corto.conducida.length, 5);
  eq(PCFG.bifila_largo.conducida.length, 9);
});

test('MP index correct for largo', () => {
  eq(getMPi('bifila_largo'), 4);
  eq(getMPi('monofila_largo'), 4);
});

test('MP index correct for corto', () => {
  eq(getMPi('bifila_corto'), 2);
  eq(getMPi('monofila_corto'), 2);
});

console.log('\n📏 DISTANCE CONFIG & CALCULATION');
console.log('─'.repeat(50));

test('DIST_LARGO has 8 entries (all except MP)', () => {
  eq(Object.keys(DIST_LARGO).length, 8);
  ok(!DIST_LARGO[4], 'MP (index 4) should not be in DIST_LARGO');
});

test('DIST_CORTO has 4 entries (all except MP)', () => {
  eq(Object.keys(DIST_CORTO).length, 4);
  ok(!DIST_CORTO[2], 'MP (index 2) should not be in DIST_CORTO');
});

test('Largo tolerances are correct', () => {
  // 1N (idx 3): 7570-7630
  eq(DIST_LARGO[3].tol[0], 7570); eq(DIST_LARGO[3].tol[1], 7630);
  // 2N (idx 2): 14770-14830
  eq(DIST_LARGO[2].tol[0], 14770); eq(DIST_LARGO[2].tol[1], 14830);
  // 3N (idx 1): 21770-21830
  eq(DIST_LARGO[1].tol[0], 21770); eq(DIST_LARGO[1].tol[1], 21830);
  // 4N (idx 0): 28470-28530
  eq(DIST_LARGO[0].tol[0], 28470); eq(DIST_LARGO[0].tol[1], 28530);
  // South side mirrors
  eq(DIST_LARGO[5].tol[0], 7570); eq(DIST_LARGO[5].tol[1], 7630);
  eq(DIST_LARGO[6].tol[0], 14770); eq(DIST_LARGO[6].tol[1], 14830);
  eq(DIST_LARGO[7].tol[0], 21770); eq(DIST_LARGO[7].tol[1], 21830);
  eq(DIST_LARGO[8].tol[0], 28470); eq(DIST_LARGO[8].tol[1], 28530);
});

test('Corto tolerances are correct', () => {
  // 1N (idx 1): 6670-6730
  eq(DIST_CORTO[1].tol[0], 6670); eq(DIST_CORTO[1].tol[1], 6730);
  // 2N (idx 0): 13370-13430
  eq(DIST_CORTO[0].tol[0], 13370); eq(DIST_CORTO[0].tol[1], 13430);
  // 1S (idx 3): 6670-6730
  eq(DIST_CORTO[3].tol[0], 6670); eq(DIST_CORTO[3].tol[1], 6730);
  // 2S (idx 4): 13370-13430
  eq(DIST_CORTO[4].tol[0], 13370); eq(DIST_CORTO[4].tol[1], 13430);
});

test('calcDistSum returns null for MP', () => {
  const td = { cim: {} };
  eq(calcDistSum(td, 'fm', 4, 'bifila_largo'), null); // MP largo
  eq(calcDistSum(td, 'fm', 2, 'bifila_corto'), null);  // MP corto
});

test('calcDistSum returns null if tramos missing', () => {
  const td = { cim: {} };
  eq(calcDistSum(td, 'fm', 3, 'bifila_largo'), null); // 1N, no data
});

test('calcDistSum for 1N largo = direct tramo', () => {
  const td = { cim: { fm_3_dist_ns_tramo: 7600 } };
  eq(calcDistSum(td, 'fm', 3, 'bifila_largo'), 7600);
});

test('calcDistSum for 2N largo = sum of 2N+1N tramos', () => {
  const td = { cim: { fm_3_dist_ns_tramo: 7600, fm_2_dist_ns_tramo: 7200 } };
  eq(calcDistSum(td, 'fm', 2, 'bifila_largo'), 7200 + 7600);
});

test('calcDistSum for 4N largo = sum of all 4 north tramos', () => {
  const td = { cim: { fm_3_dist_ns_tramo: 7600, fm_2_dist_ns_tramo: 7200, fm_1_dist_ns_tramo: 7000, fm_0_dist_ns_tramo: 6710 } };
  eq(calcDistSum(td, 'fm', 0, 'bifila_largo'), 6710 + 7000 + 7200 + 7600);
});

test('calcDistSum for 1S largo = direct tramo', () => {
  const td = { cim: { fm_5_dist_ns_tramo: 7600 } };
  eq(calcDistSum(td, 'fm', 5, 'bifila_largo'), 7600);
});

test('calcDistSum for 2S largo = sum of 2S+1S', () => {
  const td = { cim: { fm_5_dist_ns_tramo: 7600, fm_6_dist_ns_tramo: 7200 } };
  eq(calcDistSum(td, 'fm', 6, 'bifila_largo'), 7200 + 7600);
});

test('calcDistSum for 1N corto = direct tramo', () => {
  const td = { cim: { fm_1_dist_ns_tramo: 6700 } };
  eq(calcDistSum(td, 'fm', 1, 'bifila_corto'), 6700);
});

test('calcDistSum for 2N corto = sum of 2N+1N', () => {
  const td = { cim: { fm_1_dist_ns_tramo: 6700, fm_0_dist_ns_tramo: 6715 } };
  eq(calcDistSum(td, 'fm', 0, 'bifila_corto'), 6715 + 6700);
});

console.log('\n📊 FIELD DEFINITIONS');
console.log('─'.repeat(50));

test('MED has 7 fields', () => {
  eq(MED.length, 7);
});

test('COMP has 16 fields', () => {
  eq(COMP.length, 16);
});

test('dist_ns_tramo is second field (after altura)', () => {
  eq(MED[0].id, 'altura');
  eq(MED[1].id, 'dist_ns_tramo');
  ok(MED[1].isTramo, 'dist_ns_tramo should have isTramo flag');
});

test('Verticalidad N-S tolerance is 88-92', () => {
  const f = MED.find(m => m.id === 'vert_ns');
  ok(f, 'vert_ns not found');
  eq(f.tol[0], 88);
  eq(f.tol[1], 102);
});

test('Verticalidad E-O tolerance is 88-92', () => {
  const f = MED.find(m => m.id === 'vert_eo');
  ok(f, 'vert_eo not found');
  eq(f.tol[0], 88);
  eq(f.tol[1], 92);
});

test('Default values match Excel', () => {
  const expected = {
    torsion: 'NO', desv_eo: 'NO', desv_altura: 'NO',
    galvanizado: 'SI', golpes: 'NO', entalladura: 'NO', pliegue: 'NO',
    cabezas: 'NO', corte: 'NO', mecanizados: 'NO',
    orientacion: 'SI', perfil: 'SI', relleno: 'N/A',
    oxidacion: 'NO', socavones: 'NO', cimentacion: 'SI',
    zanjas: 'NO', centrado: 'N/A', diametro: 'N/A'
  };
  [...MED, ...COMP].forEach(f => {
    if (expected[f.id] !== undefined) {
      eq(f.def, expected[f.id], `${f.id} default`);
    }
  });
});

test('All SI/NO fields have defaults', () => {
  const oknoFields = [...MED, ...COMP].filter(f => f.type === 'okno' || f.def != null);
  oknoFields.forEach(f => {
    ok(f.def != null, `${f.id} should have a default value`);
  });
});

console.log('\n👤 ADMIN CHECK');
console.log('─'.repeat(50));

test('isAdmin matches "Iñaki Moriana"', () => {
  CFG.tecnico = 'Iñaki Moriana';
  ok(isAdmin(), 'Should be admin');
});

test('isAdmin matches "imoriana"', () => {
  CFG.tecnico = 'imoriana';
  ok(isAdmin(), 'Should be admin');
});

test('isAdmin matches "OHuarte"', () => {
  CFG.tecnico = 'OHuarte';
  ok(isAdmin(), 'Should be admin');
});

test('isAdmin matches "Oscar Huarte"', () => {
  CFG.tecnico = 'Oscar Huarte';
  ok(isAdmin(), 'Should be admin');
});

test('isAdmin rejects "Juan García"', () => {
  CFG.tecnico = 'Juan García';
  ok(!isAdmin(), 'Should NOT be admin');
});

test('isAdmin rejects empty name', () => {
  CFG.tecnico = '';
  ok(!isAdmin(), 'Should NOT be admin');
});

console.log('\n🔒 LOCK SYSTEM');
console.log('─'.repeat(50));

test('New tracker is not locked', () => {
  APP.trackers = {};
  const td = getTD('TR14.001');
  eq(td.locked, false);
});

test('toggleLock locks a tracker', () => {
  APP.trackers = {};
  getTD('TR14.001');
  toggleLock('TR14.001');
  ok(APP.trackers['TR14.001'].locked, 'Should be locked');
});

test('toggleLock unlocks a locked tracker', () => {
  APP.trackers = {};
  getTD('TR14.001');
  APP.trackers['TR14.001'].locked = true;
  toggleLock('TR14.001');
  ok(!APP.trackers['TR14.001'].locked, 'Should be unlocked');
});

test('isLocked returns correct state', () => {
  APP.trackers = {};
  ok(!isLocked('TR14.001'), 'Non-existent tracker should not be locked');
  getTD('TR14.001');
  ok(!isLocked('TR14.001'), 'New tracker should not be locked');
  APP.trackers['TR14.001'].locked = true;
  ok(isLocked('TR14.001'), 'Locked tracker should return true');
});

console.log('\n📊 FIELD COUNTING');
console.log('─'.repeat(50));

test('Empty tracker has 0% completion', () => {
  APP.trackers = {};
  const c = countF('TR04.113'); // bifila_corto
  eq(c.pct, 0);
});

test('MP pilar has 22 fields (not 23)', () => {
  APP.trackers = {};
  const td = getTD('TR04.113'); // bifila_corto, MP is index 2
  // Fill all fields for MP motor
  [...MED, ...COMP].forEach(f => {
    if (!f.isTramo) { // dist_ns_tramo should be excluded for MP
      td.cim['fm_2_' + f.id] = f.def || 1234;
    }
  });
  const c = countF('TR04.113');
  // For bifila_corto: 5 motor pilars + 5 conducida pilars
  // Each pilar has 23 fields, except MP which has 22
  // Motor: 4*23 + 1*22 = 114, Conducida: 4*23 + 1*22 = 114, Total cim = 228
  // We filled 22 fields in motor MP
  eq(c.cimF, 22, 'Should have 22 filled fields');
});

test('Non-MP pilar has 23 fields', () => {
  APP.trackers = {};
  const td = getTD('TR04.113'); // bifila_corto
  // Fill all fields for pilar 0 (2N-MP) motor
  [...MED, ...COMP].forEach(f => {
    td.cim['fm_0_' + f.id] = f.def || 1234;
  });
  const c = countF('TR04.113');
  eq(c.cimF, 23, 'Non-MP pilar should have 23 fields');
});

console.log('\n📈 STATUS CALCULATION');
console.log('─'.repeat(50));

test('calcStatus returns empty for unfilled tracker', () => {
  APP.trackers = {};
  getTD('TR14.122'); // bifila_largo
  const st = calcStatus('TR14.122');
  eq(st.m_alt, '', 'Motor alt should be empty');
  eq(st.m_dist, '', 'Motor dist should be empty');
  eq(st.m_vert, '', 'Motor vert should be empty');
  eq(st.m_rest, '', 'Motor rest should be empty with no manual data');
});

test('calcStatus RESTO only shows when manual fields exist', () => {
  APP.trackers = {};
  const td = getTD('TR04.113'); // bifila_corto
  // Only set defaults (no manual numeric data)
  initDef('TR04.113');
  const st = calcStatus('TR04.113');
  eq(st.m_rest, '', 'RESTO should be empty when only defaults are set');
});

test('calcStatus RESTO shows SI when manual data exists and all defaults match', () => {
  APP.trackers = {};
  const td = getTD('TR04.113');
  initDef('TR04.113');
  // Add one manual measurement to trigger rest calculation
  td.cim['fm_0_altura'] = 1200;
  // All comprobaciones should match defaults
  const st = calcStatus('TR04.113');
  eq(st.m_rest, 'SI', 'RESTO should be SI when defaults all match');
});

test('calcStatus RESTO shows SI/MAL when a field differs from default', () => {
  APP.trackers = {};
  const td = getTD('TR04.113');
  initDef('TR04.113');
  td.cim['fm_0_altura'] = 1200; // trigger manual
  td.cim['fm_0_golpes'] = 'SI'; // default is NO → this is bad
  const st = calcStatus('TR04.113');
  eq(st.m_rest, 'SI/MAL', 'RESTO should be SI/MAL when golpes=SI (default=NO)');
});

test('calcStatus vert detects out-of-tolerance N-S', () => {
  APP.trackers = {};
  const td = getTD('TR04.113');
  const cfg = PCFG['bifila_corto'];
  // Fill all vert for all motor pilars
  cfg.motor.forEach((_, i) => {
    td.cim['fm_' + i + '_vert_ns'] = 90; // OK
    td.cim['fm_' + i + '_vert_eo'] = 90; // OK
  });
  let st = calcStatus('TR04.113');
  eq(st.m_vert, 'SI', 'All in tolerance should be SI');

  // Now set one out of tolerance
  td.cim['fm_0_vert_ns'] = 87; // below 88
  st = calcStatus('TR04.113');
  eq(st.m_vert, 'SI/MAL', 'Should be SI/MAL with vert_ns=87');
});

test('calcStatus vert detects out-of-tolerance E-O (88-92)', () => {
  APP.trackers = {};
  const td = getTD('TR04.113');
  const cfg = PCFG['bifila_corto'];
  cfg.motor.forEach((_, i) => {
    td.cim['fm_' + i + '_vert_ns'] = 90;
    td.cim['fm_' + i + '_vert_eo'] = 90;
  });
  td.cim['fm_0_vert_eo'] = 93; // above 92 for E-O
  const st = calcStatus('TR04.113');
  eq(st.m_vert, 'SI/MAL', 'Should be SI/MAL with vert_eo=93 (max 92)');
});

test('calcStatus vert_eo=92 is within tolerance', () => {
  APP.trackers = {};
  const td = getTD('TR04.113');
  const cfg = PCFG['bifila_corto'];
  cfg.motor.forEach((_, i) => {
    td.cim['fm_' + i + '_vert_ns'] = 90;
    td.cim['fm_' + i + '_vert_eo'] = 92; // exactly at limit
  });
  const st = calcStatus('TR04.113');
  eq(st.m_vert, 'SI', 'vert_eo=92 should be within tolerance');
});

console.log('\n🏗️ MONTAJE');
console.log('─'.repeat(50));

test('MONT flat list has all sections', () => {
  ok(MONT.length >= 10, 'Should have at least 10 montaje sections in flat list');
  const ids = MONT.map(s => s.id);
  ok(ids.includes('ms'), 'Missing MS section');
  ok(ids.includes('bs'), 'Missing BS section');
  ok(ids.includes('tr'), 'Missing TR section');
  ok(ids.includes('pat'), 'Missing PAT section');
});

test('MONT_GROUPS has 5 groups', () => {
  eq(MONT_GROUPS.length, 5);
  eq(MONT_GROUPS[0].title, 'Soportes y Cabezas');
  eq(MONT_GROUPS[1].title, 'Vigas');
  eq(MONT_GROUPS[2].title, 'Transmisión');
  eq(MONT_GROUPS[3].title, 'Dampers y PAT');
  eq(MONT_GROUPS[4].title, 'Visual y Tapones');
});

test('Total montaje items count', () => {
  const total = MONT.reduce((a, s) => a + s.items.length, 0);
  ok(total > 30, 'Should have >30 montaje items, got ' + total);
});

console.log('\n🔗 SUBCAMPO');
console.log('─'.repeat(50));

test('PV4 has subcampos', () => {
  const subs = [...new Set(Object.values(MASTER_DATA).filter(d => d.pv === 4 && d.sub > 0).map(d => d.sub))];
  ok(subs.length > 0, 'PV4 should have subcampos');
  eq(subs.sort((a, b) => a - b).length, 9, 'PV4 should have 9 subcampos');
});

test('PV14 has 12 subcampos', () => {
  const subs = [...new Set(Object.values(MASTER_DATA).filter(d => d.pv === 14 && d.sub > 0).map(d => d.sub))];
  eq(subs.length, 12);
});

test('PV1 has no subcampos', () => {
  const subs = [...new Set(Object.values(MASTER_DATA).filter(d => d.pv === 1 && d.sub > 0).map(d => d.sub))];
  eq(subs.length, 0, 'PV1 should have no subcampos');
});

console.log('\n🔄 SYNC PAYLOAD');
console.log('─'.repeat(50));

test('SYNC_URL is hardcoded', () => {
  ok(SYNC_URL, 'SYNC_URL should be defined');
  ok(SYNC_URL.indexOf('script.google.com') >= 0, 'Should be a Google Apps Script URL');
});

test('CFG.syncUrl is set from SYNC_URL', () => {
  eq(CFG.syncUrl, SYNC_URL);
});

console.log('\n🧮 EDGE CASES');
console.log('─'.repeat(50));

test('getTD creates new tracker with correct structure', () => {
  APP.trackers = {};
  const td = getTD('TR01.001');
  ok(td.cim, 'Should have cim');
  ok(td.mont, 'Should have mont');
  ok(td.photos, 'Should have photos');
  eq(td.obs, '', 'Should have empty obs');
  ok(td.gps_log, 'Should have gps_log');
  eq(td.locked, false, 'Should not be locked');
});

test('initDef sets defaults for all pilars', () => {
  APP.trackers = {};
  initDef('TR04.113'); // bifila_corto: 5 motor + 5 conducida
  const td = APP.trackers['TR04.113'];
  // Check motor pilar 0, galvanizado should be SI
  eq(td.cim['fm_0_galvanizado'], 'SI');
  eq(td.cim['fm_0_golpes'], 'NO');
  eq(td.cim['fm_0_relleno'], 'N/A');
  // Check conducida pilar 0
  eq(td.cim['fc_0_galvanizado'], 'SI');
  eq(td.cim['fc_0_golpes'], 'NO');
});

test('initDef does not overwrite existing values', () => {
  APP.trackers = {};
  const td = getTD('TR04.113');
  td.cim['fm_0_galvanizado'] = 'NO'; // Manually set to non-default
  initDef('TR04.113');
  eq(td.cim['fm_0_galvanizado'], 'NO', 'Should not overwrite existing value');
});

test('calcDistSum handles partial data gracefully', () => {
  const td = { cim: { fm_3_dist_ns_tramo: 7600 } };
  // 2N needs both 2N and 1N tramos
  eq(calcDistSum(td, 'fm', 2, 'bifila_largo'), null, 'Should return null with incomplete chain');
});

test('Verticalidad boundary values', () => {
  // N-S: 88-102
  const vertNS = MED.find(m => m.id === 'vert_ns');
  eq(vertNS.tol[0], 88);
  eq(vertNS.tol[1], 92);
  // 88 is OK, 87.99 is not; 102 is OK, 102.01 is not
  
  // E-O: 88-92
  const vertEO = MED.find(m => m.id === 'vert_eo');
  eq(vertEO.tol[0], 88);
  eq(vertEO.tol[1], 92);
});

// ============================================================
// RESULTS
// ============================================================
console.log('\n' + '═'.repeat(50));
console.log(`\n📊 RESULTS: ${passed} passed, ${failed} failed\n`);

if (errors.length > 0) {
  console.log('❌ FAILURES:');
  errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
}

process.exit(failed > 0 ? 1 : 0);

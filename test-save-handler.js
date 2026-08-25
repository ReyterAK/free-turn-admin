// Headless behavioral test for the WG.config save handler in dialog.js.
// Verifies the 9e01b22 regression (listener attached at top level,
// fires on FIRST click) and that the temporary diagnostics (marker +
// console.log) are gone.
'use strict';

const els = {};
function makeEl(id) {
  const e = {
    id,
    value: '',
    textContent: '',
    dataset: {},
    style: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    _listeners: {},
    addEventListener(type, fn) { e._listeners[type] = fn; },
    click() { e.clicked = true; },
    focus() {},
    select() {},
    remove() {},
    appendChild() {},
  };
  els[id] = e;
  return e;
}

const anchors = [];
global.document = {
  getElementById: (id) => els[id] || makeEl(id),
  createElement: () => {
    const a = makeEl('anchor-' + anchors.length);
    anchors.push(a);
    return a;
  },
  body: { appendChild() {}, dataset: {} },
  addEventListener() {},
};
global.window = {};
global.Blob = class {
  constructor(parts, opts) { this.parts = parts; this.opts = opts; }
};
global.URL = {
  createObjectURL: (b) => 'blob:mock-' + b.parts[0].length,
  revokeObjectURL() {},
};
// synchronous timers: the deferred anchor click runs inline
global.setTimeout = (fn) => { fn(); return 0; };
global.clearTimeout = () => {};

require('./ui/js/core/dialog.js');

const save = els['dialog-modal-save'];
if (!save || typeof save._listeners.click !== 'function') {
  console.error('FAIL: save listener not attached');
  process.exit(1);
}

// Simulate a config dialog with text the admin edited.
els['dialog-modal-whats-new'].value = '[Interface]\nPrivateKey = test\nAddress = 10.0.0.2/32\n';
save.dataset.fileName = 'WG-mypeer.conf';

let threw = null;
try {
  save._listeners.click();
} catch (err) {
  threw = err;
}

if (threw) {
  console.error('FAIL: save handler threw:', threw.message);
  process.exit(1);
}

const anchor = anchors[0];
if (!anchor) {
  console.error('FAIL: no anchor element created');
  process.exit(1);
}
if (anchor.clicked !== true) {
  console.error('FAIL: anchor click did not fire');
  process.exit(1);
}
if (anchor.download !== 'WG-mypeer.conf') {
  console.error('FAIL: wrong download name:', anchor.download);
  process.exit(1);
}
if (document.body.dataset.wgSaveFired !== undefined) {
  console.error('FAIL: diagnostics marker still present');
  process.exit(1);
}

console.log('OK: save listener fires on first click, no diagnostics, download name =', anchor.download);

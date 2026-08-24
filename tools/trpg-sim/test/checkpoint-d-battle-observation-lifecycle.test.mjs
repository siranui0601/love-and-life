import assert from 'node:assert/strict';
import test from 'node:test';

import { installBattleObservationView } from '../../../public/TRPG/battle-observation-view.js';

class FakeElement {
  constructor(tagName, root = null) {
    this.tagName = tagName;
    this.root = root ?? this;
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.attributes = new Map();
    this.className = '';
    this.textContent = '';
    this._id = '';
    this._open = false;
  }

  get id() { return this._id; }
  set id(value) { this._id = String(value); }
  get open() { return this._open; }
  set open(value) { this._open = Boolean(value); }

  createElement(tagName) {
    return new FakeElement(tagName, this.root);
  }

  setAttribute(name, value) {
    this.attributes.set(String(name), String(value));
    if (name === 'id') this.id = value;
  }

  append(...nodes) {
    for (const node of nodes) this.#attachAt(node, this.children.length);
  }

  insertBefore(node, before) {
    const index = this.children.indexOf(before);
    this.#attachAt(node, index < 0 ? this.children.length : index);
  }

  replaceChildren(...nodes) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this.append(...nodes);
  }

  remove() {
    if (!this.parentNode) return;
    const index = this.parentNode.children.indexOf(this);
    if (index >= 0) this.parentNode.children.splice(index, 1);
    this.parentNode = null;
  }

  querySelector(selector) {
    return this.root.querySelector(selector);
  }

  #attachAt(node, index) {
    node.remove?.();
    node.parentNode = this;
    this.children.splice(index, 0, node);
  }
}

class FakeDocument extends FakeElement {
  constructor() {
    super('#document');
    this.root = this;
  }

  querySelector(selector) {
    if (!selector?.startsWith?.('#')) return null;
    return findById(this, selector.slice(1));
  }
}

function findById(node, id) {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

function textOf(node) {
  if (!node) return '';
  return `${node.textContent ?? ''}${(node.children ?? []).map(textOf).join('')}`;
}

function createBattleRoot({ open = true } = {}) {
  const root = new FakeDocument();
  const dialog = root.createElement('dialog');
  dialog.id = 'battleDialog';
  dialog.open = open;
  const panel = root.createElement('div');
  panel.id = 'battleCommandPanel';
  const prompt = root.createElement('p');
  prompt.id = 'battleCommandPrompt';
  const menu = root.createElement('div');
  menu.id = 'battleCommandMenu';
  const message = root.createElement('p');
  message.id = 'battleMessage';
  panel.append(prompt, menu, message);
  dialog.append(panel);
  root.append(dialog);
  return { root, dialog, panel, prompt, menu, message };
}

function activeSave(id, description = id) {
  return {
    battle: {
      status: 'active',
      commands: [
        { actionId: `INFO:${id}`, kind: 'info', name: `観測 ${id}`, description },
        { actionId: 'ATTACK', kind: 'attack', name: 'こうげき' },
      ],
    },
  };
}

function inactiveSave() {
  return { battle: { status: 'finished', commands: [] } };
}

function response(save) {
  return { ok: true, json: async () => ({ save }) };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

async function settle() {
  await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  await Promise.resolve();
  await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
}

function observationText(root) {
  return textOf(root.querySelector('#battleObservationPanel'));
}

function withFakeMutationObserver(t) {
  const original = globalThis.MutationObserver;
  const observers = [];
  globalThis.MutationObserver = class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.targets = [];
      this.disconnected = false;
      observers.push(this);
    }

    observe(target, options = {}) {
      this.targets.push({ target, options });
    }

    disconnect() {
      this.disconnected = true;
      this.targets = [];
    }
  };
  t.after(() => { globalThis.MutationObserver = original; });
  return {
    notify(target) {
      for (const observer of observers) {
        if (observer.disconnected) continue;
        if (!observer.targets.some((entry) => entry.target === target)) continue;
        observer.callback([{ target }], observer);
      }
    },
    activeObserverCount() {
      return observers.filter((observer) => !observer.disconnected).length;
    },
  };
}

test('Checkpoint D Battle INFO clears stale panel on current request failure without breaking controls', async (t) => {
  const mutations = withFakeMutationObserver(t);
  const { root, menu } = createBattleRoot({ open: true });
  const queue = [Promise.resolve(response(activeSave('old', '古い戦況'))), Promise.reject(new Error('network down'))];
  const cleanup = installBattleObservationView({ root, fetchImpl: () => queue.shift() });
  t.after(cleanup);

  await settle();
  assert.match(observationText(root), /古い戦況/u);

  mutations.notify(menu);
  await settle();
  assert.equal(root.querySelector('#battleObservationPanel'), null, 'current generation failure removes stale facts');
  assert.ok(root.querySelector('#battleCommandPrompt'), 'battle controls stay mounted after observation failure');
});

test('Checkpoint D Battle INFO keeps newer success when an older request fails later', async (t) => {
  const mutations = withFakeMutationObserver(t);
  const { root, dialog, menu } = createBattleRoot({ open: false });
  const first = deferred();
  const second = deferred();
  const queue = [first.promise, second.promise];
  const cleanup = installBattleObservationView({ root, fetchImpl: () => queue.shift() });
  t.after(cleanup);

  dialog.open = true;
  mutations.notify(dialog);
  await settle();
  mutations.notify(menu);
  await settle();
  second.resolve(response(activeSave('newer', '新しい戦況')));
  await settle();
  assert.match(observationText(root), /新しい戦況/u);

  first.reject(new Error('older failed'));
  await settle();
  assert.match(observationText(root), /新しい戦況/u, 'older failure does not clear newer observation state');
});

test('Checkpoint D Battle INFO keeps newer state when an older request succeeds later', async (t) => {
  const mutations = withFakeMutationObserver(t);
  const { root, dialog, menu } = createBattleRoot({ open: false });
  const first = deferred();
  const second = deferred();
  const queue = [first.promise, second.promise];
  const cleanup = installBattleObservationView({ root, fetchImpl: () => queue.shift() });
  t.after(cleanup);

  dialog.open = true;
  mutations.notify(dialog);
  await settle();
  mutations.notify(menu);
  await settle();
  second.resolve(response(activeSave('newer', '新しい戦況')));
  await settle();
  first.resolve(response(activeSave('older', '古い戦況')));
  await settle();

  assert.match(observationText(root), /新しい戦況/u);
  assert.doesNotMatch(observationText(root), /古い戦況/u, 'older success cannot overwrite current generation');
});

test('Checkpoint D Battle INFO invalidates in-flight response when dialog closes', async (t) => {
  const mutations = withFakeMutationObserver(t);
  const { root, dialog, menu } = createBattleRoot({ open: true });
  const inflight = deferred();
  const cleanup = installBattleObservationView({ root, fetchImpl: () => inflight.promise });
  t.after(cleanup);

  await settle();
  dialog.open = false;
  mutations.notify(dialog);
  await settle();
  inflight.resolve(response(activeSave('late', '閉じた後の戦況')));
  mutations.notify(menu);
  await settle();

  assert.equal(root.querySelector('#battleObservationPanel'), null, 'late response after close is not re-rendered');
});

test('Checkpoint D Battle INFO clears on battle end and supports successive update', async (t) => {
  const mutations = withFakeMutationObserver(t);
  const { root, menu, message } = createBattleRoot({ open: true });
  const queue = [
    Promise.resolve(response(activeSave('one', '第一戦況'))),
    Promise.resolve(response(activeSave('two', '第二戦況'))),
    Promise.resolve(response(inactiveSave())),
  ];
  const cleanup = installBattleObservationView({ root, fetchImpl: () => queue.shift() });
  t.after(cleanup);

  await settle();
  assert.match(observationText(root), /第一戦況/u);
  mutations.notify(menu);
  await settle();
  assert.match(observationText(root), /第二戦況/u);
  mutations.notify(message);
  await settle();
  assert.equal(root.querySelector('#battleObservationPanel'), null, 'finished battle removes observation panel');
});

test('Checkpoint D Battle INFO duplicate installs do not create duplicate panels and cleanup is isolated', async (t) => {
  const mutations = withFakeMutationObserver(t);
  const { root, menu } = createBattleRoot({ open: true });
  const queue = [
    Promise.resolve(response(activeSave('one', '戦況一'))),
    Promise.resolve(response(activeSave('one', '戦況一'))),
  ];
  const fetchImpl = () => queue.shift() ?? Promise.resolve(response(activeSave('fallback', '予備')));
  const cleanupA = installBattleObservationView({ root, fetchImpl });
  const cleanupB = installBattleObservationView({ root, fetchImpl });
  t.after(cleanupA);
  t.after(cleanupB);

  await settle();
  assert.equal(root.querySelector('#battleCommandPanel').children.filter((child) => child.id === 'battleObservationPanel').length, 1);
  assert.ok(mutations.activeObserverCount() >= 4);
  cleanupA();
  mutations.notify(menu);
  await settle();
  assert.equal(root.querySelector('#battleCommandPanel').children.filter((child) => child.id === 'battleObservationPanel').length, 1,
    'remaining install can still own exactly one panel');
});

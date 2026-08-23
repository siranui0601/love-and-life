const API_BASE = '/TRPG/api/game';
const LAST_SAVE_KEY = 'trpg:last-save-id';
const OBSERVATION_LIMIT = 10;

export function battleObservationsFromSave(save) {
  if (save?.battle?.status !== 'active') return [];
  return (Array.isArray(save.battle.commands) ? save.battle.commands : [])
    .filter((command) => command?.kind === 'info')
    .slice(0, OBSERVATION_LIMIT)
    .map((command) => ({
      id: String(command.actionId ?? ''),
      name: String(command.name ?? '戦況').trim() || '戦況',
      description: String(command.description ?? '').trim(),
    }));
}

export function renderBattleObservations(save, root = document) {
  const panel = root.querySelector?.('#battleCommandPanel');
  const prompt = root.querySelector?.('#battleCommandPrompt');
  if (!panel || !prompt) return null;

  let view = root.querySelector?.('#battleObservationPanel');
  const observations = battleObservationsFromSave(save);
  if (!observations.length) {
    view?.remove();
    return null;
  }

  if (!view) {
    view = root.createElement('section');
    view.id = 'battleObservationPanel';
    view.className = 'battle-observation-panel';
    view.setAttribute('aria-label', '現在の戦況');
    panel.insertBefore(view, prompt);
  }
  view.replaceChildren();

  const heading = root.createElement('p');
  heading.className = 'battle-command-prompt';
  heading.textContent = '戦況';
  view.append(heading);

  const list = root.createElement('ul');
  list.className = 'battle-observation-list';
  for (const observation of observations) {
    const item = root.createElement('li');
    item.dataset.observationId = observation.id;
    const name = root.createElement('strong');
    name.textContent = observation.name;
    item.append(name);
    if (observation.description) {
      const detail = root.createElement('span');
      detail.textContent = observation.description;
      item.append(detail);
    }
    list.append(item);
  }
  view.append(list);
  return view;
}

async function loadCurrentBattleSave(fetchImpl = fetch) {
  const saveId = globalThis.localStorage?.getItem(LAST_SAVE_KEY);
  if (!saveId) return null;
  const response = await fetchImpl(`${API_BASE}/saves/${encodeURIComponent(saveId)}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const body = await response.json();
  return body?.save ?? null;
}

export function installBattleObservationView({ root = document, fetchImpl = fetch } = {}) {
  const dialog = root.querySelector?.('#battleDialog');
  const commandMenu = root.querySelector?.('#battleCommandMenu');
  const message = root.querySelector?.('#battleMessage');
  if (!dialog || !commandMenu || !message || typeof MutationObserver === 'undefined') return () => {};

  let scheduled = 0;
  let generation = 0;
  const clear = () => root.querySelector?.('#battleObservationPanel')?.remove();
  const refresh = async () => {
    scheduled = 0;
    if (!dialog.open) {
      clear();
      return;
    }
    const current = ++generation;
    try {
      const save = await loadCurrentBattleSave(fetchImpl);
      if (current !== generation) return;
      renderBattleObservations(save, root);
    } catch {
      // Observation UI is supplemental. A read failure must never block battle controls.
    }
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = globalThis.setTimeout(refresh, 0);
  };

  const dialogObserver = new MutationObserver(schedule);
  dialogObserver.observe(dialog, { attributes: true, attributeFilter: ['open', 'data-mode'] });
  const battleObserver = new MutationObserver(schedule);
  battleObserver.observe(commandMenu, { childList: true, subtree: true });
  battleObserver.observe(message, { childList: true, characterData: true, subtree: true });
  schedule();

  return () => {
    if (scheduled) globalThis.clearTimeout(scheduled);
    generation += 1;
    dialogObserver.disconnect();
    battleObserver.disconnect();
    clear();
  };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  installBattleObservationView();
}

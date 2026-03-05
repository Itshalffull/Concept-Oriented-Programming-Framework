import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type GuardStatusPanelState = 'idle' | 'guardSelected';
export type GuardStatusPanelEvent =
  | { type: 'SELECT_GUARD' }
  | { type: 'GUARD_TRIP' }
  | { type: 'DESELECT' };

export function guardStatusPanelReducer(state: GuardStatusPanelState, event: GuardStatusPanelEvent): GuardStatusPanelState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT_GUARD') return 'guardSelected';
      if (event.type === 'GUARD_TRIP') return 'idle';
      return state;
    case 'guardSelected':
      if (event.type === 'DESELECT') return 'idle';
      return state;
    default:
      return state;
  }
}

type GuardStatus = 'passing' | 'failing' | 'pending' | 'bypassed';

interface Guard {
  id?: string;
  name: string;
  description: string;
  status: GuardStatus;
  lastChecked?: string;
}

const STATUS_ICONS: Record<GuardStatus, string> = {
  passing: '\u2713',
  failing: '\u2717',
  pending: '\u23F3',
  bypassed: '\u2298',
};

const STATUS_LABELS: Record<GuardStatus, string> = {
  passing: 'Passing',
  failing: 'Failing',
  pending: 'Pending',
  bypassed: 'Bypassed',
};

function deriveOverallStatus(guards: Guard[]): string {
  if (guards.length === 0) return 'all-passing';
  if (guards.some((g) => g.status === 'failing')) return 'has-failing';
  if (guards.some((g) => g.status === 'pending')) return 'has-pending';
  return 'all-passing';
}

function formatLastChecked(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.floor(Math.abs(diffMs) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

export interface GuardStatusPanelProps { [key: string]: unknown; class?: string; }
export interface GuardStatusPanelResult { element: HTMLElement; dispose: () => void; }

export function GuardStatusPanel(props: GuardStatusPanelProps): GuardStatusPanelResult {
  const sig = surfaceCreateSignal<GuardStatusPanelState>('idle');
  const send = (type: string) => sig.set(guardStatusPanelReducer(sig.get(), { type } as any));

  const guards = (props.guards ?? []) as Guard[];
  const executionStatus = String(props.executionStatus ?? '');
  const showConditions = props.showConditions !== false;
  const onGuardSelect = props.onGuardSelect as ((guard: Guard) => void) | undefined;

  const overallStatus = deriveOverallStatus(guards);
  const passingCount = guards.filter((g) => g.status === 'passing').length;
  const hasBlockingGuards = guards.some((g) => g.status === 'failing');

  let selectedGuardId: string | null = null;
  let focusIndex = 0;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'guard-status-panel');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Pre-execution guards');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('data-overall-status', overallStatus);
  root.setAttribute('data-execution-status', executionStatus);
  root.setAttribute('tabindex', '-1');
  if (props.class) root.className = props.class as string;

  /* Header */
  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  headerEl.setAttribute('data-state', sig.get());
  headerEl.setAttribute('data-overall-status', overallStatus);
  const heading = document.createElement('h3');
  heading.setAttribute('data-part', 'heading');
  heading.textContent = 'Pre-execution Guards';
  headerEl.appendChild(heading);
  const summaryEl = document.createElement('span');
  summaryEl.setAttribute('data-part', 'summary');
  summaryEl.setAttribute('aria-live', 'polite');
  summaryEl.textContent = `${passingCount} of ${guards.length} guards passing`;
  headerEl.appendChild(summaryEl);
  root.appendChild(headerEl);

  /* Blocking banner */
  if (hasBlockingGuards) {
    const bannerEl = document.createElement('div');
    bannerEl.setAttribute('data-part', 'blocking-banner');
    bannerEl.setAttribute('data-visible', 'true');
    bannerEl.setAttribute('role', 'alert');
    bannerEl.textContent = 'Execution is blocked by failing guards';
    root.appendChild(bannerEl);
  }

  /* Guard list */
  const guardListEl = document.createElement('div');
  guardListEl.setAttribute('data-part', 'guard-list');
  guardListEl.setAttribute('role', 'list');
  root.appendChild(guardListEl);

  const guardEls: HTMLDivElement[] = [];
  for (let i = 0; i < guards.length; i++) {
    const guard = guards[i];
    const guardId = guard.id ?? guard.name;
    const itemEl = document.createElement('div');
    itemEl.setAttribute('data-part', 'guard-item');
    itemEl.setAttribute('data-status', guard.status);
    itemEl.setAttribute('data-selected', 'false');
    itemEl.setAttribute('role', 'listitem');
    itemEl.setAttribute('aria-label', `${guard.name} \u2014 ${STATUS_LABELS[guard.status]}`);
    itemEl.setAttribute('aria-expanded', 'false');
    itemEl.setAttribute('tabindex', i === 0 ? '0' : '-1');

    const idx = i;
    itemEl.addEventListener('click', () => toggleGuard(guard, idx));
    itemEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        toggleGuard(guard, idx);
      }
    });

    const iconSpan = document.createElement('span');
    iconSpan.setAttribute('data-part', 'guard-icon');
    iconSpan.setAttribute('data-status', guard.status);
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.textContent = STATUS_ICONS[guard.status];
    itemEl.appendChild(iconSpan);

    const nameSpan = document.createElement('span');
    nameSpan.setAttribute('data-part', 'guard-name');
    nameSpan.textContent = guard.name;
    itemEl.appendChild(nameSpan);

    if (showConditions) {
      const condSpan = document.createElement('span');
      condSpan.setAttribute('data-part', 'guard-condition');
      condSpan.setAttribute('data-visible', 'true');
      condSpan.textContent = guard.description;
      itemEl.appendChild(condSpan);
    }

    const statusSpan = document.createElement('span');
    statusSpan.setAttribute('data-part', 'guard-status');
    statusSpan.setAttribute('data-status', guard.status);
    statusSpan.textContent = STATUS_LABELS[guard.status];
    itemEl.appendChild(statusSpan);

    guardListEl.appendChild(itemEl);
    guardEls.push(itemEl);
  }

  function toggleGuard(guard: Guard, index: number): void {
    const guardId = guard.id ?? guard.name;
    if (sig.get() === 'guardSelected' && selectedGuardId === guardId) {
      selectedGuardId = null;
      send('DESELECT');
    } else {
      selectedGuardId = guardId;
      focusIndex = index;
      send('SELECT_GUARD');
      onGuardSelect?.(guard);
    }
    updateGuardUI();
  }

  function updateGuardUI(): void {
    for (let i = 0; i < guards.length; i++) {
      const guardId = guards[i].id ?? guards[i].name;
      const isSelected = sig.get() === 'guardSelected' && selectedGuardId === guardId;
      guardEls[i].setAttribute('data-selected', isSelected ? 'true' : 'false');
      guardEls[i].setAttribute('aria-expanded', String(isSelected));
      guardEls[i].setAttribute('tabindex', focusIndex === i ? '0' : '-1');

      // Remove existing detail panels
      const existing = guardEls[i].querySelector('[data-part="guard-detail"]');
      if (existing) existing.remove();

      if (isSelected) {
        const detailEl = document.createElement('div');
        detailEl.setAttribute('data-part', 'guard-detail');
        detailEl.setAttribute('data-status', guards[i].status);
        const descP = document.createElement('p');
        descP.setAttribute('data-part', 'guard-detail-description');
        descP.textContent = guards[i].description;
        detailEl.appendChild(descP);
        if (guards[i].lastChecked) {
          const lcSpan = document.createElement('span');
          lcSpan.setAttribute('data-part', 'guard-last-checked');
          lcSpan.textContent = `Last checked: ${formatLastChecked(guards[i].lastChecked!)}`;
          detailEl.appendChild(lcSpan);
        }
        guardEls[i].appendChild(detailEl);
      }
    }
  }

  root.addEventListener('keydown', (e) => {
    if (guards.length === 0) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusIndex = Math.min(focusIndex + 1, guards.length - 1);
        guardEls.forEach((el, i) => el.setAttribute('tabindex', i === focusIndex ? '0' : '-1'));
        guardEls[focusIndex]?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusIndex = Math.max(focusIndex - 1, 0);
        guardEls.forEach((el, i) => el.setAttribute('tabindex', i === focusIndex ? '0' : '-1'));
        guardEls[focusIndex]?.focus();
        break;
      case 'Enter':
        e.preventDefault();
        if (guards[focusIndex]) toggleGuard(guards[focusIndex], focusIndex);
        break;
      case 'Escape':
        e.preventDefault();
        if (sig.get() === 'guardSelected') {
          selectedGuardId = null;
          send('DESELECT');
          updateGuardUI();
        }
        break;
    }
  });

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    headerEl.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default GuardStatusPanel;

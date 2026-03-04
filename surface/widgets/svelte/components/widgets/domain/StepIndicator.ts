import { uid } from '../shared/uid.js';

export interface StepDef {
  key: string;
  label: string;
  description?: string;
  status?: 'pending' | 'active' | 'completed' | 'error';
}

export interface StepIndicatorProps {
  steps: StepDef[];
  currentStep?: number;
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onStepClick?: (index: number) => void;
  children?: string | HTMLElement;
}

export interface StepIndicatorInstance {
  element: HTMLElement;
  update(props: Partial<StepIndicatorProps>): void;
  destroy(): void;
}

export function createStepIndicator(options: {
  target: HTMLElement;
  props: StepIndicatorProps;
}): StepIndicatorInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'step-indicator');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'navigation');
  root.setAttribute('aria-label', 'Progress steps');
  root.id = id;

  const listEl = document.createElement('ol');
  listEl.setAttribute('data-part', 'step-list');
  listEl.setAttribute('role', 'list');
  root.appendChild(listEl);

  function renderSteps() {
    listEl.innerHTML = '';
    const current = currentProps.currentStep ?? 0;
    currentProps.steps.forEach((step, i) => {
      if (i > 0) {
        const connector = document.createElement('div');
        connector.setAttribute('data-part', 'connector');
        connector.setAttribute('aria-hidden', 'true');
        connector.setAttribute('data-completed', i <= current ? 'true' : 'false');
        listEl.appendChild(connector);
      }
      const li = document.createElement('li');
      li.setAttribute('data-part', 'step');
      li.setAttribute('role', 'listitem');
      li.setAttribute('tabindex', '0');
      const status = step.status ?? (i < current ? 'completed' : i === current ? 'active' : 'pending');
      li.setAttribute('data-status', status);
      li.setAttribute('aria-current', status === 'active' ? 'step' : 'false');

      const indicator = document.createElement('span');
      indicator.setAttribute('data-part', 'step-indicator');
      indicator.textContent = status === 'completed' ? '\u2713' : String(i + 1);
      li.appendChild(indicator);

      const label = document.createElement('span');
      label.setAttribute('data-part', 'step-label');
      label.textContent = step.label;
      li.appendChild(label);

      if (step.description) {
        const desc = document.createElement('span');
        desc.setAttribute('data-part', 'step-description');
        desc.textContent = step.description;
        li.appendChild(desc);
      }

      li.addEventListener('click', () => { if (!currentProps.disabled) currentProps.onStepClick?.(i); });
      li.addEventListener('keydown', ((e: KeyboardEvent) => { if (e.key === 'Enter' && !currentProps.disabled) currentProps.onStepClick?.(i); }) as EventListener);
      listEl.appendChild(li);
    });
  }

  function sync() {
    root.setAttribute('data-state', 'idle');
    root.setAttribute('data-orientation', currentProps.orientation ?? 'horizontal');
    root.setAttribute('data-size', currentProps.size ?? 'md');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    renderSteps();
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createStepIndicator;

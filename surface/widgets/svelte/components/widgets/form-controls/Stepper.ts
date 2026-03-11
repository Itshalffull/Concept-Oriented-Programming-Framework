import { uid } from '../shared/uid.js';

export interface StepperProps {
  steps?: Array<{ label: string; description?: string }>;
  activeStep?: number;
  orientation?: 'horizontal' | 'vertical';
  variant?: 'default' | 'compact';
  className?: string;
}

export interface StepperInstance {
  element: HTMLElement;
  update(props: Partial<StepperProps>): void;
  destroy(): void;
}

export function createStepper(options: {
  target: HTMLElement;
  props: StepperProps;
}): StepperInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'stepper');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'list');
  root.setAttribute('aria-label', 'Progress');

  function sync() {
    const steps = currentProps.steps ?? [];
    const active = currentProps.activeStep ?? 0;
    root.setAttribute('data-orientation', currentProps.orientation ?? 'horizontal');
    root.setAttribute('data-variant', currentProps.variant ?? 'default');

    root.innerHTML = '';
    steps.forEach((step, i) => {
      const stepEl = document.createElement('div');
      stepEl.setAttribute('data-part', 'step');
      stepEl.setAttribute('role', 'listitem');
      stepEl.setAttribute('data-status', i < active ? 'complete' : i === active ? 'active' : 'upcoming');
      stepEl.setAttribute('aria-current', i === active ? 'step' : 'false');

      const indicator = document.createElement('span');
      indicator.setAttribute('data-part', 'step-indicator');
      indicator.textContent = i < active ? '\u2713' : String(i + 1);
      stepEl.appendChild(indicator);

      const content = document.createElement('div');
      content.setAttribute('data-part', 'step-content');
      const title = document.createElement('span');
      title.setAttribute('data-part', 'step-title');
      title.textContent = step.label;
      content.appendChild(title);
      if (step.description) {
        const desc = document.createElement('span');
        desc.setAttribute('data-part', 'step-description');
        desc.textContent = step.description;
        content.appendChild(desc);
      }
      stepEl.appendChild(content);

      if (i < steps.length - 1) {
        const sep = document.createElement('div');
        sep.setAttribute('data-part', 'step-separator');
        sep.setAttribute('data-complete', i < active ? 'true' : 'false');
        stepEl.appendChild(sep);
      }

      root.appendChild(stepEl);
    });

    if (currentProps.className) root.className = currentProps.className;
    else root.className = '';
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createStepper;

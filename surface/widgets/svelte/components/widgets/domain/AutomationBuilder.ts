import { uid } from '../shared/uid.js';

export interface AutomationStep {
  type: string;
  config?: Record<string, unknown>;
  testResult?: { status: string; [k: string]: unknown };
}

export interface AutomationBuilderProps {
  steps: AutomationStep[];
  ariaLabel?: string;
  readOnly?: boolean;
  selectedStepIndex?: number;
  testingActive?: boolean;
  branchingEnabled?: boolean;
  maxSteps?: number;
  automationName?: string;
  onStepsChange?: (steps: AutomationStep[]) => void;
  onStepSelect?: (index: number) => void;
  onAddStep?: (afterIndex: number) => void;
  onTestAll?: () => void;
  stepConfigForm?: string | HTMLElement;
  stepTypePicker?: string | HTMLElement;
  children?: string | HTMLElement;
}

export interface AutomationBuilderInstance {
  element: HTMLElement;
  update(props: Partial<AutomationBuilderProps>): void;
  destroy(): void;
}

export function createAutomationBuilder(options: {
  target: HTMLElement;
  props: AutomationBuilderProps;
}): AutomationBuilderInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'automation-builder');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-roledescription', 'automation builder');
  root.id = id;

  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  root.appendChild(headerEl);

  const nameEl = document.createElement('span');
  nameEl.setAttribute('data-part', 'automation-name');
  headerEl.appendChild(nameEl);

  const testAllBtn = document.createElement('button');
  testAllBtn.setAttribute('data-part', 'test-all-button');
  testAllBtn.setAttribute('type', 'button');
  testAllBtn.setAttribute('aria-label', 'Test all steps');
  testAllBtn.textContent = 'Test All';
  headerEl.appendChild(testAllBtn);

  const stepListEl = document.createElement('div');
  stepListEl.setAttribute('data-part', 'step-list');
  stepListEl.setAttribute('role', 'list');
  stepListEl.setAttribute('aria-label', 'Automation steps');
  root.appendChild(stepListEl);

  const testPanelEl = document.createElement('div');
  testPanelEl.setAttribute('data-part', 'test-panel');
  testPanelEl.setAttribute('role', 'region');
  testPanelEl.setAttribute('aria-live', 'polite');
  root.appendChild(testPanelEl);

  testAllBtn.addEventListener('click', () => currentProps.onTestAll?.());
  cleanups.push(() => {});

  function renderSteps() {
    stepListEl.innerHTML = '';
    currentProps.steps.forEach((step, i) => {
      if (i > 0) {
        const connector = document.createElement('div');
        connector.setAttribute('data-part', 'connector');
        connector.setAttribute('aria-hidden', 'true');
        stepListEl.appendChild(connector);
      }
      const stepEl = document.createElement('div');
      stepEl.setAttribute('data-part', 'step');
      stepEl.setAttribute('role', 'listitem');
      stepEl.setAttribute('tabindex', '0');
      stepEl.setAttribute('aria-selected', i === currentProps.selectedStepIndex ? 'true' : 'false');
      if (step.testResult) stepEl.setAttribute('data-test-status', step.testResult.status);

      const icon = document.createElement('span');
      icon.setAttribute('data-part', 'step-icon');
      icon.setAttribute('aria-hidden', 'true');
      stepEl.appendChild(icon);

      const typeSpan = document.createElement('span');
      typeSpan.setAttribute('data-part', 'step-type');
      typeSpan.textContent = step.type;
      stepEl.appendChild(typeSpan);

      stepEl.addEventListener('click', () => currentProps.onStepSelect?.(i));
      stepEl.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') currentProps.onStepSelect?.(i); });
      stepListEl.appendChild(stepEl);

      if (!currentProps.readOnly) {
        const addBtn = document.createElement('button');
        addBtn.setAttribute('data-part', 'add-step');
        addBtn.setAttribute('type', 'button');
        addBtn.setAttribute('aria-label', 'Add step after step ' + (i + 1));
        addBtn.textContent = '+';
        addBtn.addEventListener('click', () => currentProps.onAddStep?.(i));
        stepListEl.appendChild(addBtn);
      }
    });
  }

  function sync() {
    root.setAttribute('data-state', currentProps.testingActive ? 'testing' : 'idle');
    root.setAttribute('data-readonly', currentProps.readOnly ? 'true' : 'false');
    if (currentProps.ariaLabel) root.setAttribute('aria-label', currentProps.ariaLabel);
    nameEl.textContent = currentProps.automationName ?? 'Automation';
    testAllBtn.disabled = currentProps.readOnly ?? false;
    testPanelEl.style.display = currentProps.testingActive ? '' : 'none';
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

export default createAutomationBuilder;

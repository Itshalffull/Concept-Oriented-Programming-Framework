import { uid } from '../shared/uid.js';

export interface PolicyRule {
  id: string;
  subject: string;
  action: string;
  resource: string;
  effect: 'allow' | 'deny';
  conditions?: Record<string, unknown>;
}

export interface PolicyEditorProps {
  rules: PolicyRule[];
  subjects?: string[];
  actions?: string[];
  resources?: string[];
  disabled?: boolean;
  readOnly?: boolean;
  onChange?: (rules: PolicyRule[]) => void;
  children?: string | HTMLElement;
}

export interface PolicyEditorInstance {
  element: HTMLElement;
  update(props: Partial<PolicyEditorProps>): void;
  destroy(): void;
}

export function createPolicyEditor(options: {
  target: HTMLElement;
  props: PolicyEditorProps;
}): PolicyEditorInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'policy-editor');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Policy editor');
  root.id = id;

  const rulesEl = document.createElement('div');
  rulesEl.setAttribute('data-part', 'rules');
  rulesEl.setAttribute('role', 'list');
  root.appendChild(rulesEl);

  const addBtn = document.createElement('button');
  addBtn.setAttribute('data-part', 'add-rule');
  addBtn.setAttribute('type', 'button');
  addBtn.textContent = '+ Add rule';
  root.appendChild(addBtn);

  addBtn.addEventListener('click', () => {
    const rules = [...currentProps.rules];
    rules.push({ id: uid(), subject: '', action: '', resource: '', effect: 'allow' });
    currentProps.onChange?.(rules);
  });
  cleanups.push(() => {});

  function renderRules() {
    rulesEl.innerHTML = '';
    currentProps.rules.forEach((rule, i) => {
      const row = document.createElement('div');
      row.setAttribute('data-part', 'rule-row');
      row.setAttribute('role', 'listitem');

      const effectBtn = document.createElement('button');
      effectBtn.setAttribute('type', 'button');
      effectBtn.setAttribute('data-part', 'effect-toggle');
      effectBtn.textContent = rule.effect.toUpperCase();
      effectBtn.setAttribute('data-effect', rule.effect);
      effectBtn.addEventListener('click', () => {
        const rules = [...currentProps.rules];
        rules[i] = { ...rules[i], effect: rules[i].effect === 'allow' ? 'deny' : 'allow' };
        currentProps.onChange?.(rules);
      });
      row.appendChild(effectBtn);

      const subjectInput = document.createElement('input');
      subjectInput.setAttribute('aria-label', 'Subject');
      subjectInput.value = rule.subject;
      subjectInput.addEventListener('input', () => { const rules = [...currentProps.rules]; rules[i] = { ...rules[i], subject: subjectInput.value }; currentProps.onChange?.(rules); });
      row.appendChild(subjectInput);

      const actionInput = document.createElement('input');
      actionInput.setAttribute('aria-label', 'Action');
      actionInput.value = rule.action;
      actionInput.addEventListener('input', () => { const rules = [...currentProps.rules]; rules[i] = { ...rules[i], action: actionInput.value }; currentProps.onChange?.(rules); });
      row.appendChild(actionInput);

      const resourceInput = document.createElement('input');
      resourceInput.setAttribute('aria-label', 'Resource');
      resourceInput.value = rule.resource;
      resourceInput.addEventListener('input', () => { const rules = [...currentProps.rules]; rules[i] = { ...rules[i], resource: resourceInput.value }; currentProps.onChange?.(rules); });
      row.appendChild(resourceInput);

      const removeBtn = document.createElement('button');
      removeBtn.setAttribute('type', 'button');
      removeBtn.setAttribute('aria-label', 'Remove rule');
      removeBtn.textContent = '\u00d7';
      removeBtn.addEventListener('click', () => { const rules = currentProps.rules.filter((_, j) => j !== i); currentProps.onChange?.(rules); });
      row.appendChild(removeBtn);

      rulesEl.appendChild(row);
    });
  }

  function sync() {
    root.setAttribute('data-state', 'idle');
    root.setAttribute('data-disabled', currentProps.disabled ? 'true' : 'false');
    root.setAttribute('data-readonly', currentProps.readOnly ? 'true' : 'false');
    addBtn.disabled = currentProps.disabled || currentProps.readOnly || false;
    renderRules();
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createPolicyEditor;

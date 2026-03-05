/* ---------------------------------------------------------------------------
 * VariableInspector — Vanilla implementation
 *
 * Key-value inspector panel for process run variables with search/filter,
 * type badges, nested value display, and watch expressions panel.
 * ------------------------------------------------------------------------- */

export type VariableInspectorState = 'idle' | 'filtering' | 'varSelected';
export type VariableInspectorEvent =
  | { type: 'SEARCH' }
  | { type: 'SELECT_VAR' }
  | { type: 'ADD_WATCH' }
  | { type: 'CLEAR' }
  | { type: 'DESELECT' };

export function variableInspectorReducer(state: VariableInspectorState, event: VariableInspectorEvent): VariableInspectorState {
  switch (state) {
    case 'idle':
      if (event.type === 'SEARCH') return 'filtering';
      if (event.type === 'SELECT_VAR') return 'varSelected';
      if (event.type === 'ADD_WATCH') return 'idle';
      return state;
    case 'filtering':
      if (event.type === 'CLEAR') return 'idle';
      if (event.type === 'SELECT_VAR') return 'varSelected';
      return state;
    case 'varSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT_VAR') return 'varSelected';
      return state;
    default:
      return state;
  }
}

export interface ProcessVariable {
  name: string;
  type: string;
  value: unknown;
  scope?: string;
  changed?: boolean;
}

export interface WatchExpression {
  id: string;
  expression: string;
  value?: unknown;
}

export interface VariableInspectorProps {
  [key: string]: unknown; className?: string;
  variables?: ProcessVariable[];
  runStatus?: string;
  showTypes?: boolean;
  showWatch?: boolean;
  expandDepth?: number;
  watchExpressions?: WatchExpression[];
  onSelectVariable?: (name: string) => void;
  onAddWatch?: (expression: string) => void;
  onRemoveWatch?: (id: string) => void;
  onEditValue?: (name: string, value: unknown) => void;
}
export interface VariableInspectorOptions { target: HTMLElement; props: VariableInspectorProps; }

let _variableInspectorUid = 0;

function formatValue(value: unknown, depth: number, maxDepth: number): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (depth >= maxDepth) {
    if (Array.isArray(value)) return `Array(${value.length})`;
    return '{...}';
  }
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function typeBadgeLabel(type: string): string {
  const map: Record<string, string> = { string: 'str', number: 'num', boolean: 'bool', object: 'obj', array: 'arr' };
  return map[type.toLowerCase()] ?? type;
}

export class VariableInspector {
  private el: HTMLElement;
  private props: VariableInspectorProps;
  private state: VariableInspectorState = 'idle';
  private disposers: Array<() => void> = [];
  private searchQuery = '';
  private selectedVar: string | null = null;
  private focusIndex = 0;

  constructor(options: VariableInspectorOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'variable-inspector');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'region');
    this.el.setAttribute('aria-label', 'Variable inspector');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'variable-inspector-' + (++_variableInspectorUid);
    const onKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.el.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => this.el.removeEventListener('keydown', onKeyDown));
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  send(type: string): void { this.state = variableInspectorReducer(this.state, { type } as any); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<VariableInspectorProps>): void { Object.assign(this.props, props); this.cleanupRender(); this.el.innerHTML = ''; this.render(); }
  destroy(): void { this.cleanup(); this.el.remove(); }
  private cleanup(): void { for (const d of this.disposers) d(); this.disposers = []; }
  private cleanupRender(): void { const kept = this.disposers.slice(0, 1); for (let i = 1; i < this.disposers.length; i++) this.disposers[i](); this.disposers = kept; }
  private rerender(): void { this.cleanupRender(); this.el.innerHTML = ''; this.render(); }

  private get variables(): ProcessVariable[] { return (this.props.variables ?? []) as ProcessVariable[]; }
  private get filteredVariables(): ProcessVariable[] {
    if (!this.searchQuery) return this.variables;
    const q = this.searchQuery.toLowerCase();
    return this.variables.filter(v => v.name.toLowerCase().includes(q));
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.ctrlKey && e.key === 'f') { e.preventDefault(); const input = this.el.querySelector('[data-part="search-input"]') as HTMLInputElement; input?.focus(); return; }
    const filtered = this.filteredVariables;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.focusIndex = Math.min(this.focusIndex + 1, filtered.length - 1); this.rerender(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); this.focusIndex = Math.max(this.focusIndex - 1, 0); this.rerender(); }
    if (e.key === 'Enter') { e.preventDefault(); const v = filtered[this.focusIndex]; if (v) this.handleSelectVar(v.name); }
    if (e.key === 'Escape') { e.preventDefault(); this.handleDeselect(); }
  }

  private handleSelectVar(name: string): void {
    this.selectedVar = name;
    this.send('SELECT_VAR');
    this.props.onSelectVariable?.(name);
    this.rerender();
  }

  private handleDeselect(): void { this.selectedVar = null; this.send('DESELECT'); this.rerender(); }

  private render(): void {
    const showTypes = this.props.showTypes !== false;
    const showWatch = this.props.showWatch !== false;
    const expandDepth = (this.props.expandDepth as number) ?? 1;
    const watchExpressions = (this.props.watchExpressions ?? []) as WatchExpression[];
    const filtered = this.filteredVariables;

    this.el.setAttribute('data-state', this.state);
    if (this.props.className) this.el.className = this.props.className as string;

    // Search bar
    const searchDiv = document.createElement('div');
    searchDiv.setAttribute('data-part', 'search');
    const searchInput = document.createElement('input');
    searchInput.setAttribute('type', 'search');
    searchInput.setAttribute('data-part', 'search-input');
    searchInput.setAttribute('placeholder', 'Filter variables...');
    searchInput.setAttribute('aria-label', 'Filter variables by name');
    searchInput.value = this.searchQuery;
    const onSearch = () => { this.searchQuery = searchInput.value; if (this.searchQuery) this.send('SEARCH'); else this.send('CLEAR'); this.rerender(); };
    searchInput.addEventListener('input', onSearch);
    this.disposers.push(() => searchInput.removeEventListener('input', onSearch));
    searchDiv.appendChild(searchInput);
    if (this.searchQuery) {
      const clearBtn = document.createElement('button');
      clearBtn.setAttribute('type', 'button');
      clearBtn.setAttribute('data-part', 'search-clear');
      clearBtn.setAttribute('aria-label', 'Clear search');
      clearBtn.textContent = '\u2715';
      const onClear = () => { this.searchQuery = ''; this.send('CLEAR'); this.rerender(); };
      clearBtn.addEventListener('click', onClear);
      this.disposers.push(() => clearBtn.removeEventListener('click', onClear));
      searchDiv.appendChild(clearBtn);
    }
    this.el.appendChild(searchDiv);

    // Variable list
    const varList = document.createElement('div');
    varList.setAttribute('data-part', 'variable-list');
    varList.setAttribute('role', 'list');
    varList.setAttribute('aria-label', 'Variables');
    for (let i = 0; i < filtered.length; i++) {
      const variable = filtered[i];
      const isSelected = this.selectedVar === variable.name;
      const isFocused = this.focusIndex === i;
      const item = document.createElement('div');
      item.setAttribute('data-part', 'variable-item');
      item.setAttribute('role', 'listitem');
      item.setAttribute('aria-label', `${variable.name}: ${formatValue(variable.value, 0, 0)}`);
      item.setAttribute('aria-selected', String(isSelected));
      item.setAttribute('data-selected', isSelected ? 'true' : 'false');
      item.setAttribute('data-changed', variable.changed ? 'true' : 'false');
      item.setAttribute('tabindex', isFocused ? '0' : '-1');

      const nameEl = document.createElement('span');
      nameEl.setAttribute('data-part', 'var-name');
      nameEl.textContent = variable.name;
      item.appendChild(nameEl);

      if (showTypes) {
        const typeEl = document.createElement('span');
        typeEl.setAttribute('data-part', 'var-type');
        typeEl.setAttribute('data-type', variable.type);
        typeEl.textContent = typeBadgeLabel(variable.type);
        item.appendChild(typeEl);
      }

      if (variable.scope) {
        const scopeEl = document.createElement('span');
        scopeEl.setAttribute('data-part', 'var-scope');
        scopeEl.setAttribute('aria-label', `Scope: ${variable.scope}`);
        scopeEl.textContent = variable.scope;
        item.appendChild(scopeEl);
      }

      const valueDiv = document.createElement('div');
      valueDiv.setAttribute('data-part', 'var-value');
      this.renderValue(valueDiv, variable.value, 0, expandDepth);
      item.appendChild(valueDiv);

      if (variable.changed) {
        const changedEl = document.createElement('span');
        changedEl.setAttribute('data-part', 'changed-indicator');
        changedEl.setAttribute('aria-label', 'Value changed');
        changedEl.setAttribute('aria-hidden', 'true');
        changedEl.textContent = '\u2022';
        item.appendChild(changedEl);
      }

      const onClick = () => this.handleSelectVar(variable.name);
      item.addEventListener('click', onClick);
      this.disposers.push(() => item.removeEventListener('click', onClick));
      varList.appendChild(item);
    }
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.setAttribute('data-part', 'empty-state');
      empty.setAttribute('role', 'status');
      empty.textContent = this.searchQuery ? 'No variables match the filter' : 'No variables available';
      varList.appendChild(empty);
    }
    this.el.appendChild(varList);

    // Watch list
    if (showWatch) {
      const watchDiv = document.createElement('div');
      watchDiv.setAttribute('data-part', 'watch-list');
      watchDiv.setAttribute('data-visible', 'true');

      const watchHeader = document.createElement('div');
      watchHeader.setAttribute('data-part', 'watch-header');
      const headerSpan = document.createElement('span');
      headerSpan.textContent = 'Watch Expressions';
      watchHeader.appendChild(headerSpan);
      const addWatchBtn = document.createElement('button');
      addWatchBtn.setAttribute('type', 'button');
      addWatchBtn.setAttribute('data-part', 'add-watch');
      addWatchBtn.setAttribute('aria-label', 'Add watch expression');
      addWatchBtn.textContent = '+ Watch';
      const onAddWatch = () => {
        const expr = this.selectedVar ?? '';
        if (expr) { this.send('ADD_WATCH'); this.props.onAddWatch?.(expr); }
      };
      addWatchBtn.addEventListener('click', onAddWatch);
      this.disposers.push(() => addWatchBtn.removeEventListener('click', onAddWatch));
      watchHeader.appendChild(addWatchBtn);
      watchDiv.appendChild(watchHeader);

      for (const watch of watchExpressions) {
        const watchItem = document.createElement('div');
        watchItem.setAttribute('data-part', 'watch-item');
        watchItem.setAttribute('role', 'listitem');
        const exprSpan = document.createElement('span');
        exprSpan.setAttribute('data-part', 'watch-expression');
        exprSpan.textContent = watch.expression;
        watchItem.appendChild(exprSpan);
        const valSpan = document.createElement('span');
        valSpan.setAttribute('data-part', 'watch-value');
        valSpan.textContent = watch.value !== undefined ? formatValue(watch.value, 0, 1) : 'evaluating...';
        watchItem.appendChild(valSpan);
        const removeBtn = document.createElement('button');
        removeBtn.setAttribute('type', 'button');
        removeBtn.setAttribute('data-part', 'remove-watch');
        removeBtn.setAttribute('aria-label', `Remove watch: ${watch.expression}`);
        removeBtn.textContent = '\u2715';
        const onRemove = () => this.props.onRemoveWatch?.(watch.id);
        removeBtn.addEventListener('click', onRemove);
        this.disposers.push(() => removeBtn.removeEventListener('click', onRemove));
        watchItem.appendChild(removeBtn);
        watchDiv.appendChild(watchItem);
      }
      this.el.appendChild(watchDiv);
    }
  }

  private renderValue(container: HTMLElement, value: unknown, depth: number, maxDepth: number): void {
    if (value === null || value === undefined || typeof value !== 'object') {
      const span = document.createElement('span');
      span.setAttribute('data-part', 'primitive-value');
      span.textContent = formatValue(value, depth, maxDepth);
      container.appendChild(span);
      return;
    }
    const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value as Record<string, unknown>);
    const expanded = depth < maxDepth;
    const complexDiv = document.createElement('div');
    complexDiv.setAttribute('data-part', 'complex-value');
    complexDiv.setAttribute('data-expanded', expanded ? 'true' : 'false');
    const toggleBtn = document.createElement('button');
    toggleBtn.setAttribute('type', 'button');
    toggleBtn.setAttribute('data-part', 'expand-toggle');
    toggleBtn.setAttribute('aria-expanded', String(expanded));
    toggleBtn.setAttribute('aria-label', expanded ? 'Collapse value' : 'Expand value');
    toggleBtn.textContent = `${expanded ? '\u25BC' : '\u25B6'} ${Array.isArray(value) ? `Array(${value.length})` : `Object(${entries.length})`}`;
    complexDiv.appendChild(toggleBtn);
    if (expanded) {
      const nested = document.createElement('div');
      nested.setAttribute('data-part', 'nested-entries');
      nested.setAttribute('role', 'group');
      for (const [key, val] of entries) {
        const entry = document.createElement('div');
        entry.setAttribute('data-part', 'nested-entry');
        entry.style.paddingLeft = `${(depth + 1) * 12}px`;
        const keySpan = document.createElement('span');
        keySpan.setAttribute('data-part', 'entry-key');
        keySpan.textContent = `${key}: `;
        entry.appendChild(keySpan);
        this.renderValue(entry, val, depth + 1, maxDepth);
        nested.appendChild(entry);
      }
      complexDiv.appendChild(nested);
    }
    container.appendChild(complexDiv);
  }
}

export default VariableInspector;

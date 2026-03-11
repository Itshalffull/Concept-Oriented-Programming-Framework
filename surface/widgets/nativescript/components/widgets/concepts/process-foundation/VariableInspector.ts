import {
  StackLayout,
  Label,
  Button,
  ScrollView,
  TextField,
} from '@nativescript/core';

export type VariableInspectorState = 'idle' | 'filtering' | 'varSelected';
export type VariableInspectorEvent =
  | { type: 'SEARCH'; query?: string }
  | { type: 'SELECT_VAR'; name?: string }
  | { type: 'ADD_WATCH'; name?: string }
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
  variables: ProcessVariable[];
  runStatus: string;
  showTypes?: boolean;
  showWatch?: boolean;
  expandDepth?: number;
  watchExpressions?: WatchExpression[];
  onSelectVariable?: (name: string) => void;
  onAddWatch?: (expression: string) => void;
  onRemoveWatch?: (id: string) => void;
  onEditValue?: (name: string, value: unknown) => void;
}

function formatValue(value: unknown, depth: number, maxDepth: number): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (depth >= maxDepth) {
    if (Array.isArray(value)) return `Array(${value.length})`;
    return '{...}';
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function typeBadgeLabel(type: string): string {
  const map: Record<string, string> = {
    string: 'str',
    number: 'num',
    boolean: 'bool',
    object: 'obj',
    array: 'arr',
  };
  return map[type.toLowerCase()] ?? type;
}

export function createVariableInspector(props: VariableInspectorProps): {
  view: StackLayout;
  dispose: () => void;
} {
  let state: VariableInspectorState = 'idle';
  let searchQuery = '';
  let selectedVar: string | null = null;
  const expandDepth = props.expandDepth ?? 1;
  const disposers: (() => void)[] = [];

  function send(event: VariableInspectorEvent) {
    state = variableInspectorReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'variable-inspector';
  root.automationText = 'Variable inspector';

  // Search bar
  const searchRow = new StackLayout();
  searchRow.orientation = 'horizontal';

  const searchInput = new TextField();
  searchInput.hint = 'Filter variables...';
  const searchCb = () => {
    searchQuery = searchInput.text;
    if (searchQuery) {
      send({ type: 'SEARCH', query: searchQuery });
    } else {
      send({ type: 'CLEAR' });
    }
  };
  searchInput.on('textChange', searchCb);
  disposers.push(() => searchInput.off('textChange', searchCb));
  searchRow.addChild(searchInput);

  const clearBtn = new Button();
  clearBtn.text = '\u2715';
  clearBtn.on('tap', () => {
    searchInput.text = '';
    searchQuery = '';
    send({ type: 'CLEAR' });
  });
  searchRow.addChild(clearBtn);
  root.addChild(searchRow);

  // Variable list
  const varScroll = new ScrollView();
  const varList = new StackLayout();
  varScroll.content = varList;
  root.addChild(varScroll);

  // Watch panel
  const watchPanel = new StackLayout();
  watchPanel.marginTop = 12;
  root.addChild(watchPanel);

  function renderValue(value: unknown, depth: number, parent: StackLayout) {
    if (value === null || value === undefined || typeof value !== 'object') {
      const primLbl = new Label();
      primLbl.text = formatValue(value, depth, expandDepth);
      primLbl.fontFamily = 'monospace';
      primLbl.fontSize = 12;
      parent.addChild(primLbl);
      return;
    }

    const entries = Array.isArray(value)
      ? value.map((v, i) => [String(i), v] as const)
      : Object.entries(value as Record<string, unknown>);

    if (depth >= expandDepth) {
      const summLbl = new Label();
      summLbl.text = Array.isArray(value) ? `Array(${value.length})` : `Object(${entries.length})`;
      summLbl.fontFamily = 'monospace';
      summLbl.fontSize = 12;
      parent.addChild(summLbl);
      return;
    }

    const headerLbl = new Label();
    headerLbl.text = Array.isArray(value) ? `Array(${value.length})` : `Object(${entries.length})`;
    headerLbl.fontFamily = 'monospace';
    headerLbl.fontSize = 12;
    parent.addChild(headerLbl);

    for (const [key, val] of entries) {
      const entryRow = new StackLayout();
      entryRow.paddingLeft = (depth + 1) * 12;

      const keyLbl = new Label();
      keyLbl.text = `${key}: `;
      keyLbl.fontFamily = 'monospace';
      keyLbl.fontSize = 12;
      keyLbl.fontWeight = 'bold';
      entryRow.addChild(keyLbl);

      renderValue(val, depth + 1, entryRow);
      parent.addChild(entryRow);
    }
  }

  function update() {
    clearBtn.visibility = searchQuery ? 'visible' : 'collapsed';

    const filtered = searchQuery
      ? props.variables.filter((v) => v.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : props.variables;

    varList.removeChildren();
    if (filtered.length === 0) {
      const emptyLbl = new Label();
      emptyLbl.text = searchQuery ? 'No variables match the filter' : 'No variables available';
      emptyLbl.textAlignment = 'center';
      emptyLbl.padding = 16;
      varList.addChild(emptyLbl);
    } else {
      for (const variable of filtered) {
        const item = new StackLayout();
        item.padding = 8;
        item.marginBottom = 4;
        item.borderWidth = selectedVar === variable.name ? 2 : 1;
        item.borderColor = selectedVar === variable.name ? '#3b82f6' : '#e5e7eb';
        item.borderRadius = 4;

        const nameRow = new StackLayout();
        nameRow.orientation = 'horizontal';

        const nameLbl = new Label();
        nameLbl.text = variable.name;
        nameLbl.fontWeight = 'bold';
        nameRow.addChild(nameLbl);

        if (props.showTypes !== false) {
          const typeLbl = new Label();
          typeLbl.text = typeBadgeLabel(variable.type);
          typeLbl.marginLeft = 8;
          typeLbl.fontSize = 11;
          typeLbl.className = 'var-type';
          nameRow.addChild(typeLbl);
        }

        if (variable.scope) {
          const scopeLbl = new Label();
          scopeLbl.text = variable.scope;
          scopeLbl.marginLeft = 8;
          scopeLbl.fontSize = 11;
          nameRow.addChild(scopeLbl);
        }

        if (variable.changed) {
          const changeLbl = new Label();
          changeLbl.text = '\u2022';
          changeLbl.marginLeft = 4;
          changeLbl.color = '#3b82f6' as any;
          nameRow.addChild(changeLbl);
        }

        item.addChild(nameRow);

        const valueContainer = new StackLayout();
        valueContainer.marginTop = 2;
        renderValue(variable.value, 0, valueContainer);
        item.addChild(valueContainer);

        item.on('tap', () => {
          selectedVar = variable.name;
          send({ type: 'SELECT_VAR', name: variable.name });
          props.onSelectVariable?.(variable.name);
        });

        varList.addChild(item);
      }
    }

    // Watch panel
    watchPanel.removeChildren();
    if (props.showWatch !== false) {
      watchPanel.visibility = 'visible';
      const watchHeader = new StackLayout();
      watchHeader.orientation = 'horizontal';

      const watchTitle = new Label();
      watchTitle.text = 'Watch Expressions';
      watchTitle.fontWeight = 'bold';
      watchHeader.addChild(watchTitle);

      const addWatchBtn = new Button();
      addWatchBtn.text = '+ Watch';
      addWatchBtn.marginLeft = 8;
      addWatchBtn.on('tap', () => {
        const expr = selectedVar ?? '';
        if (expr) {
          send({ type: 'ADD_WATCH', name: expr });
          props.onAddWatch?.(expr);
        }
      });
      watchHeader.addChild(addWatchBtn);
      watchPanel.addChild(watchHeader);

      const watches = props.watchExpressions ?? [];
      for (const watch of watches) {
        const wRow = new StackLayout();
        wRow.orientation = 'horizontal';
        wRow.marginTop = 4;

        const wExpr = new Label();
        wExpr.text = watch.expression;
        wExpr.fontFamily = 'monospace';
        wExpr.fontSize = 12;
        wRow.addChild(wExpr);

        const wVal = new Label();
        wVal.text = watch.value !== undefined ? formatValue(watch.value, 0, 1) : 'evaluating...';
        wVal.marginLeft = 8;
        wVal.fontSize = 12;
        wRow.addChild(wVal);

        const wRemove = new Button();
        wRemove.text = '\u2715';
        wRemove.marginLeft = 8;
        wRemove.on('tap', () => {
          props.onRemoveWatch?.(watch.id);
        });
        wRow.addChild(wRemove);

        watchPanel.addChild(wRow);
      }
    } else {
      watchPanel.visibility = 'collapsed';
    }
  }

  update();

  return {
    view: root,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createVariableInspector;

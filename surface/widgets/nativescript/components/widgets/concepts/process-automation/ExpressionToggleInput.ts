import {
  StackLayout,
  Label,
  Button,
  TextField,
  TextView,
  Switch,
} from '@nativescript/core';

export type ExpressionToggleInputState = 'fixed' | 'expression' | 'autocompleting';
export type ExpressionToggleInputEvent =
  | { type: 'TOGGLE' }
  | { type: 'INPUT'; value?: string }
  | { type: 'SHOW_AC' }
  | { type: 'SELECT'; variable?: string }
  | { type: 'DISMISS' };

export function expressionToggleInputReducer(state: ExpressionToggleInputState, event: ExpressionToggleInputEvent): ExpressionToggleInputState {
  switch (state) {
    case 'fixed':
      if (event.type === 'TOGGLE') return 'expression';
      if (event.type === 'INPUT') return 'fixed';
      return state;
    case 'expression':
      if (event.type === 'TOGGLE') return 'fixed';
      if (event.type === 'INPUT') return 'expression';
      if (event.type === 'SHOW_AC') return 'autocompleting';
      return state;
    case 'autocompleting':
      if (event.type === 'SELECT') return 'expression';
      if (event.type === 'DISMISS') return 'expression';
      return state;
    default:
      return state;
  }
}

export interface ExpressionToggleInputProps {
  value: string;
  mode: string;
  fieldType?: 'text' | 'number' | 'boolean' | 'object';
  variables?: string[];
  expression?: string;
  previewValue?: string;
  expressionValid?: boolean;
  onChange?: (value: string) => void;
  onExpressionChange?: (expression: string) => void;
  onToggleMode?: (mode: 'fixed' | 'expression') => void;
}

export function createExpressionToggleInput(props: ExpressionToggleInputProps): {
  view: StackLayout;
  dispose: () => void;
} {
  let state: ExpressionToggleInputState = 'fixed';
  let fixedValue = props.value;
  let expressionValue = props.expression ?? '';
  let acIndex = 0;
  const variables = props.variables ?? [];
  const disposers: (() => void)[] = [];

  function send(event: ExpressionToggleInputEvent) {
    state = expressionToggleInputReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'expression-toggle-input';
  root.automationText = 'Expression toggle input';

  // Mode toggle
  const modeToggle = new Button();
  modeToggle.text = 'Fixed';
  const modeToggleCb = () => {
    const newMode = state === 'fixed' ? 'expression' : 'fixed';
    send({ type: 'TOGGLE' });
    props.onToggleMode?.(newMode as 'fixed' | 'expression');
  };
  modeToggle.on('tap', modeToggleCb);
  disposers.push(() => modeToggle.off('tap', modeToggleCb));
  root.addChild(modeToggle);

  // Fixed input area
  const fixedArea = new StackLayout();
  root.addChild(fixedArea);

  // Expression area
  const exprArea = new StackLayout();
  root.addChild(exprArea);

  // Autocomplete list
  const acArea = new StackLayout();
  acArea.className = 'autocomplete';
  root.addChild(acArea);

  // Preview
  const previewLbl = new Label();
  previewLbl.fontSize = 12;
  previewLbl.marginTop = 4;
  root.addChild(previewLbl);

  function getSuggestions(query: string): string[] {
    if (!query) return variables;
    const q = query.toLowerCase();
    return variables.filter((v) => v.toLowerCase().includes(q));
  }

  function update() {
    const isExpr = state !== 'fixed';
    modeToggle.text = isExpr ? 'Expression' : 'Fixed';

    // Fixed area
    fixedArea.removeChildren();
    fixedArea.visibility = !isExpr ? 'visible' : 'collapsed';
    if (!isExpr) {
      const fieldType = props.fieldType ?? 'text';
      if (fieldType === 'boolean') {
        const boolRow = new StackLayout();
        boolRow.orientation = 'horizontal';
        const sw = new Switch();
        sw.checked = fixedValue === 'true';
        sw.on('checkedChange', () => {
          fixedValue = String(sw.checked);
          send({ type: 'INPUT', value: fixedValue });
          props.onChange?.(fixedValue);
        });
        boolRow.addChild(sw);
        const boolLbl = new Label();
        boolLbl.text = fixedValue === 'true' ? 'true' : 'false';
        boolLbl.marginLeft = 8;
        boolRow.addChild(boolLbl);
        fixedArea.addChild(boolRow);
      } else if (fieldType === 'object') {
        const objInput = new TextView();
        objInput.text = fixedValue;
        objInput.hint = 'JSON value';
        objInput.on('textChange', () => {
          fixedValue = objInput.text;
          send({ type: 'INPUT', value: fixedValue });
          props.onChange?.(fixedValue);
        });
        fixedArea.addChild(objInput);
      } else {
        const tf = new TextField();
        tf.text = fixedValue;
        tf.keyboardType = fieldType === 'number' ? 'number' : 'text';
        tf.on('textChange', () => {
          fixedValue = tf.text;
          send({ type: 'INPUT', value: fixedValue });
          props.onChange?.(fixedValue);
        });
        fixedArea.addChild(tf);
      }
    }

    // Expression area
    exprArea.removeChildren();
    exprArea.visibility = isExpr ? 'visible' : 'collapsed';
    if (isExpr) {
      const exprInput = new TextView();
      exprInput.text = expressionValue;
      exprInput.hint = 'Enter expression...';
      exprInput.on('textChange', () => {
        expressionValue = exprInput.text;
        send({ type: 'INPUT', value: expressionValue });
        props.onExpressionChange?.(expressionValue);

        const lastWord = expressionValue.split(/[\s()+\-*/,]+/).pop() ?? '';
        if (lastWord.length > 0 && variables.some((v) => v.toLowerCase().startsWith(lastWord.toLowerCase()))) {
          acIndex = 0;
          send({ type: 'SHOW_AC' });
        }
      });
      exprArea.addChild(exprInput);
    }

    // Autocomplete
    acArea.removeChildren();
    acArea.visibility = state === 'autocompleting' ? 'visible' : 'collapsed';
    if (state === 'autocompleting') {
      const lastWord = expressionValue.split(/[\s()+\-*/,]+/).pop() ?? '';
      const suggestions = getSuggestions(lastWord);
      if (suggestions.length === 0) {
        const noMatch = new Label();
        noMatch.text = 'No matching variables';
        noMatch.fontSize = 12;
        acArea.addChild(noMatch);
      } else {
        suggestions.forEach((variable, idx) => {
          const item = new Button();
          item.text = variable;
          item.className = idx === acIndex ? 'ac-focused' : 'ac-item';
          item.on('tap', () => {
            const parts = expressionValue.split(/[\s()+\-*/,]+/);
            const lastPart = parts[parts.length - 1] ?? '';
            expressionValue = expressionValue.slice(0, expressionValue.length - lastPart.length) + variable;
            props.onExpressionChange?.(expressionValue);
            send({ type: 'SELECT', variable });
          });
          acArea.addChild(item);
        });
      }
    }

    // Preview
    if (isExpr && props.previewValue !== undefined) {
      previewLbl.visibility = 'visible';
      previewLbl.text = props.previewValue;
      previewLbl.className = props.expressionValid !== false ? 'preview-valid' : 'preview-invalid';
    } else if (isExpr && expressionValue) {
      previewLbl.visibility = 'visible';
      previewLbl.text = 'Enter expression to preview';
    } else {
      previewLbl.visibility = 'collapsed';
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

export default createExpressionToggleInput;

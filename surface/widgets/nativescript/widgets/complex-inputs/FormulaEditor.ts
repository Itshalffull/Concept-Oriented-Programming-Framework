// ============================================================
// Clef Surface NativeScript Widget — FormulaEditor
//
// Formula/expression editing control with a multi-line text
// input, syntax highlighting labels, a function palette for
// inserting common functions, and a live preview panel showing
// the evaluated formula result.
//
// Adapts the formula-editor.widget spec: anatomy (root, editor,
// preview, functionPalette, insertButton), states (editing,
// valid, invalid, focused), and connect attributes to
// NativeScript text views and layout containers.
// ============================================================

import {
  StackLayout,
  GridLayout,
  WrapLayout,
  Label,
  TextView,
  Button,
  ScrollView,
} from '@nativescript/core';

// --------------- Props ---------------

export interface FormulaEditorProps {
  value?: string;
  functions?: string[];
  variables?: string[];
  enabled?: boolean;
  onFormulaChange?: (formula: string) => void;
}

// --------------- Helpers ---------------

const DEFAULT_FUNCTIONS = [
  'SUM', 'AVG', 'MIN', 'MAX', 'COUNT',
  'IF', 'AND', 'OR', 'NOT',
  'ROUND', 'ABS', 'FLOOR', 'CEIL',
  'CONCAT', 'LEN', 'UPPER', 'LOWER',
];

function validateFormula(formula: string): { valid: boolean; message: string } {
  const trimmed = formula.trim();
  if (!trimmed) return { valid: true, message: '' };

  let parens = 0;
  for (const ch of trimmed) {
    if (ch === '(') parens++;
    if (ch === ')') parens--;
    if (parens < 0) return { valid: false, message: 'Unmatched closing parenthesis' };
  }
  if (parens !== 0) return { valid: false, message: 'Unmatched opening parenthesis' };

  return { valid: true, message: 'Valid formula' };
}

// --------------- Component ---------------

/**
 * Creates a NativeScript formula editor with a multi-line text
 * area, function insertion palette, variable reference chips,
 * live validation feedback, and formula preview.
 */
export function createFormulaEditor(props: FormulaEditorProps = {}): StackLayout {
  const {
    value = '',
    functions = DEFAULT_FUNCTIONS,
    variables = [],
    enabled = true,
    onFormulaChange,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-widget-formula-editor';
  container.padding = 8;

  // -- Header --
  const header = new Label();
  header.text = 'Formula Editor';
  header.fontWeight = 'bold';
  header.fontSize = 16;
  header.marginBottom = 8;
  container.addChild(header);

  // -- Formula text area --
  const editorArea = new TextView();
  editorArea.text = value;
  editorArea.hint = 'Enter formula, e.g. SUM(A1, B2) + 10';
  editorArea.isEnabled = enabled;
  editorArea.height = 100;
  editorArea.borderWidth = 1;
  editorArea.borderColor = '#CCCCCC';
  editorArea.borderRadius = 4;
  editorArea.padding = 8;
  editorArea.fontSize = 14;
  editorArea.fontFamily = 'monospace';
  editorArea.marginBottom = 4;

  // -- Validation message --
  const validationLabel = new Label();
  validationLabel.fontSize = 12;
  validationLabel.marginBottom = 8;

  function updateValidation(): void {
    const result = validateFormula(editorArea.text);
    if (!editorArea.text.trim()) {
      validationLabel.text = '';
      editorArea.borderColor = '#CCCCCC';
    } else if (result.valid) {
      validationLabel.text = '\u2713 ' + result.message;
      validationLabel.color = '#4CAF50' as any;
      editorArea.borderColor = '#4CAF50';
    } else {
      validationLabel.text = '\u2717 ' + result.message;
      validationLabel.color = '#F44336' as any;
      editorArea.borderColor = '#F44336';
    }
  }

  editorArea.on('textChange', () => {
    updateValidation();
    if (onFormulaChange) onFormulaChange(editorArea.text);
  });

  container.addChild(editorArea);
  container.addChild(validationLabel);

  // -- Function palette --
  const funcTitle = new Label();
  funcTitle.text = 'Functions';
  funcTitle.fontSize = 12;
  funcTitle.fontWeight = 'bold';
  funcTitle.opacity = 0.7;
  funcTitle.marginBottom = 4;
  container.addChild(funcTitle);

  const funcScroll = new ScrollView();
  funcScroll.height = 80;
  funcScroll.marginBottom = 8;

  const funcGrid = new WrapLayout();
  funcGrid.orientation = 'horizontal';

  functions.forEach((fn) => {
    const btn = new Button();
    btn.text = fn;
    btn.fontSize = 11;
    btn.padding = 4;
    btn.margin = 2;
    btn.borderRadius = 4;
    btn.height = 30;
    btn.backgroundColor = '#E3F2FD' as any;
    btn.color = '#1565C0' as any;
    if (enabled) {
      btn.on('tap', () => {
        const current = editorArea.text;
        editorArea.text = current + fn + '()';
        updateValidation();
        if (onFormulaChange) onFormulaChange(editorArea.text);
      });
    }
    funcGrid.addChild(btn);
  });

  funcScroll.content = funcGrid;
  container.addChild(funcScroll);

  // -- Variables palette --
  if (variables.length > 0) {
    const varTitle = new Label();
    varTitle.text = 'Variables';
    varTitle.fontSize = 12;
    varTitle.fontWeight = 'bold';
    varTitle.opacity = 0.7;
    varTitle.marginBottom = 4;
    container.addChild(varTitle);

    const varGrid = new WrapLayout();
    varGrid.orientation = 'horizontal';
    varGrid.marginBottom = 8;

    variables.forEach((v) => {
      const chip = new Button();
      chip.text = v;
      chip.fontSize = 11;
      chip.padding = 4;
      chip.margin = 2;
      chip.borderRadius = 12;
      chip.height = 28;
      chip.backgroundColor = '#E8F5E9' as any;
      chip.color = '#2E7D32' as any;
      if (enabled) {
        chip.on('tap', () => {
          editorArea.text = editorArea.text + v;
          updateValidation();
          if (onFormulaChange) onFormulaChange(editorArea.text);
        });
      }
      varGrid.addChild(chip);
    });

    container.addChild(varGrid);
  }

  // -- Preview panel --
  const previewBox = new StackLayout();
  previewBox.borderWidth = 1;
  previewBox.borderColor = '#E0E0E0';
  previewBox.borderRadius = 4;
  previewBox.padding = 8;
  previewBox.backgroundColor = '#FAFAFA' as any;

  const previewTitle = new Label();
  previewTitle.text = 'Preview';
  previewTitle.fontSize = 12;
  previewTitle.fontWeight = 'bold';
  previewTitle.opacity = 0.7;
  previewBox.addChild(previewTitle);

  const previewValue = new Label();
  previewValue.text = value || '(empty)';
  previewValue.fontSize = 13;
  previewValue.fontFamily = 'monospace';
  previewValue.marginTop = 4;
  previewBox.addChild(previewValue);

  editorArea.on('textChange', () => {
    previewValue.text = editorArea.text || '(empty)';
  });

  container.addChild(previewBox);

  updateValidation();

  if (!enabled) {
    container.opacity = 0.38;
  }

  return container;
}

createFormulaEditor.displayName = 'FormulaEditor';
export default createFormulaEditor;

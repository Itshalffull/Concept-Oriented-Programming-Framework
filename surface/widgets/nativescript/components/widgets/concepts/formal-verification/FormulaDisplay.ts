import {
  StackLayout,
  Label,
  Button,
  ScrollView,
  Color,
  View,
} from '@nativescript/core';

export type FormulaDisplayState = 'idle' | 'copied' | 'rendering';
export type FormulaDisplayEvent =
  | { type: 'COPY' }
  | { type: 'RENDER_LATEX' }
  | { type: 'TIMEOUT' }
  | { type: 'RENDER_COMPLETE' };

export function formulaDisplayReducer(state: FormulaDisplayState, event: FormulaDisplayEvent): FormulaDisplayState {
  switch (state) {
    case 'idle':
      if (event.type === 'COPY') return 'copied';
      if (event.type === 'RENDER_LATEX') return 'rendering';
      return state;
    case 'copied':
      if (event.type === 'TIMEOUT') return 'idle';
      return state;
    case 'rendering':
      if (event.type === 'RENDER_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

export type FormulaLanguage = 'smtlib' | 'tlaplus' | 'alloy' | 'lean' | 'dafny' | 'cvl';

const LANGUAGE_LABELS: Record<FormulaLanguage, string> = {
  smtlib: 'SMT-LIB',
  tlaplus: 'TLA+',
  alloy: 'Alloy',
  lean: 'Lean',
  dafny: 'Dafny',
  cvl: 'CVL',
};

const COLLAPSE_THRESHOLD = 200;

export interface FormulaDisplayProps {
  formula: string;
  language: FormulaLanguage;
  scope?: string | undefined;
  renderLatex?: boolean;
  name?: string | undefined;
  description?: string | undefined;
}

export function createFormulaDisplay(props: FormulaDisplayProps): { view: View; dispose: () => void } {
  let state: FormulaDisplayState = 'idle';
  let expanded = false;
  let descriptionOpen = false;
  const disposers: (() => void)[] = [];

  const language = props.language ?? 'smtlib';
  const isLong = props.formula.length > COLLAPSE_THRESHOLD;

  function send(event: FormulaDisplayEvent) {
    state = formulaDisplayReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'clef-formula-display';
  root.automationText = props.name
    ? `Formula: ${props.name} in ${LANGUAGE_LABELS[language]}`
    : `Formula in ${LANGUAGE_LABELS[language]}`;

  // Header row: language badge + scope + copy button
  const header = new StackLayout();
  header.orientation = 'horizontal';
  header.padding = '4 8';

  const langBadge = new Label();
  langBadge.text = LANGUAGE_LABELS[language];
  langBadge.fontSize = 12;
  langBadge.className = 'formula-lang-badge';
  langBadge.borderWidth = 1;
  langBadge.borderColor = new Color('#9ca3af');
  langBadge.borderRadius = 4;
  langBadge.padding = '2 6';
  header.addChild(langBadge);

  if (props.scope) {
    const scopeBadge = new Label();
    scopeBadge.text = props.scope;
    scopeBadge.fontSize = 12;
    scopeBadge.marginLeft = 8;
    scopeBadge.opacity = 0.7;
    header.addChild(scopeBadge);
  }

  const copyBtn = new Button();
  copyBtn.text = 'Copy';
  copyBtn.fontSize = 12;
  copyBtn.className = 'formula-copy-btn';
  copyBtn.marginLeft = 8;
  copyBtn.borderWidth = 1;
  copyBtn.borderColor = new Color('#9ca3af');
  copyBtn.borderRadius = 4;
  copyBtn.padding = '2 8';
  const copyHandler = () => {
    send({ type: 'COPY' });
    const timer = setTimeout(() => send({ type: 'TIMEOUT' }), 2000);
    disposers.push(() => clearTimeout(timer));
  };
  copyBtn.on('tap', copyHandler);
  disposers.push(() => copyBtn.off('tap', copyHandler));
  header.addChild(copyBtn);

  root.addChild(header);

  // Name label
  const nameLabel = new Label();
  if (props.name) {
    nameLabel.text = props.name;
    nameLabel.fontWeight = 'bold';
    nameLabel.padding = '4 8';
    root.addChild(nameLabel);
  }

  // Code block
  const codeScroll = new ScrollView();
  const codeLabel = new Label();
  codeLabel.fontFamily = 'monospace';
  codeLabel.fontSize = 13;
  codeLabel.textWrap = true;
  codeLabel.padding = '8';
  codeLabel.automationText = 'Formula text';
  codeScroll.content = codeLabel;
  root.addChild(codeScroll);

  // Expand/collapse toggle for long formulas
  const expandBtn = new Button();
  expandBtn.fontSize = 12;
  expandBtn.className = 'formula-expand-btn';
  expandBtn.padding = '2 0';
  if (isLong) {
    const expandHandler = () => {
      expanded = !expanded;
      update();
    };
    expandBtn.on('tap', expandHandler);
    disposers.push(() => expandBtn.off('tap', expandHandler));
    root.addChild(expandBtn);
  }

  // Description toggle + panel
  let descToggleBtn: Button | null = null;
  let descLabel: Label | null = null;
  if (props.description) {
    descToggleBtn = new Button();
    descToggleBtn.fontSize = 12;
    descToggleBtn.padding = '2 0';
    descToggleBtn.className = 'formula-desc-toggle';
    const descHandler = () => {
      descriptionOpen = !descriptionOpen;
      update();
    };
    descToggleBtn.on('tap', descHandler);
    disposers.push(() => descToggleBtn!.off('tap', descHandler));
    root.addChild(descToggleBtn);

    descLabel = new Label();
    descLabel.fontSize = 14;
    descLabel.textWrap = true;
    descLabel.padding = '4 8';
    descLabel.opacity = 0.85;
    root.addChild(descLabel);
  }

  // LaTeX rendering trigger
  if (props.renderLatex) {
    send({ type: 'RENDER_LATEX' });
    const timer = setTimeout(() => send({ type: 'RENDER_COMPLETE' }), 100);
    disposers.push(() => clearTimeout(timer));
  }

  function update() {
    // Update copy button text
    copyBtn.text = state === 'copied' ? 'Copied!' : 'Copy';

    // Update formula text
    const displayFormula = isLong && !expanded
      ? props.formula.slice(0, COLLAPSE_THRESHOLD) + '\u2026'
      : props.formula;
    codeLabel.text = displayFormula;

    // Update expand toggle
    if (isLong) {
      expandBtn.text = expanded ? 'Show less' : 'Show more';
    }

    // Update description
    if (descToggleBtn && descLabel) {
      descToggleBtn.text = descriptionOpen ? 'Hide description' : 'Show description';
      descLabel.text = descriptionOpen ? (props.description ?? '') : '';
      descLabel.visibility = descriptionOpen ? 'visible' : 'collapse';
    }
  }

  update();

  return {
    view: root,
    dispose() { disposers.forEach((d) => d()); },
  };
}

export default createFormulaDisplay;

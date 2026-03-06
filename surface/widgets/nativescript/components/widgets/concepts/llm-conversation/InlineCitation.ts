import { StackLayout, Label, FlexboxLayout } from '@nativescript/core';

/* ---------------------------------------------------------------------------
 * InlineCitation state machine
 * States: idle, previewing, navigating
 * ------------------------------------------------------------------------- */

export type InlineCitationState = 'idle' | 'previewing' | 'navigating';
export type InlineCitationEvent =
  | { type: 'HOVER' }
  | { type: 'CLICK' }
  | { type: 'LEAVE' }
  | { type: 'NAVIGATE_COMPLETE' };

export function inlineCitationReducer(state: InlineCitationState, event: InlineCitationEvent): InlineCitationState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'previewing';
      if (event.type === 'CLICK') return 'navigating';
      return state;
    case 'previewing':
      if (event.type === 'LEAVE') return 'idle';
      if (event.type === 'CLICK') return 'navigating';
      return state;
    case 'navigating':
      if (event.type === 'NAVIGATE_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface InlineCitationProps {
  index: number;
  title: string;
  url?: string;
  excerpt?: string;
  size?: 'sm' | 'md';
  showPreviewOnHover?: boolean;
}

/* ---------------------------------------------------------------------------
 * Widget
 * ------------------------------------------------------------------------- */

export function createInlineCitation(props: InlineCitationProps): { view: StackLayout; dispose: () => void } {
  const {
    index,
    title,
    url,
    excerpt,
    showPreviewOnHover = true,
  } = props;

  let state: InlineCitationState = 'idle';
  const disposers: (() => void)[] = [];

  function send(event: InlineCitationEvent) {
    state = inlineCitationReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'inline-citation';
  root.automationText = `Citation ${index}: ${title}`;

  // Badge
  const badge = new Label();
  badge.className = 'inline-citation-badge';
  badge.text = `[${index}]`;
  badge.color = '#2563eb' as any;
  root.addChild(badge);

  // Tooltip container
  const tooltip = new StackLayout();
  tooltip.className = 'inline-citation-tooltip';
  tooltip.visibility = 'collapse' as any;

  const titleLabel = new Label();
  titleLabel.className = 'inline-citation-title';
  titleLabel.text = title;
  tooltip.addChild(titleLabel);

  if (excerpt) {
    const excerptLabel = new Label();
    excerptLabel.className = 'inline-citation-excerpt';
    excerptLabel.text = excerpt;
    excerptLabel.textWrap = true;
    tooltip.addChild(excerptLabel);
  }

  if (url) {
    const urlLabel = new Label();
    urlLabel.className = 'inline-citation-url';
    urlLabel.text = url;
    tooltip.addChild(urlLabel);
  }

  root.addChild(tooltip);

  // Tap to navigate
  const tapHandler = () => {
    send({ type: 'CLICK' });
    // Auto-complete navigation
    setTimeout(() => send({ type: 'NAVIGATE_COMPLETE' }), 0);
  };
  root.on('tap', tapHandler);
  disposers.push(() => root.off('tap', tapHandler));

  // Long press to preview
  if (showPreviewOnHover) {
    const longPressHandler = () => {
      if (state === 'idle') {
        send({ type: 'HOVER' });
      } else if (state === 'previewing') {
        send({ type: 'LEAVE' });
      }
    };
    root.on('longPress', longPressHandler);
    disposers.push(() => root.off('longPress', longPressHandler));
  }

  function update() {
    tooltip.visibility = (state === 'previewing' ? 'visible' : 'collapse') as any;
  }

  return {
    view: root,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createInlineCitation;

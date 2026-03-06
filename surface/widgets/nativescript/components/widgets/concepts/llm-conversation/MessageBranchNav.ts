import { StackLayout, Label, Button, FlexboxLayout } from '@nativescript/core';

/* ---------------------------------------------------------------------------
 * MessageBranchNav state machine
 * States: viewing, editing
 * ------------------------------------------------------------------------- */

export type MessageBranchNavState = 'viewing' | 'editing';
export type MessageBranchNavEvent =
  | { type: 'PREV' }
  | { type: 'NEXT' }
  | { type: 'EDIT' }
  | { type: 'SAVE' }
  | { type: 'CANCEL' };

export function messageBranchNavReducer(state: MessageBranchNavState, event: MessageBranchNavEvent): MessageBranchNavState {
  switch (state) {
    case 'viewing':
      if (event.type === 'PREV') return 'viewing';
      if (event.type === 'NEXT') return 'viewing';
      if (event.type === 'EDIT') return 'editing';
      return state;
    case 'editing':
      if (event.type === 'SAVE') return 'viewing';
      if (event.type === 'CANCEL') return 'viewing';
      return state;
    default:
      return state;
  }
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface MessageBranchNavProps {
  currentIndex: number;
  totalBranches: number;
  showEdit?: boolean;
  compact?: boolean;
  onPrevBranch?: () => void;
  onNextBranch?: () => void;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
}

/* ---------------------------------------------------------------------------
 * Widget
 * ------------------------------------------------------------------------- */

export function createMessageBranchNav(props: MessageBranchNavProps): { view: StackLayout; dispose: () => void } {
  const {
    currentIndex,
    totalBranches,
    showEdit = true,
    onPrevBranch,
    onNextBranch,
    onEdit,
    onSave,
    onCancel,
  } = props;

  let state: MessageBranchNavState = 'viewing';
  const disposers: (() => void)[] = [];

  function send(event: MessageBranchNavEvent) {
    state = messageBranchNavReducer(state, event);
    update();
  }

  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= totalBranches - 1;
  const displayIndex = currentIndex + 1;

  const root = new StackLayout();
  root.className = 'message-branch-nav';
  root.automationText = `Branch ${displayIndex} of ${totalBranches}`;

  const navRow = new FlexboxLayout();
  navRow.className = 'message-branch-nav-row';
  navRow.flexDirection = 'row' as any;
  navRow.alignItems = 'center' as any;

  // Previous button
  const prevBtn = new Button();
  prevBtn.className = 'message-branch-nav-prev';
  prevBtn.text = '\u25C0';
  prevBtn.automationText = 'Previous version';
  prevBtn.isEnabled = !isFirst;
  const prevHandler = () => {
    if (isFirst) return;
    send({ type: 'PREV' });
    onPrevBranch?.();
  };
  prevBtn.on('tap', prevHandler);
  disposers.push(() => prevBtn.off('tap', prevHandler));
  navRow.addChild(prevBtn);

  // Indicator
  const indicator = new Label();
  indicator.className = 'message-branch-nav-indicator';
  indicator.text = `${displayIndex} / ${totalBranches}`;
  navRow.addChild(indicator);

  // Next button
  const nextBtn = new Button();
  nextBtn.className = 'message-branch-nav-next';
  nextBtn.text = '\u25B6';
  nextBtn.automationText = 'Next version';
  nextBtn.isEnabled = !isLast;
  const nextHandler = () => {
    if (isLast) return;
    send({ type: 'NEXT' });
    onNextBranch?.();
  };
  nextBtn.on('tap', nextHandler);
  disposers.push(() => nextBtn.off('tap', nextHandler));
  navRow.addChild(nextBtn);

  // Edit button (viewing state)
  const editBtn = new Button();
  editBtn.className = 'message-branch-nav-edit';
  editBtn.text = '\u270E';
  editBtn.automationText = 'Edit and branch';
  const editHandler = () => {
    send({ type: 'EDIT' });
    onEdit?.();
  };
  editBtn.on('tap', editHandler);
  disposers.push(() => editBtn.off('tap', editHandler));
  navRow.addChild(editBtn);

  // Save button (editing state)
  const saveBtn = new Button();
  saveBtn.className = 'message-branch-nav-save';
  saveBtn.text = '\u2713';
  saveBtn.automationText = 'Save edit';
  saveBtn.visibility = 'collapse' as any;
  const saveHandler = () => {
    send({ type: 'SAVE' });
    onSave?.();
  };
  saveBtn.on('tap', saveHandler);
  disposers.push(() => saveBtn.off('tap', saveHandler));
  navRow.addChild(saveBtn);

  // Cancel button (editing state)
  const cancelBtn = new Button();
  cancelBtn.className = 'message-branch-nav-cancel';
  cancelBtn.text = '\u2715';
  cancelBtn.automationText = 'Cancel edit';
  cancelBtn.visibility = 'collapse' as any;
  const cancelHandler = () => {
    send({ type: 'CANCEL' });
    onCancel?.();
  };
  cancelBtn.on('tap', cancelHandler);
  disposers.push(() => cancelBtn.off('tap', cancelHandler));
  navRow.addChild(cancelBtn);

  root.addChild(navRow);

  function update() {
    if (state === 'viewing') {
      editBtn.visibility = (showEdit ? 'visible' : 'collapse') as any;
      saveBtn.visibility = 'collapse' as any;
      cancelBtn.visibility = 'collapse' as any;
    } else {
      editBtn.visibility = 'collapse' as any;
      saveBtn.visibility = 'visible' as any;
      cancelBtn.visibility = 'visible' as any;
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

export default createMessageBranchNav;

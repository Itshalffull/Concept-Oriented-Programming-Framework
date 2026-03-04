import { uid } from '../shared/uid.js';

export interface BlockDef {
  id: string;
  type: string;
  content?: string;
  children?: BlockDef[];
}

export interface BlockEditorProps {
  blocks: BlockDef[];
  ariaLabel?: string;
  readOnly?: boolean;
  placeholder?: string;
  blockTypes?: string[];
  autoFocus?: boolean;
  spellCheck?: boolean;
  onBlocksChange?: (blocks: BlockDef[]) => void;
  onBlockTypeSelect?: (type: string) => void;
  renderBlock?: (block: BlockDef, index: number) => string | HTMLElement;
  slashMenu?: string | HTMLElement;
  selectionToolbar?: string | HTMLElement;
}

export interface BlockEditorInstance {
  element: HTMLElement;
  update(props: Partial<BlockEditorProps>): void;
  destroy(): void;
}

export function createBlockEditor(options: {
  target: HTMLElement;
  props: BlockEditorProps;
}): BlockEditorInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];
  let focusedIndex = -1;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'block-editor');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'textbox');
  root.setAttribute('aria-multiline', 'true');
  root.id = id;

  const blockListEl = document.createElement('div');
  blockListEl.setAttribute('data-part', 'block-list');
  root.appendChild(blockListEl);

  const slashMenuEl = document.createElement('div');
  slashMenuEl.setAttribute('data-part', 'slash-menu');
  slashMenuEl.setAttribute('aria-label', 'Block type palette');
  slashMenuEl.style.display = 'none';
  root.appendChild(slashMenuEl);

  const selectionToolbarEl = document.createElement('div');
  selectionToolbarEl.setAttribute('data-part', 'selection-toolbar');
  selectionToolbarEl.style.display = 'none';
  root.appendChild(selectionToolbarEl);

  root.addEventListener('keydown', ((e: KeyboardEvent) => {
    if (e.key === '/' && !currentProps.readOnly) {
      slashMenuEl.style.display = '';
    }
    if (e.key === 'Escape') {
      slashMenuEl.style.display = 'none';
    }
  }) as EventListener);
  cleanups.push(() => {});

  function renderBlocks() {
    blockListEl.innerHTML = '';
    currentProps.blocks.forEach((block, i) => {
      const blockEl = document.createElement('div');
      blockEl.setAttribute('data-part', 'block');
      blockEl.setAttribute('tabindex', '0');
      blockEl.setAttribute('data-block-type', block.type);

      const dragHandle = document.createElement('div');
      dragHandle.setAttribute('data-part', 'drag-handle');
      dragHandle.setAttribute('role', 'button');
      dragHandle.setAttribute('aria-label', 'Drag to reorder block');
      dragHandle.setAttribute('draggable', 'true');
      blockEl.appendChild(dragHandle);

      const contentEl = document.createElement('div');
      contentEl.setAttribute('data-part', 'block-content');
      contentEl.setAttribute('contenteditable', currentProps.readOnly ? 'false' : 'true');
      contentEl.setAttribute('spellcheck', currentProps.spellCheck ? 'true' : 'false');
      if (currentProps.renderBlock) {
        const rendered = currentProps.renderBlock(block, i);
        if (typeof rendered === 'string') contentEl.innerHTML = rendered;
        else contentEl.appendChild(rendered);
      } else {
        contentEl.textContent = block.content ?? '';
      }
      blockEl.appendChild(contentEl);

      if (!block.content && currentProps.placeholder) {
        const ph = document.createElement('span');
        ph.setAttribute('data-part', 'placeholder');
        ph.setAttribute('aria-hidden', 'true');
        ph.textContent = currentProps.placeholder;
        blockEl.appendChild(ph);
      }

      contentEl.addEventListener('input', () => {
        const blocks = [...currentProps.blocks];
        blocks[i] = { ...blocks[i], content: contentEl.textContent ?? '' };
        currentProps.onBlocksChange?.(blocks);
      });
      blockEl.addEventListener('focus', () => { focusedIndex = i; });

      blockListEl.appendChild(blockEl);
    });
  }

  function sync() {
    root.setAttribute('data-state', 'idle');
    root.setAttribute('data-readonly', currentProps.readOnly ? 'true' : 'false');
    if (currentProps.ariaLabel) root.setAttribute('aria-label', currentProps.ariaLabel);
    renderBlocks();
  }

  sync();
  target.appendChild(root);
  if (currentProps.autoFocus && blockListEl.firstChild) {
    (blockListEl.firstChild as HTMLElement).focus();
  }

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createBlockEditor;

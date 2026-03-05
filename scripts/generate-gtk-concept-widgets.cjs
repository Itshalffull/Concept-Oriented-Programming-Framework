/**
 * Generate GTK4/GJS concept widget implementations.
 * Each widget uses the factory pattern:
 *   export function createWidgetName(props): { widget: Gtk.Widget; update: (p) => void; dispose: () => void }
 * with a typed state machine (reducer + State/Event types).
 *
 * Reads each React reference to extract state machine and prop types,
 * then generates a full GTK4 implementation.
 */

const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, '..');
const GTK_BASE = path.join(BASE, 'surface/widgets/gtk/components/widgets/concepts');
const REACT_BASE = path.join(BASE, 'surface/widgets/react/components/widgets/concepts');

// All 47 widgets by suite
const WIDGETS = {
  'formal-verification': [
    'CoverageSourceView', 'DagViewer', 'FormulaDisplay', 'ProofSessionTree',
    'StatusGrid', 'TraceStepControls', 'TraceTimelineViewer', 'VerificationStatusBadge'
  ],
  'governance-decision': ['DeliberationThread', 'ProposalCard', 'VoteResultBar'],
  'governance-execution': ['ExecutionPipeline', 'GuardStatusPanel', 'TimelockCountdown'],
  'governance-structure': ['CircleOrgChart', 'DelegationGraph', 'WeightBreakdown'],
  'llm-agent': [
    'AgentTimeline', 'HitlInterrupt', 'MemoryInspector', 'ReasoningBlock',
    'TaskPlanList', 'ToolInvocation', 'TraceTree'
  ],
  'llm-conversation': [
    'ArtifactPanel', 'ChatMessage', 'ConversationSidebar', 'InlineCitation',
    'MessageBranchNav', 'PromptInput', 'StreamText'
  ],
  'llm-core': ['GenerationIndicator'],
  'llm-prompt': ['PromptTemplateEditor'],
  'llm-safety': ['ExecutionMetricsPanel', 'GuardrailConfig', 'ToolCallDetail'],
  'package': ['AuditReport', 'DependencyTree', 'RegistrySearch'],
  'process-automation': ['ExpressionToggleInput'],
  'process-foundation': ['ExecutionOverlay', 'RunListTable', 'VariableInspector'],
  'process-human': ['ApprovalStepper', 'SlaTimer'],
  'process-llm': ['EvalResultsTable', 'PromptEditor']
};

function toKebab(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function toCamel(name) {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * Extract the state machine (type defs + reducer) from a React source file.
 * Returns everything up to the first React import or component definition.
 */
function extractStateMachine(reactSource) {
  const lines = reactSource.split('\n');
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Stop at React imports, any import statement, component definition, or non-state-machine content
    if (line.match(/^import\s/)) break;
    if (line.match(/const \w+ = forwardRef/)) break;
    // Stop at standalone type/interface definitions that are NOT state/event types
    if (line.match(/^export\s+(type|interface)\s+/) &&
        !line.includes('State ') && !line.includes('State=') &&
        !line.includes('Event ') && !line.includes('Event=') &&
        !line.includes('MachineContext')) {
      // Check if this is part of the state machine block
      if (!line.includes('Reducer') && !line.includes('reducer')) {
        break;
      }
    }
    // Stop at helper constants / functions that aren't part of state machine
    if (line.match(/^(const|function)\s/) &&
        !line.includes('Reducer') && !line.includes('reducer')) {
      break;
    }
    // Stop at JSDoc/comment blocks that introduce non-state-machine sections
    if (line.match(/^\/\*\s*-+/) && result.length > 10 && !line.includes('State') && !line.includes('state')) {
      // Only break if we've already collected the reducer
      const hasReducer = result.some(l => l.includes('Reducer') || l.includes('reducer'));
      if (hasReducer) break;
    }

    result.push(line);
  }

  // Clean up: remove trailing empty lines and any React-specific content
  let cleaned = result.join('\n').trim();
  // Remove any stray React import lines that slipped through
  cleaned = cleaned.replace(/^import\s+{[\s\S]*?}\s+from\s+'react';?\s*$/gm, '');
  // Remove HTMLAttributes, ReactNode references
  cleaned = cleaned.replace(/,?\s*type\s+HTMLAttributes[\s\S]*?$/gm, '');
  cleaned = cleaned.replace(/,?\s*type\s+ReactNode[\s\S]*?$/gm, '');

  return cleaned.trim();
}

/**
 * Extract public types (interfaces, type aliases) that are NOT the state/event/reducer.
 */
function extractPublicTypes(reactSource, widgetName) {
  const lines = reactSource.split('\n');
  const types = [];
  let collecting = false;
  let braceDepth = 0;
  let currentBlock = [];
  const stateType = `${widgetName}State`;
  const eventType = `${widgetName}Event`;
  const reducerName = `${toCamel(widgetName)}Reducer`;

  for (const line of lines) {
    // Skip React imports
    if (line.includes("from 'react'")) continue;
    if (line.match(/^import\s+{/) && line.includes('react')) continue;

    // Start collecting on export type/interface that's not state/event
    if (!collecting) {
      if (line.match(/^export\s+(type|interface)\s+/) &&
          !line.includes(stateType) && !line.includes(eventType) &&
          !line.includes('MachineContext') &&
          !line.includes('extends Omit<HTML') &&
          !line.includes('extends HTMLAttributes')) {
        collecting = true;
        currentBlock = [line];
        braceDepth = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
        if (braceDepth <= 0 && line.includes(';')) {
          types.push(currentBlock.join('\n'));
          collecting = false;
          currentBlock = [];
        }
        continue;
      }
      // Also capture standalone interfaces that widgets use
      if (line.match(/^export\s+interface\s+/) &&
          !line.includes('Props') &&
          !line.includes(stateType) && !line.includes(eventType)) {
        collecting = true;
        currentBlock = [line];
        braceDepth = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
        continue;
      }
    } else {
      currentBlock.push(line);
      braceDepth += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      if (braceDepth <= 0) {
        types.push(currentBlock.join('\n'));
        collecting = false;
        currentBlock = [];
      }
    }
  }

  return types.join('\n\n');
}

/**
 * Extract the Props interface from React source, converting to GTK-compatible format.
 */
function extractPropsInterface(reactSource, widgetName) {
  const lines = reactSource.split('\n');
  const propsName = `${widgetName}Props`;
  let collecting = false;
  let braceDepth = 0;
  const block = [];

  for (const line of lines) {
    if (!collecting) {
      if (line.includes(`interface ${propsName}`)) {
        collecting = true;
        // Replace extends HTMLAttributes<...> with simple interface
        const cleanLine = line
          .replace(/extends\s+Omit<HTMLAttributes<[^>]+>,\s*'[^']*'>\s*/, '')
          .replace(/extends\s+Omit<HTMLAttributes<[^>]+>,\s*[^{]+/, '')
          .replace(/extends\s+HTMLAttributes<[^>]+>\s*/, '');
        block.push(cleanLine);
        braceDepth = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
        continue;
      }
    } else {
      // Skip ReactNode, HTML-specific stuff
      if (line.includes('ReactNode') || line.includes('CSSProperties')) {
        block.push(line.replace(/ReactNode/g, 'unknown').replace(/CSSProperties/g, 'Record<string, string>'));
      } else {
        block.push(line);
      }
      braceDepth += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      if (braceDepth <= 0) {
        break;
      }
    }
  }

  if (block.length === 0) {
    return `export interface ${propsName} { [key: string]: unknown; }`;
  }

  return block.join('\n');
}

/**
 * Extract helper constants and functions from React source.
 */
function extractHelpers(reactSource, widgetName) {
  const lines = reactSource.split('\n');
  const helpers = [];
  let inHelper = false;
  let braceDepth = 0;
  let currentBlock = [];
  const reducerName = `${toCamel(widgetName)}Reducer`;

  for (const line of lines) {
    // Skip React imports and component definition
    if (line.includes("from 'react'")) continue;
    if (line.match(/^import\s/)) continue;
    if (line.match(/const \w+ = forwardRef/)) break;
    if (line.match(/export function \w+Reducer/)) continue;

    // Capture const declarations (maps, arrays)
    if (!inHelper && line.match(/^(const|function|type)\s/) &&
        !line.includes('State =') && !line.includes('Event =') &&
        !line.includes(reducerName) && !line.includes('export type') &&
        !line.includes('export interface')) {
      inHelper = true;
      currentBlock = [line];
      braceDepth = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      if (braceDepth <= 0 && (line.endsWith(';') || line.endsWith(','))) {
        helpers.push(currentBlock.join('\n'));
        inHelper = false;
        currentBlock = [];
      }
      continue;
    }

    if (inHelper) {
      currentBlock.push(line);
      braceDepth += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      if (braceDepth <= 0) {
        helpers.push(currentBlock.join('\n'));
        inHelper = false;
        currentBlock = [];
      }
    }
  }

  return helpers.join('\n\n');
}

/**
 * Generate GTK4 widget implementation from React reference.
 */
function generateGtkWidget(suite, widgetName) {
  const reactFile = path.join(REACT_BASE, suite, `${widgetName}.tsx`);
  if (!fs.existsSync(reactFile)) {
    console.warn(`React reference not found: ${reactFile}`);
    return null;
  }

  const reactSource = fs.readFileSync(reactFile, 'utf-8');
  const kebabName = toKebab(widgetName);
  const camelName = toCamel(widgetName);
  const stateMachine = extractStateMachine(reactSource);

  // Detect state machine patterns
  const stateTypeMatch = reactSource.match(new RegExp(`export type ${widgetName}State\\s*=\\s*([^;]+);`));
  const initialState = stateTypeMatch
    ? stateTypeMatch[1].split('|').map(s => s.trim().replace(/'/g, ''))[0]
    : 'idle';

  // Check if it has a context-based reducer vs simple state reducer
  const hasContext = reactSource.includes('MachineContext');

  // Clean up state machine - remove any React-specific content
  let cleanStateMachine = stateMachine;
  // Remove any lines importing from react
  cleanStateMachine = cleanStateMachine.replace(/^import[\s\S]*?from\s+'react';\s*$/gm, '');
  // Remove HTML/React types from event union members
  // Remove references to CoverageFilter etc that might reference React types - keep them as they're domain types
  cleanStateMachine = cleanStateMachine.trim();

  // Build the GTK implementation
  const output = `/* ---------------------------------------------------------------------------
 * ${widgetName} -- GTK4/GJS widget
 * Implements the ${kebabName} concept widget for GTK4.
 * Generated from React reference implementation.
 * ------------------------------------------------------------------------- */

import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/* ---------------------------------------------------------------------------
 * State Machine
 * ------------------------------------------------------------------------- */

${cleanStateMachine}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ${widgetName}Props {
  [key: string]: unknown;
}

/* ---------------------------------------------------------------------------
 * Factory
 * ------------------------------------------------------------------------- */

export function create${widgetName}(props: ${widgetName}Props): {
  widget: Gtk.Widget;
  update: (nextProps: Partial<${widgetName}Props>) => void;
  dispose: () => void;
} {
  let state: ${widgetName}State = '${initialState}';
  let currentProps = { ...props };
  const handlerIds: number[] = [];
  const timeoutIds: number[] = [];

  function send(event: ${widgetName}Event): void {
    ${hasContext
      ? `state = ${camelName}Reducer({ state, ...({} as any) }, event).state;`
      : `state = ${camelName}Reducer(state, event);`
    }
    render();
  }

  /* --- Root container --- */
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });
  root.add_css_class('${kebabName}');
  root.set_accessible_role(Gtk.AccessibleRole.GROUP);

  /* --- Header --- */
  const headerBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 8,
  });
  const headerLabel = new Gtk.Label({ label: '${widgetName}' });
  headerLabel.add_css_class('${kebabName}-header');
  headerBox.append(headerLabel);

  const stateLabel = new Gtk.Label({ label: '' });
  stateLabel.add_css_class('${kebabName}-state');
  headerBox.append(stateLabel);
  root.append(headerBox);

  /* --- Content area --- */
  const contentScroll = new Gtk.ScrolledWindow({
    hscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
    vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
    vexpand: true,
    hexpand: true,
  });
  const contentBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 2,
  });
  contentScroll.set_child(contentBox);
  root.append(contentScroll);

  /* --- Detail panel --- */
  const detailBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  });
  detailBox.add_css_class('${kebabName}-detail');
  root.append(detailBox);

  /* --- Keyboard controller --- */
  const keyCtrl = new Gtk.EventControllerKey();
  const keyHandlerId = keyCtrl.connect('key-pressed', (
    _ctrl: Gtk.EventControllerKey,
    keyval: number,
    _keycode: number,
    _modifiers: number
  ): boolean => {
${generateKeyboardHandlerBody(widgetName, reactSource)}
    return false;
  });
  root.add_controller(keyCtrl);

  /* --- Render function --- */
  function render(): void {
    stateLabel.set_label(\`[\${state}]\`);
    root.set_tooltip_text(\`${widgetName}: \${state}\`);

    // Update CSS state classes
    for (const cls of ['idle', 'selected', 'active', 'hovered', 'playing', 'paused', 'running', 'error']) {
      root.remove_css_class(\`state-\${cls}\`);
    }
    root.add_css_class(\`state-\${state}\`);

    // Clear content
    let child = contentBox.get_first_child();
    while (child) {
      const next = child.get_next_sibling();
      contentBox.remove(child);
      child = next;
    }

    // Clear detail
    let detailChild = detailBox.get_first_child();
    while (detailChild) {
      const next = detailChild.get_next_sibling();
      detailBox.remove(detailChild);
      detailChild = next;
    }

${generateRenderBody(widgetName, suite, reactSource)}
  }

  /* --- Initial render --- */
  render();

  /* --- Public API --- */
  return {
    widget: root,
    update(nextProps: Partial<${widgetName}Props>): void {
      Object.assign(currentProps, nextProps);
      render();
    },
    dispose(): void {
      for (const id of timeoutIds) {
        GLib.source_remove(id);
      }
      timeoutIds.length = 0;
    },
  };
}

export default create${widgetName};
`;

  return output;
}

/**
 * Generate keyboard handler body based on React reference.
 */
function generateKeyboardHandlerBody(widgetName, reactSource) {
  // Detect common key patterns from React source
  const hasArrowNav = reactSource.includes("'ArrowDown'") || reactSource.includes("'ArrowUp'");
  const hasEnter = reactSource.includes("'Enter'");
  const hasEscape = reactSource.includes("'Escape'");
  const hasSpace = reactSource.includes("' '") && reactSource.includes('key ===');
  const hasHome = reactSource.includes("'Home'");
  const hasEnd = reactSource.includes("'End'");

  let body = '    const { Gdk } = imports.gi || {};\n';

  if (hasArrowNav) {
    body += `    if (keyval === 0xff54) { /* Down */
      return true;
    }
    if (keyval === 0xff52) { /* Up */
      return true;
    }
`;
  }
  if (reactSource.includes("'ArrowRight'")) {
    body += `    if (keyval === 0xff53) { /* Right */
      return true;
    }
`;
  }
  if (reactSource.includes("'ArrowLeft'")) {
    body += `    if (keyval === 0xff51) { /* Left */
      return true;
    }
`;
  }
  if (hasEnter) {
    body += `    if (keyval === 0xff0d) { /* Enter */
      return true;
    }
`;
  }
  if (hasEscape) {
    body += `    if (keyval === 0xff1b) { /* Escape */
      return true;
    }
`;
  }
  if (hasSpace) {
    body += `    if (keyval === 0x20) { /* Space */
      return true;
    }
`;
  }
  if (hasHome) {
    body += `    if (keyval === 0xff50) { /* Home */
      return true;
    }
`;
  }
  if (hasEnd) {
    body += `    if (keyval === 0xff57) { /* End */
      return true;
    }
`;
  }

  return body;
}

/**
 * Generate render body for the widget based on React reference.
 */
function generateRenderBody(widgetName, suite, reactSource) {
  // For each widget, produce a meaningful render body based on what the React component renders.
  // This creates a simplified but functional GTK version.

  const kebabName = toKebab(widgetName);

  // Generic content render based on widget patterns
  let body = `    // Render content based on props
    const p = currentProps as Record<string, any>;\n`;

  // Detect primary data prop
  if (reactSource.includes('lines:') || reactSource.includes('props.lines')) {
    body += `
    // Source lines
    const lines = (p.lines || []) as Array<{ number: number; text: string; coverage?: string }>;
    for (const line of lines) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const numLabel = new Gtk.Label({ label: String(line.number) });
      numLabel.add_css_class('line-number');
      row.append(numLabel);
      const textLabel = new Gtk.Label({ label: line.text || '' });
      textLabel.set_hexpand(true);
      textLabel.set_xalign(0);
      row.append(textLabel);
      if (line.coverage) {
        row.add_css_class(\`coverage-\${line.coverage}\`);
      }
      contentBox.append(row);
    }`;
  } else if (reactSource.includes('nodes:') && reactSource.includes('edges:')) {
    body += `
    // Graph nodes
    const nodes = (p.nodes || []) as Array<{ id: string; label: string; status?: string }>;
    const edges = (p.edges || []) as Array<{ from: string; to: string; label?: string }>;
    for (const node of nodes) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const nodeLabel = new Gtk.Label({ label: node.label });
      nodeLabel.set_hexpand(true);
      nodeLabel.set_xalign(0);
      row.append(nodeLabel);
      if (node.status) {
        const statusLabel = new Gtk.Label({ label: node.status });
        statusLabel.add_css_class(\`status-\${node.status}\`);
        row.append(statusLabel);
      }
      const clickCtrl = new Gtk.GestureClick();
      clickCtrl.connect('released', () => {
        send({ type: 'SELECT_NODE' || 'SELECT' } as any);
      });
      row.add_controller(clickCtrl);
      contentBox.append(row);
    }
    // Edges
    for (const edge of edges) {
      const edgeLabel = new Gtk.Label({ label: \`\${edge.from} \\u2192 \${edge.to}\${edge.label ? ' (' + edge.label + ')' : ''}\` });
      edgeLabel.add_css_class('edge');
      edgeLabel.set_xalign(0);
      contentBox.append(edgeLabel);
    }`;
  } else if (reactSource.includes('items:') || reactSource.includes('entries:')) {
    const itemProp = reactSource.includes('entries:') ? 'entries' : 'items';
    body += `
    // List items
    const items = (p.${itemProp} || []) as Array<{ id?: string; name?: string; label?: string; status?: string; author?: string; content?: string }>;
    for (const item of items) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const label = new Gtk.Label({ label: item.name || item.label || item.content || item.id || '' });
      label.set_hexpand(true);
      label.set_xalign(0);
      label.set_wrap(true);
      row.append(label);
      if (item.status) {
        const statusLabel = new Gtk.Label({ label: item.status });
        statusLabel.add_css_class(\`status-\${item.status}\`);
        row.append(statusLabel);
      }
      if (item.author) {
        const authorLabel = new Gtk.Label({ label: item.author });
        authorLabel.add_css_class('author');
        row.append(authorLabel);
      }
      const clickCtrl = new Gtk.GestureClick();
      clickCtrl.connect('released', () => {
        send({ type: 'SELECT_ENTRY' || 'SELECT' || 'CLICK_CELL' } as any);
      });
      row.add_controller(clickCtrl);
      contentBox.append(row);
    }`;
  } else if (reactSource.includes('goals:')) {
    body += `
    // Proof goals tree
    const goals = (p.goals || []) as Array<{ id: string; label: string; status: string; children?: any[] }>;
    function renderGoals(goalList: any[], depth: number) {
      for (const goal of goalList) {
        const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
        row.set_margin_start(depth * 20);
        const statusLabel = new Gtk.Label({ label: goal.status === 'proved' ? '\\u2713' : goal.status === 'failed' ? '\\u2717' : '\\u25CB' });
        row.append(statusLabel);
        const goalLabel = new Gtk.Label({ label: goal.label });
        goalLabel.set_hexpand(true);
        goalLabel.set_xalign(0);
        row.append(goalLabel);
        const clickCtrl = new Gtk.GestureClick();
        clickCtrl.connect('released', () => {
          send({ type: 'SELECT' } as any);
        });
        row.add_controller(clickCtrl);
        contentBox.append(row);
        if (goal.children) renderGoals(goal.children, depth + 1);
      }
    }
    renderGoals(goals, 0);`;
  } else if (reactSource.includes('segments:')) {
    body += `
    // Vote/progress segments
    const segments = (p.segments || []) as Array<{ label: string; count: number; color?: string }>;
    const total = segments.reduce((s: number, seg: any) => s + (seg.count || 0), 0) || 1;
    const barBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 0 });
    barBox.add_css_class('segment-bar');
    for (const seg of segments) {
      const pct = Math.round((seg.count / total) * 100);
      const segLabel = new Gtk.Label({ label: \`\${seg.label}: \${pct}%\` });
      segLabel.set_hexpand(pct > 0);
      segLabel.add_css_class('segment');
      segLabel.set_tooltip_text(\`\${seg.label}: \${seg.count} (\${pct}%)\`);
      barBox.append(segLabel);
    }
    contentBox.append(barBox);
    // Legend
    for (const seg of segments) {
      const legendRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const dot = new Gtk.Label({ label: '\\u25CF' });
      legendRow.append(dot);
      const legendLabel = new Gtk.Label({ label: \`\${seg.label}: \${seg.count}\` });
      legendRow.append(legendLabel);
      contentBox.append(legendRow);
    }`;
  } else if (reactSource.includes('stages:')) {
    body += `
    // Pipeline stages
    const stages = (p.stages || []) as Array<{ id: string; name: string; status: string; description?: string }>;
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const icon = new Gtk.Label({
        label: stage.status === 'complete' ? '\\u2713' : stage.status === 'failed' ? '\\u2717' : stage.status === 'active' ? '\\u25CF' : '\\u25CB'
      });
      row.append(icon);
      const nameLabel = new Gtk.Label({ label: stage.name });
      nameLabel.set_hexpand(true);
      nameLabel.set_xalign(0);
      row.append(nameLabel);
      const statusLabel = new Gtk.Label({ label: stage.status });
      statusLabel.add_css_class(\`stage-\${stage.status}\`);
      row.append(statusLabel);
      const clickCtrl = new Gtk.GestureClick();
      clickCtrl.connect('released', () => {
        send({ type: 'SELECT_STAGE', stageId: stage.id } as any);
      });
      row.add_controller(clickCtrl);
      contentBox.append(row);
      if (i < stages.length - 1) {
        const connector = new Gtk.Label({ label: '\\u2193' });
        connector.add_css_class('connector');
        contentBox.append(connector);
      }
    }`;
  } else if (reactSource.includes('guards:')) {
    body += `
    // Guard list
    const guards = (p.guards || []) as Array<{ id?: string; name: string; description: string; status: string }>;
    for (const guard of guards) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const icon = new Gtk.Label({
        label: guard.status === 'passing' ? '\\u2713' : guard.status === 'failing' ? '\\u2717' : '\\u23F3'
      });
      row.append(icon);
      const nameLabel = new Gtk.Label({ label: guard.name });
      nameLabel.set_hexpand(true);
      nameLabel.set_xalign(0);
      row.append(nameLabel);
      const statusLabel = new Gtk.Label({ label: guard.status });
      row.append(statusLabel);
      const clickCtrl = new Gtk.GestureClick();
      clickCtrl.connect('released', () => {
        send({ type: 'SELECT_GUARD' } as any);
      });
      row.add_controller(clickCtrl);
      contentBox.append(row);
    }`;
  } else if (reactSource.includes('circles:')) {
    body += `
    // Circle hierarchy
    const circles = (p.circles || []) as Array<{ id: string; name: string; purpose: string; members: any[] }>;
    for (const circle of circles) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const nameLabel = new Gtk.Label({ label: circle.name });
      nameLabel.set_hexpand(true);
      nameLabel.set_xalign(0);
      row.append(nameLabel);
      const memberCount = new Gtk.Label({ label: \`\${(circle.members || []).length} members\` });
      row.append(memberCount);
      const clickCtrl = new Gtk.GestureClick();
      clickCtrl.connect('released', () => {
        send({ type: 'SELECT_CIRCLE', id: circle.id } as any);
      });
      row.add_controller(clickCtrl);
      contentBox.append(row);
    }`;
  } else if (reactSource.includes('sources:')) {
    body += `
    // Weight sources
    const sources = (p.sources || []) as Array<{ label: string; weight: number; type: string }>;
    const totalWeight = (p.totalWeight || 0) as number;
    const totalLabel = new Gtk.Label({ label: \`Total: \${totalWeight}\` });
    totalLabel.add_css_class('total-weight');
    contentBox.append(totalLabel);
    for (const source of sources) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const nameLabel = new Gtk.Label({ label: source.label });
      nameLabel.set_hexpand(true);
      nameLabel.set_xalign(0);
      row.append(nameLabel);
      const pct = totalWeight > 0 ? Math.round((source.weight / totalWeight) * 100) : 0;
      const weightLabel = new Gtk.Label({ label: \`\${source.weight} (\${pct}%)\` });
      row.append(weightLabel);
      contentBox.append(row);
    }`;
  } else if (reactSource.includes('steps:') && reactSource.includes('TraceStep')) {
    body += `
    // Trace steps
    const steps = (p.steps || []) as Array<{ index: number; label: string; state: Record<string, string>; isError?: boolean }>;
    for (const step of steps) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const idxLabel = new Gtk.Label({ label: String(step.index) });
      row.append(idxLabel);
      const stepLabel = new Gtk.Label({ label: step.label });
      stepLabel.set_hexpand(true);
      stepLabel.set_xalign(0);
      row.append(stepLabel);
      if (step.isError) row.add_css_class('error');
      const clickCtrl = new Gtk.GestureClick();
      clickCtrl.connect('released', () => {
        send({ type: 'SELECT_CELL' } as any);
      });
      row.add_controller(clickCtrl);
      contentBox.append(row);
    }`;
  } else if (reactSource.includes('formula:') || reactSource.includes('formula')) {
    body += `
    // Formula display
    const formula = (p.formula || '') as string;
    const language = (p.language || 'smtlib') as string;
    const langLabel = new Gtk.Label({ label: language.toUpperCase() });
    langLabel.add_css_class('lang-badge');
    contentBox.append(langLabel);
    const codeView = new Gtk.TextView({ editable: false, monospace: true });
    codeView.get_buffer().set_text(formula, -1);
    codeView.set_wrap_mode(Gtk.WrapMode.WORD_CHAR);
    contentBox.append(codeView);
    // Copy button
    const copyBtn = new Gtk.Button({ label: 'Copy' });
    copyBtn.connect('clicked', () => {
      send({ type: 'COPY' } as any);
    });
    contentBox.append(copyBtn);`;
  } else if (reactSource.includes('currentStep') && reactSource.includes('totalSteps')) {
    body += `
    // Trace step controls
    const currentStep = (p.currentStep || 0) as number;
    const totalSteps = (p.totalSteps || 0) as number;
    const controlBar = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });

    const jumpStartBtn = new Gtk.Button({ label: '\\u25C4|' });
    jumpStartBtn.connect('clicked', () => { send({ type: 'JUMP_START' } as any); if (p.onFirst) (p.onFirst as Function)(); });
    controlBar.append(jumpStartBtn);

    const stepBackBtn = new Gtk.Button({ label: '\\u25C4' });
    stepBackBtn.connect('clicked', () => { send({ type: 'STEP_BACK' } as any); if (p.onStepBack) (p.onStepBack as Function)(); });
    controlBar.append(stepBackBtn);

    const playPauseBtn = new Gtk.Button({ label: state === 'playing' ? '\\u23F8' : '\\u25B6' });
    playPauseBtn.connect('clicked', () => {
      if (state === 'playing') { send({ type: 'PAUSE' } as any); if (p.onPause) (p.onPause as Function)(); }
      else { send({ type: 'PLAY' } as any); if (p.onPlay) (p.onPlay as Function)(); }
    });
    controlBar.append(playPauseBtn);

    const stepFwdBtn = new Gtk.Button({ label: '\\u25BA' });
    stepFwdBtn.connect('clicked', () => { send({ type: 'STEP_FWD' } as any); if (p.onStepForward) (p.onStepForward as Function)(); });
    controlBar.append(stepFwdBtn);

    const jumpEndBtn = new Gtk.Button({ label: '|\\u25BA' });
    jumpEndBtn.connect('clicked', () => { send({ type: 'JUMP_END' } as any); if (p.onLast) (p.onLast as Function)(); });
    controlBar.append(jumpEndBtn);

    contentBox.append(controlBar);

    const counterLabel = new Gtk.Label({ label: \`Step \${currentStep + 1} of \${totalSteps}\` });
    contentBox.append(counterLabel);

    const progressBar = new Gtk.ProgressBar();
    progressBar.set_fraction(totalSteps > 0 ? (currentStep + 1) / totalSteps : 0);
    contentBox.append(progressBar);`;
  } else if (reactSource.includes('status') && reactSource.includes('VerificationStatus')) {
    body += `
    // Verification status badge
    const status = (p.status || 'unknown') as string;
    const badgeLabel = (p.label || status) as string;
    const duration = p.duration as number | undefined;
    const solver = p.solver as string | undefined;
    const badge = new Gtk.Label({ label: \`\${status === 'proved' ? '\\u2713' : status === 'refuted' ? '\\u2717' : status === 'running' ? '\\u23F3' : '?'} \${badgeLabel}\` });
    badge.add_css_class(\`verification-\${status}\`);
    badge.set_tooltip_text([solver, duration != null ? \`\${duration}ms\` : null].filter(Boolean).join(' \\u2014 '));
    contentBox.append(badge);`;
  } else if (reactSource.includes('deadline') && reactSource.includes('countdown')) {
    body += `
    // Timelock countdown
    const phase = (p.phase || '') as string;
    const deadline = (p.deadline || '') as string;
    const elapsed = (p.elapsed || 0) as number;
    const total = (p.total || 1) as number;
    const phaseLabel = new Gtk.Label({ label: phase });
    phaseLabel.add_css_class('phase-label');
    contentBox.append(phaseLabel);

    const progress = Math.min(1, Math.max(0, elapsed / total));
    const progressBar = new Gtk.ProgressBar();
    progressBar.set_fraction(progress);
    contentBox.append(progressBar);

    const countdownLabel = new Gtk.Label({ label: deadline });
    contentBox.append(countdownLabel);

    const executeBtn = new Gtk.Button({ label: 'Execute' });
    executeBtn.set_sensitive(state === 'expired');
    executeBtn.connect('clicked', () => {
      send({ type: 'EXECUTE' } as any);
      if (p.onExecute) (p.onExecute as Function)();
    });
    contentBox.append(executeBtn);`;
  } else if (reactSource.includes('tokenCount') || reactSource.includes('GenerationIndicator')) {
    body += `
    // Generation indicator
    const genStatus = (p.status || 'idle') as string;
    const model = (p.model || '') as string;
    const tokenCount = (p.tokenCount || 0) as number;
    const spinner = new Gtk.Spinner();
    spinner.set_spinning(genStatus === 'generating');
    contentBox.append(spinner);
    const statusLabel2 = new Gtk.Label({ label: genStatus === 'generating' ? \`Generating... \${tokenCount} tokens\` : genStatus === 'complete' ? 'Complete' : genStatus === 'error' ? 'Error' : 'Ready' });
    contentBox.append(statusLabel2);
    if (model) {
      const modelLabel = new Gtk.Label({ label: \`Model: \${model}\` });
      contentBox.append(modelLabel);
    }`;
  } else if (reactSource.includes('template') && reactSource.includes('variables')) {
    body += `
    // Template editor
    const template = (p.template || '') as string;
    const textView = new Gtk.TextView({ editable: true, monospace: true });
    textView.get_buffer().set_text(template, -1);
    textView.set_wrap_mode(Gtk.WrapMode.WORD_CHAR);
    textView.set_vexpand(true);
    contentBox.append(textView);`;
  } else if (reactSource.includes('message') || reactSource.includes('ChatMessage')) {
    body += `
    // Chat message
    const role = (p.role || 'user') as string;
    const content = (p.content || '') as string;
    const roleLabel = new Gtk.Label({ label: role });
    roleLabel.add_css_class(\`role-\${role}\`);
    contentBox.append(roleLabel);
    const contentLabel = new Gtk.Label({ label: content });
    contentLabel.set_wrap(true);
    contentLabel.set_xalign(0);
    contentBox.append(contentLabel);`;
  } else if (reactSource.includes('expression') && reactSource.includes('toggle')) {
    body += `
    // Expression toggle
    const expression = (p.expression || '') as string;
    const entry = new Gtk.Entry();
    entry.set_text(expression);
    entry.set_hexpand(true);
    contentBox.append(entry);
    const toggleBtn = new Gtk.ToggleButton({ label: 'Toggle' });
    toggleBtn.connect('toggled', () => {
      send({ type: toggleBtn.get_active() ? 'ENABLE' : 'DISABLE' } as any);
    });
    contentBox.append(toggleBtn);`;
  } else if (reactSource.includes('runs') || reactSource.includes('RunListTable')) {
    body += `
    // Run list
    const runs = (p.runs || []) as Array<{ id: string; name?: string; status: string; startedAt?: string }>;
    for (const run of runs) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const nameLabel = new Gtk.Label({ label: run.name || run.id });
      nameLabel.set_hexpand(true);
      nameLabel.set_xalign(0);
      row.append(nameLabel);
      const statusLabel3 = new Gtk.Label({ label: run.status });
      statusLabel3.add_css_class(\`run-\${run.status}\`);
      row.append(statusLabel3);
      const clickCtrl = new Gtk.GestureClick();
      clickCtrl.connect('released', () => {
        send({ type: 'SELECT_RUN' || 'SELECT' } as any);
      });
      row.add_controller(clickCtrl);
      contentBox.append(row);
    }`;
  } else if (reactSource.includes('variables') && reactSource.includes('VariableInspector')) {
    body += `
    // Variable inspector
    const variables = (p.variables || []) as Array<{ name: string; value: string; type?: string }>;
    for (const v of variables) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const nameLabel = new Gtk.Label({ label: v.name });
      nameLabel.add_css_class('var-name');
      row.append(nameLabel);
      const valLabel = new Gtk.Label({ label: v.value });
      valLabel.set_hexpand(true);
      valLabel.set_xalign(0);
      row.append(valLabel);
      if (v.type) {
        const typeLabel = new Gtk.Label({ label: v.type });
        typeLabel.add_css_class('var-type');
        row.append(typeLabel);
      }
      contentBox.append(row);
    }`;
  } else if (reactSource.includes('conversations') || reactSource.includes('ConversationSidebar')) {
    body += `
    // Conversation sidebar
    const conversations = (p.conversations || []) as Array<{ id: string; title: string; lastMessage?: string; updatedAt?: string }>;
    for (const conv of conversations) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 });
      const titleLabel = new Gtk.Label({ label: conv.title });
      titleLabel.set_xalign(0);
      row.append(titleLabel);
      if (conv.lastMessage) {
        const msgLabel = new Gtk.Label({ label: conv.lastMessage });
        msgLabel.set_xalign(0);
        msgLabel.set_ellipsize(3); // PANGO_ELLIPSIZE_END
        msgLabel.add_css_class('dim');
        row.append(msgLabel);
      }
      const clickCtrl = new Gtk.GestureClick();
      clickCtrl.connect('released', () => {
        send({ type: 'SELECT' } as any);
      });
      row.add_controller(clickCtrl);
      contentBox.append(row);
    }`;
  } else if (reactSource.includes('prompt') && (reactSource.includes('PromptInput') || reactSource.includes('PromptEditor'))) {
    body += `
    // Prompt input/editor
    const placeholder = (p.placeholder || 'Enter prompt...') as string;
    const textView = new Gtk.TextView({ editable: true });
    textView.set_wrap_mode(Gtk.WrapMode.WORD_CHAR);
    textView.set_vexpand(true);
    textView.get_buffer().set_text(p.value as string || '', -1);
    contentBox.append(textView);
    const sendBtn = new Gtk.Button({ label: 'Send' });
    sendBtn.connect('clicked', () => {
      send({ type: 'SUBMIT' || 'SEND' } as any);
    });
    contentBox.append(sendBtn);`;
  } else if (reactSource.includes('text') && reactSource.includes('StreamText')) {
    body += `
    // Stream text
    const text = (p.text || '') as string;
    const streaming = (p.streaming || false) as boolean;
    const textLabel = new Gtk.Label({ label: text });
    textLabel.set_wrap(true);
    textLabel.set_xalign(0);
    textLabel.set_selectable(true);
    contentBox.append(textLabel);
    if (streaming) {
      const spinner = new Gtk.Spinner();
      spinner.set_spinning(true);
      contentBox.append(spinner);
    }`;
  } else if (reactSource.includes('InlineCitation')) {
    body += `
    // Inline citation
    const source = (p.source || '') as string;
    const text2 = (p.text || '') as string;
    const citLabel = new Gtk.Label({ label: text2 });
    citLabel.set_wrap(true);
    citLabel.set_xalign(0);
    contentBox.append(citLabel);
    if (source) {
      const srcLabel = new Gtk.Label({ label: \`Source: \${source}\` });
      srcLabel.add_css_class('citation-source');
      contentBox.append(srcLabel);
    }`;
  } else if (reactSource.includes('branches') || reactSource.includes('MessageBranchNav')) {
    body += `
    // Branch navigation
    const currentBranch = (p.currentBranch || 0) as number;
    const totalBranches = (p.totalBranches || 1) as number;
    const navBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
    const prevBtn = new Gtk.Button({ label: '\\u25C4' });
    prevBtn.set_sensitive(currentBranch > 0);
    prevBtn.connect('clicked', () => { send({ type: 'PREV_BRANCH' } as any); });
    navBox.append(prevBtn);
    const branchLabel = new Gtk.Label({ label: \`\${currentBranch + 1} / \${totalBranches}\` });
    navBox.append(branchLabel);
    const nextBtn = new Gtk.Button({ label: '\\u25BA' });
    nextBtn.set_sensitive(currentBranch < totalBranches - 1);
    nextBtn.connect('clicked', () => { send({ type: 'NEXT_BRANCH' } as any); });
    navBox.append(nextBtn);
    contentBox.append(navBox);`;
  } else if (reactSource.includes('ArtifactPanel')) {
    body += `
    // Artifact panel
    const artifactType = (p.type || 'code') as string;
    const title2 = (p.title || 'Artifact') as string;
    const content2 = (p.content || '') as string;
    const titleLabel = new Gtk.Label({ label: \`\${title2} (\${artifactType})\` });
    contentBox.append(titleLabel);
    const textView = new Gtk.TextView({ editable: false, monospace: artifactType === 'code' });
    textView.get_buffer().set_text(content2, -1);
    textView.set_wrap_mode(Gtk.WrapMode.WORD_CHAR);
    textView.set_vexpand(true);
    contentBox.append(textView);
    const actionBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
    const copyBtn = new Gtk.Button({ label: 'Copy' });
    copyBtn.connect('clicked', () => { send({ type: 'COPY' } as any); });
    actionBox.append(copyBtn);
    const closeBtn = new Gtk.Button({ label: 'Close' });
    closeBtn.connect('clicked', () => { send({ type: 'CLOSE' } as any); });
    actionBox.append(closeBtn);
    contentBox.append(actionBox);`;
  } else if (reactSource.includes('memory') || reactSource.includes('MemoryInspector')) {
    body += `
    // Memory inspector
    const memories = (p.memories || p.entries || []) as Array<{ id?: string; key?: string; value?: string; type?: string; content?: string }>;
    for (const mem of memories) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const keyLabel = new Gtk.Label({ label: mem.key || mem.id || '' });
      keyLabel.add_css_class('mem-key');
      row.append(keyLabel);
      const valLabel = new Gtk.Label({ label: mem.value || mem.content || '' });
      valLabel.set_hexpand(true);
      valLabel.set_xalign(0);
      valLabel.set_wrap(true);
      row.append(valLabel);
      if (mem.type) {
        const typeLabel = new Gtk.Label({ label: mem.type });
        typeLabel.add_css_class('mem-type');
        row.append(typeLabel);
      }
      contentBox.append(row);
    }`;
  } else if (reactSource.includes('reasoning') || reactSource.includes('ReasoningBlock')) {
    body += `
    // Reasoning block
    const content2 = (p.content || p.text || '') as string;
    const collapsed = (p.collapsed || false) as boolean;
    const headerBtn = new Gtk.Button({ label: collapsed ? '\\u25B6 Reasoning' : '\\u25BC Reasoning' });
    headerBtn.connect('clicked', () => {
      send({ type: collapsed ? 'EXPAND' : 'COLLAPSE' } as any);
    });
    contentBox.append(headerBtn);
    if (!collapsed) {
      const contentLabel = new Gtk.Label({ label: content2 });
      contentLabel.set_wrap(true);
      contentLabel.set_xalign(0);
      contentBox.append(contentLabel);
    }`;
  } else if (reactSource.includes('tasks') || reactSource.includes('TaskPlanList')) {
    body += `
    // Task plan list
    const tasks = (p.tasks || p.steps || []) as Array<{ id?: string; name?: string; label?: string; status?: string; description?: string }>;
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const numLabel = new Gtk.Label({ label: \`\${i + 1}.\` });
      row.append(numLabel);
      const taskLabel = new Gtk.Label({ label: task.name || task.label || '' });
      taskLabel.set_hexpand(true);
      taskLabel.set_xalign(0);
      row.append(taskLabel);
      if (task.status) {
        const statusLabel4 = new Gtk.Label({ label: task.status });
        statusLabel4.add_css_class(\`task-\${task.status}\`);
        row.append(statusLabel4);
      }
      contentBox.append(row);
    }`;
  } else if (reactSource.includes('tool') && (reactSource.includes('ToolInvocation') || reactSource.includes('ToolCallDetail'))) {
    body += `
    // Tool invocation/detail
    const toolName = (p.name || p.toolName || '') as string;
    const input2 = (p.input || p.args || '{}') as string;
    const output2 = (p.output || p.result || '') as string;
    const toolStatus = (p.status || 'pending') as string;
    const nameLabel = new Gtk.Label({ label: \`Tool: \${toolName}\` });
    nameLabel.set_xalign(0);
    contentBox.append(nameLabel);
    const statusLabel5 = new Gtk.Label({ label: \`Status: \${toolStatus}\` });
    statusLabel5.add_css_class(\`tool-\${toolStatus}\`);
    contentBox.append(statusLabel5);
    if (input2) {
      const inputLabel = new Gtk.Label({ label: 'Input:' });
      contentBox.append(inputLabel);
      const inputView = new Gtk.TextView({ editable: false, monospace: true });
      inputView.get_buffer().set_text(typeof input2 === 'string' ? input2 : JSON.stringify(input2, null, 2), -1);
      contentBox.append(inputView);
    }
    if (output2) {
      const outputLabel = new Gtk.Label({ label: 'Output:' });
      contentBox.append(outputLabel);
      const outputView = new Gtk.TextView({ editable: false, monospace: true });
      outputView.get_buffer().set_text(typeof output2 === 'string' ? output2 : JSON.stringify(output2, null, 2), -1);
      contentBox.append(outputView);
    }`;
  } else if (reactSource.includes('TraceTree')) {
    body += `
    // Trace tree
    const spans = (p.spans || p.nodes || []) as Array<{ id: string; name?: string; label?: string; children?: any[]; duration?: number; status?: string }>;
    function renderSpans(spanList: any[], depth: number) {
      for (const span of spanList) {
        const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
        row.set_margin_start(depth * 16);
        const spanLabel = new Gtk.Label({ label: span.name || span.label || span.id });
        spanLabel.set_hexpand(true);
        spanLabel.set_xalign(0);
        row.append(spanLabel);
        if (span.duration != null) {
          const durLabel = new Gtk.Label({ label: \`\${span.duration}ms\` });
          durLabel.add_css_class('duration');
          row.append(durLabel);
        }
        if (span.status) {
          const statusLabel6 = new Gtk.Label({ label: span.status });
          row.append(statusLabel6);
        }
        contentBox.append(row);
        if (span.children) renderSpans(span.children, depth + 1);
      }
    }
    renderSpans(spans, 0);`;
  } else if (reactSource.includes('HitlInterrupt')) {
    body += `
    // HITL Interrupt
    const question = (p.question || p.message || '') as string;
    const options2 = (p.options || []) as Array<{ label: string; value: string }>;
    const questionLabel = new Gtk.Label({ label: question });
    questionLabel.set_wrap(true);
    questionLabel.set_xalign(0);
    contentBox.append(questionLabel);
    for (const opt of options2) {
      const optBtn = new Gtk.Button({ label: opt.label });
      optBtn.connect('clicked', () => {
        send({ type: 'RESPOND' } as any);
        if (p.onRespond) (p.onRespond as Function)(opt.value);
      });
      contentBox.append(optBtn);
    }`;
  } else if (reactSource.includes('dependencies') || reactSource.includes('DependencyTree')) {
    body += `
    // Dependency tree
    const deps = (p.dependencies || p.nodes || []) as Array<{ name: string; version?: string; children?: any[] }>;
    function renderDeps(depList: any[], depth: number) {
      for (const dep of depList) {
        const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
        row.set_margin_start(depth * 16);
        const nameLabel = new Gtk.Label({ label: dep.name + (dep.version ? '@' + dep.version : '') });
        nameLabel.set_xalign(0);
        row.append(nameLabel);
        contentBox.append(row);
        if (dep.children) renderDeps(dep.children, depth + 1);
      }
    }
    renderDeps(deps, 0);`;
  } else if (reactSource.includes('RegistrySearch')) {
    body += `
    // Registry search
    const results = (p.results || []) as Array<{ name: string; version?: string; description?: string }>;
    const searchEntry = new Gtk.SearchEntry();
    searchEntry.set_placeholder_text('Search packages...');
    searchEntry.connect('search-changed', () => {
      send({ type: 'SEARCH' } as any);
    });
    contentBox.append(searchEntry);
    for (const result of results) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2 });
      const nameLabel = new Gtk.Label({ label: \`\${result.name}\${result.version ? '@' + result.version : ''}\` });
      nameLabel.set_xalign(0);
      row.append(nameLabel);
      if (result.description) {
        const descLabel = new Gtk.Label({ label: result.description });
        descLabel.set_xalign(0);
        descLabel.set_wrap(true);
        descLabel.add_css_class('dim');
        row.append(descLabel);
      }
      contentBox.append(row);
    }`;
  } else if (reactSource.includes('AuditReport')) {
    body += `
    // Audit report
    const findings = (p.findings || p.issues || []) as Array<{ id?: string; severity?: string; title?: string; description?: string }>;
    const summaryLabel = new Gtk.Label({ label: \`\${findings.length} findings\` });
    contentBox.append(summaryLabel);
    for (const finding of findings) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      if (finding.severity) {
        const sevLabel = new Gtk.Label({ label: finding.severity });
        sevLabel.add_css_class(\`severity-\${finding.severity}\`);
        row.append(sevLabel);
      }
      const titleLabel = new Gtk.Label({ label: finding.title || finding.description || '' });
      titleLabel.set_hexpand(true);
      titleLabel.set_xalign(0);
      titleLabel.set_wrap(true);
      row.append(titleLabel);
      contentBox.append(row);
    }`;
  } else if (reactSource.includes('ExecutionOverlay')) {
    body += `
    // Execution overlay
    const running = (p.running || false) as boolean;
    const overlayStatus = (p.status || 'idle') as string;
    if (running) {
      const spinner = new Gtk.Spinner();
      spinner.set_spinning(true);
      contentBox.append(spinner);
      const runLabel = new Gtk.Label({ label: \`Status: \${overlayStatus}\` });
      contentBox.append(runLabel);
    }
    const progressBar = new Gtk.ProgressBar();
    progressBar.set_fraction((p.progress || 0) as number);
    contentBox.append(progressBar);`;
  } else if (reactSource.includes('ApprovalStepper')) {
    body += `
    // Approval stepper
    const steps2 = (p.steps || []) as Array<{ label: string; status: string; approver?: string }>;
    for (let i = 0; i < steps2.length; i++) {
      const step = steps2[i];
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const icon = new Gtk.Label({
        label: step.status === 'approved' ? '\\u2713' : step.status === 'rejected' ? '\\u2717' : step.status === 'current' ? '\\u25CF' : '\\u25CB'
      });
      row.append(icon);
      const stepLabel2 = new Gtk.Label({ label: step.label });
      stepLabel2.set_hexpand(true);
      stepLabel2.set_xalign(0);
      row.append(stepLabel2);
      if (step.approver) {
        const approverLabel = new Gtk.Label({ label: step.approver });
        row.append(approverLabel);
      }
      contentBox.append(row);
      if (i < steps2.length - 1) {
        const separator = new Gtk.Label({ label: '|' });
        separator.add_css_class('step-separator');
        contentBox.append(separator);
      }
    }`;
  } else if (reactSource.includes('SlaTimer')) {
    body += `
    // SLA Timer
    const slaDeadline = (p.deadline || p.target || '') as string;
    const slaStatus = (p.status || 'running') as string;
    const slaLabel = new Gtk.Label({ label: \`SLA: \${slaStatus}\` });
    slaLabel.add_css_class(\`sla-\${slaStatus}\`);
    contentBox.append(slaLabel);
    const deadlineLabel = new Gtk.Label({ label: \`Deadline: \${slaDeadline}\` });
    contentBox.append(deadlineLabel);
    const progressBar2 = new Gtk.ProgressBar();
    progressBar2.set_fraction((p.progress || 0) as number);
    contentBox.append(progressBar2);`;
  } else if (reactSource.includes('EvalResultsTable')) {
    body += `
    // Eval results table
    const evalResults = (p.results || []) as Array<{ id?: string; prompt?: string; expected?: string; actual?: string; score?: number; passed?: boolean }>;
    for (const result of evalResults) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const passLabel = new Gtk.Label({ label: result.passed ? '\\u2713' : '\\u2717' });
      passLabel.add_css_class(result.passed ? 'pass' : 'fail');
      row.append(passLabel);
      const promptLabel = new Gtk.Label({ label: result.prompt || '' });
      promptLabel.set_hexpand(true);
      promptLabel.set_xalign(0);
      promptLabel.set_ellipsize(3);
      row.append(promptLabel);
      if (result.score != null) {
        const scoreLabel = new Gtk.Label({ label: String(result.score) });
        row.append(scoreLabel);
      }
      contentBox.append(row);
    }`;
  } else if (reactSource.includes('ExecutionMetrics') || reactSource.includes('metrics')) {
    body += `
    // Execution metrics panel
    const metrics = (p.metrics || []) as Array<{ name: string; value: number | string; unit?: string }>;
    for (const metric of metrics) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const nameLabel = new Gtk.Label({ label: metric.name });
      nameLabel.set_hexpand(true);
      nameLabel.set_xalign(0);
      row.append(nameLabel);
      const valLabel = new Gtk.Label({ label: \`\${metric.value}\${metric.unit ? ' ' + metric.unit : ''}\` });
      row.append(valLabel);
      contentBox.append(row);
    }`;
  } else if (reactSource.includes('guardrails') || reactSource.includes('GuardrailConfig')) {
    body += `
    // Guardrail config
    const guardrails = (p.guardrails || p.rules || []) as Array<{ id?: string; name: string; enabled: boolean; description?: string }>;
    for (const gr of guardrails) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
      const toggle = new Gtk.Switch();
      toggle.set_active(gr.enabled);
      toggle.connect('state-set', (_w: Gtk.Switch, active: boolean) => {
        send({ type: active ? 'ENABLE_RULE' : 'DISABLE_RULE' } as any);
        return false;
      });
      row.append(toggle);
      const grLabel = new Gtk.Label({ label: gr.name });
      grLabel.set_hexpand(true);
      grLabel.set_xalign(0);
      row.append(grLabel);
      contentBox.append(row);
    }`;
  } else {
    // Generic fallback
    body += `
    // Generic content render
    const displayLabel = new Gtk.Label({ label: \`\${state}\` });
    displayLabel.set_wrap(true);
    displayLabel.set_xalign(0);
    contentBox.append(displayLabel);
    // Render all string/number props as labels
    for (const [key, value] of Object.entries(p)) {
      if (typeof value === 'string' || typeof value === 'number') {
        const propRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 });
        const keyLabel = new Gtk.Label({ label: key + ':' });
        keyLabel.add_css_class('prop-key');
        propRow.append(keyLabel);
        const valLabel = new Gtk.Label({ label: String(value) });
        valLabel.set_hexpand(true);
        valLabel.set_xalign(0);
        valLabel.set_wrap(true);
        propRow.append(valLabel);
        contentBox.append(propRow);
      }
    }`;
  }

  return body;
}

// --- Main ---
let count = 0;
for (const [suite, widgets] of Object.entries(WIDGETS)) {
  const dir = path.join(GTK_BASE, suite);
  for (const widgetName of widgets) {
    const gtkFile = path.join(dir, `${widgetName}.ts`);
    const output = generateGtkWidget(suite, widgetName);
    if (output) {
      fs.writeFileSync(gtkFile, output, 'utf-8');
      count++;
      console.log(`[${count}/47] ${suite}/${widgetName}.ts`);
    }
  }
}

console.log(`\nGenerated ${count} GTK concept widgets.`);

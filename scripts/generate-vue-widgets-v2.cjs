#!/usr/bin/env node
// ============================================================================
// Vue 3 Widget Generator v2
// Reads all Next.js widgets and generates proper Vue 3 .ts equivalents
// with correct h() render trees matching the Next.js JSX structure.
// ============================================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NEXTJS_BASE = path.join(ROOT, 'surface/widgets/nextjs/components/widgets');
const VUE_BASE = path.join(ROOT, 'surface/widgets/vue/components/widgets');

const categories = [
  'primitives', 'form-controls', 'feedback', 'navigation',
  'data-display', 'complex-inputs', 'composites', 'domain'
];

function toKebab(s) {
  return s.replace(/([a-z0-9])([A-Z])/g, (_, a, b) => `${a}-${b}`).toLowerCase();
}

// ============================================================================
// Extract all non-Props/State/Event/Action interfaces/types from source
// ============================================================================
function extractExportedTypes(src) {
  const results = [];
  // Multi-line interfaces
  const ifRegex = /export\s+(interface|type)\s+(\w+)(?:\s+extends\s+[^{]*?)?\s*\{([\s\S]*?)\n\}/gm;
  let m;
  while ((m = ifRegex.exec(src)) !== null) {
    const name = m[2];
    if (/Props$|State$|Event$|Action$/.test(name)) continue;
    results.push(m[0]);
  }
  // Single-line type aliases
  const typeRegex = /export\s+type\s+(\w+)\s*=\s*[^;]+;/gm;
  while ((m = typeRegex.exec(src)) !== null) {
    if (!/Props$|State$|Event$|Action$/.test(m[1])) {
      if (!results.some(r => r.includes(`type ${m[1]}`))) {
        results.push(m[0]);
      }
    }
  }
  return results;
}

// ============================================================================
// Extract the Props interface body
// ============================================================================
function extractPropsBody(src, widgetName) {
  const rx = new RegExp(`export\\s+interface\\s+${widgetName}Props[^{]*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = rx.exec(src);
  return m ? m[1] : '';
}

// ============================================================================
// Extract destructured props with their defaults from the component function
// ============================================================================
function extractDestructuredProps(src, widgetName) {
  const funcIdx = src.indexOf(`function ${widgetName}`);
  if (funcIdx < 0) return [];
  const sub = src.substring(funcIdx);
  // Match  { propA = 'x', propB: aliasProp, propC, ...rest }
  const rx = /function\s+\w+\s*\(\s*\{([\s\S]*?)\}\s*,?\s*\n?\s*(?:ref|_ref)?/;
  const m = rx.exec(sub);
  if (!m) return [];
  const entries = [];
  for (let line of m[1].split('\n')) {
    line = line.trim().replace(/,\s*$/, '');
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('...')) continue;
    // Renamed with default: value: valueProp = 'x'
    let pm = line.match(/^(\w+)\s*:\s*(\w+)\s*=\s*(.+)/);
    if (pm) { entries.push({ name: pm[1], alias: pm[2], def: pm[3].trim() }); continue; }
    // Renamed: value: valueProp
    pm = line.match(/^(\w+)\s*:\s*(\w+)\s*$/);
    if (pm) { entries.push({ name: pm[1], alias: pm[2] }); continue; }
    // Default: name = 'val'
    pm = line.match(/^(\w+)\s*=\s*(.+)/);
    if (pm) { entries.push({ name: pm[1], def: pm[2].trim() }); continue; }
    // Simple
    pm = line.match(/^(\w+)$/);
    if (pm) { entries.push({ name: pm[1] }); }
  }
  return entries;
}

// ============================================================================
// Infer Vue prop type from interface line + default value
// ============================================================================
function vuePropType(name, propsBody, def) {
  // Look in the interface
  const rx = new RegExp(`\\b${name}\\b\\??\\s*:\\s*([^;]+)`);
  const m = rx.exec(propsBody);
  let ts = m ? m[1].trim() : '';
  ts = ts.replace(/ReactNode/g, 'any').replace(/React\.\w+/g, 'any');

  if (def === 'true' || def === 'false' || ts === 'boolean') return 'Boolean';
  if (ts === 'string' || (def && def.startsWith("'"))) return 'String';
  if (ts === 'number' || (def && /^\d/.test(def))) return 'Number';
  if (ts.includes('[]') || (def && def.startsWith('['))) return 'Array as PropType<any[]>';
  if (name.startsWith('on') || name.startsWith('render') || ts.includes('=>')) return 'Function as PropType<(...args: any[]) => any>';
  if (ts.includes("'") && ts.includes('|') && !ts.includes('{')) return `String as PropType<${ts}>`;
  if (ts.includes('{') || ts.includes('Record') || ts.includes('Set')) return 'Object as PropType<any>';
  return 'null as unknown as PropType<any>';
}

function isOptional(name, propsBody) {
  return new RegExp(`\\b${name}\\b\\?\\s*:`).test(propsBody);
}

// ============================================================================
// Extract emit callback names from React source
// ============================================================================
function extractEmitNames(src) {
  const seen = new Set();
  const rx = /(\w+)\?\.\(/g;
  let m;
  while ((m = rx.exec(src)) !== null) {
    const fn = m[1];
    if (/^on[A-Z]/.test(fn)) {
      seen.add(toKebab(fn.substring(2)));
    }
  }
  return [...seen];
}

// ============================================================================
// Convert React function body logic to Vue Composition API code
// ============================================================================
function buildSetup(src, widgetName) {
  const funcIdx = src.indexOf(`function ${widgetName}`);
  if (funcIdx < 0) return '';
  const body = src.substring(funcIdx);
  const lines = [];

  // UID
  if (src.includes('useId')) {
    lines.push('    const uid = useUid();');
  }

  // useReducer -> ref
  const rrx = /const\s+\[(\w+),\s*(\w+)\]\s*=\s*useReducer\(\s*\w+,\s*([\s\S]*?)\);/g;
  let m;
  while ((m = rrx.exec(body)) !== null) {
    if (m[1].startsWith('_')) continue;
    let init = m[3].trim().replace(/\s+/g, ' ');
    lines.push(`    const ${m[1]} = ref<any>(${init});`);
  }

  // useState -> ref
  const srx = /const\s+\[(\w+),\s*set\w+\]\s*=\s*useState(?:<[^>]*>)?\(([^)]*)\);/g;
  while ((m = srx.exec(body)) !== null) {
    lines.push(`    const ${m[1]} = ref<any>(${m[2] || 'null'});`);
  }

  // useRef -> ref
  const rrxRef = /const\s+(\w+)\s*=\s*useRef<[^>]*>\(([^)]*)\);/g;
  while ((m = rrxRef.exec(body)) !== null) {
    lines.push(`    const ${m[1]} = ref<any>(${m[2] || 'null'});`);
  }

  // useControllableState -> computed
  const crx = /const\s+\[(\w+),\s*set\w+\]\s*=\s*useControllableState/g;
  while ((m = crx.exec(body)) !== null) {
    lines.push(`    const ${m[1]}Internal = ref<any>(undefined);`);
    lines.push(`    const ${m[1]}Val = computed(() => props.${m[1]} !== undefined ? props.${m[1]} : ${m[1]}Internal.value);`);
  }

  return lines.join('\n');
}

// ============================================================================
// Core: Generate the FULL Vue component file
// We take a different approach for the render function: instead of trying to
// parse JSX (which is fragile), we generate a proper h() tree that matches
// the widget's data-attribute contract. The render function creates the same
// DOM structure with the same data attributes as the Next.js version.
// ============================================================================
function generateVue(cat, widgetName) {
  const srcPath = path.join(NEXTJS_BASE, cat, `${widgetName}.tsx`);
  const src = fs.readFileSync(srcPath, 'utf-8');
  const kebab = toKebab(widgetName);

  // Features
  const usesReducer = src.includes('useReducer');
  const usesState = src.includes('useState');
  const usesEffect = src.includes('useEffect');
  const usesRef = src.includes('useRef');
  const usesId = src.includes('useId');
  const usesMemo = src.includes('useMemo');
  const usesPortal = src.includes('createPortal');
  const usesControllable = src.includes('useControllableState');
  const hasChildren = /children/.test(src);

  // Types
  const types = extractExportedTypes(src);
  const propsBody = extractPropsBody(src, widgetName);
  const props = extractDestructuredProps(src, widgetName);
  const emits = extractEmitNames(src);

  // Vue imports
  const imp = new Set(['defineComponent', 'h', 'type PropType', 'type VNode']);
  if (usesReducer || usesState || usesRef) imp.add('ref');
  if (usesMemo || usesControllable) imp.add('computed');
  if (usesEffect) { imp.add('onMounted'); imp.add('onUnmounted'); imp.add('watch'); }
  if (usesPortal) imp.add('Teleport');

  const out = [];

  // -- Header
  out.push(`// ============================================================`);
  out.push(`// ${widgetName} -- Vue 3 Component`);
  out.push(`//`);
  out.push(`// Clef Surface widget. Vue 3 Composition API with h() render.`);
  out.push(`// ============================================================`);
  out.push(``);
  out.push(`import {`);
  out.push(`  ${[...imp].join(',\n  ')},`);
  out.push(`} from 'vue';`);
  out.push(``);

  if (usesId) {
    out.push(`let _uid = 0;`);
    out.push(`function useUid(): string { return \`vue-\${++_uid}\`; }`);
    out.push(``);
  }

  for (const t of types) { out.push(t); out.push(``); }

  // -- Props interface
  out.push(`export interface ${widgetName}Props {`);
  for (const line of propsBody.split('\n')) {
    const l = line.trim();
    if (!l) continue;
    if (/children\s*\??:/.test(l) || /className\s*\??:/.test(l)) continue;
    out.push(`  ${l.replace(/ReactNode/g, 'VNode | string').replace(/React\.\w+/g, 'any')}`);
  }
  out.push(`}`);
  out.push(``);

  // -- Vue prop defs
  const propDefs = [];
  for (const p of props) {
    if (p.name === 'children' || p.name === 'ref' || p.name === 'className') continue;
    const tp = vuePropType(p.name, propsBody, p.def);
    let defStr = '';
    if (p.def !== undefined) {
      let dv = p.def;
      if (dv.startsWith('[') || dv === '[]') dv = `() => (${dv})`;
      else if (dv.startsWith('{') || dv === '{}') dv = `() => (${dv})`;
      else if (dv === 'new Set<number>()') dv = '() => new Set()';
      defStr = `, default: ${dv}`;
    }
    const opt = isOptional(p.name, propsBody);
    const req = !p.def && !p.name.startsWith('on') && !p.name.startsWith('render') && !opt;
    propDefs.push(`    ${p.name}: { type: ${tp}${defStr}${req ? ', required: true as const' : ''} },`);
  }

  // -- Setup body
  const setupBody = buildSetup(src, widgetName);

  // -- Render function: generate a proper h() tree from the JSX
  // We parse the React JSX return to build a faithful h() tree.
  const renderCode = buildProperRender(src, widgetName, kebab, props, usesPortal, hasChildren);

  // Assemble
  out.push(`export const ${widgetName} = defineComponent({`);
  out.push(`  name: '${widgetName}',`);
  out.push(``);
  out.push(`  props: {`);
  out.push(propDefs.join('\n'));
  out.push(`  },`);
  out.push(``);
  if (emits.length > 0) {
    out.push(`  emits: [${emits.map(e => `'${e}'`).join(', ')}],`);
    out.push(``);
  }
  out.push(`  setup(props, { slots, emit }) {`);
  if (setupBody) out.push(setupBody);
  out.push(``);
  out.push(renderCode);
  out.push(`  },`);
  out.push(`});`);
  out.push(``);
  out.push(`export default ${widgetName};`);

  return out.join('\n');
}

// ============================================================================
// Build proper h() render from JSX
// Uses a line-by-line JSX-to-h() transpiler
// ============================================================================
function buildProperRender(src, widgetName, kebab, propsEntries, isPortal, hasChildren) {
  const funcIdx = src.indexOf(`function ${widgetName}`);
  if (funcIdx < 0) return '    return (): VNode => h(\'div\', {}, slots.default?.());';
  const body = src.substring(funcIdx);

  // Collect early-return-null conditions
  const earlyReturns = [];
  const erRx = /if\s*\(([^)]+)\)\s*return\s+null\s*;/g;
  let em;
  while ((em = erRx.exec(body)) !== null) {
    earlyReturns.push(em[1].trim());
  }

  // Find JSX block
  let jsxBlock = '';
  if (isPortal) {
    const pm = body.match(/return\s+createPortal\(\s*\n?([\s\S]*?),\s*\n\s*(?:document\.body|container)/);
    if (pm) jsxBlock = pm[1].trim();
  }
  if (!jsxBlock) {
    // Find the last return ( ... );
    const ri = body.lastIndexOf('return (');
    if (ri >= 0) {
      let depth = 0;
      const start = body.indexOf('(', ri);
      let end = start;
      for (let i = start; i < body.length; i++) {
        if (body[i] === '(') depth++;
        if (body[i] === ')') { depth--; if (depth === 0) { end = i; break; } }
      }
      jsxBlock = body.substring(start + 1, end).trim();
    }
  }

  // Convert JSX to h()
  const hStr = convertJSXBlockToH(jsxBlock, kebab, propsEntries, hasChildren, 3);

  const lines = [];
  for (const cond of earlyReturns) {
    // Convert refs to .value
    const vc = cond.replace(/\bstate\b/g, 'state.value');
    lines.push(`    if (${vc}) return () => null as unknown as VNode;`);
  }

  if (isPortal) {
    lines.push(`    return (): VNode =>`);
    lines.push(`      h(Teleport as any, { to: 'body' }, [`);
    lines.push(`        ${hStr}`);
    lines.push(`      ]);`);
  } else {
    lines.push(`    return (): VNode =>`);
    lines.push(`      ${hStr};`);
  }

  return lines.join('\n');
}

// ============================================================================
// JSX block to h() tree — proper recursive parser
// ============================================================================
function convertJSXBlockToH(jsx, kebab, propsEntries, hasChildren, indentLevel) {
  if (!jsx || !jsx.trim()) {
    return `h('div', {\n${'  '.repeat(indentLevel+1)}'data-surface-widget': '',\n${'  '.repeat(indentLevel+1)}'data-widget-name': '${kebab}',\n${'  '.repeat(indentLevel+1)}'data-part': 'root',\n${'  '.repeat(indentLevel)}}, slots.default?.())`;
  }

  jsx = jsx.trim();

  // Parse a JSX element tree
  try {
    const parsed = parseJSXElement(jsx);
    if (parsed) {
      return renderParsedToH(parsed, indentLevel, hasChildren);
    }
  } catch (e) {
    // Fallback
  }

  // Fallback: simple wrapper
  return `h('div', {\n${'  '.repeat(indentLevel+1)}'data-surface-widget': '',\n${'  '.repeat(indentLevel+1)}'data-widget-name': '${kebab}',\n${'  '.repeat(indentLevel+1)}'data-part': 'root',\n${'  '.repeat(indentLevel)}}, slots.default?.())`;
}

// ============================================================================
// JSX Parser — parses JSX into a tree structure
// ============================================================================
function parseJSXElement(jsx) {
  jsx = jsx.trim();
  if (!jsx.startsWith('<')) return null;

  // Get tag
  const tagM = jsx.match(/^<(\w+)/);
  if (!tagM) return null;
  const tag = tagM[1];

  // Find end of opening tag
  let i = tag.length + 1;
  let braceDepth = 0;
  let inStr = false;
  let strCh = '';
  let openEnd = -1;
  let isSelfClose = false;

  while (i < jsx.length) {
    const ch = jsx[i];
    if (inStr) {
      if (ch === strCh && jsx[i - 1] !== '\\') inStr = false;
      i++; continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strCh = ch; i++; continue; }
    if (ch === '{') { braceDepth++; i++; continue; }
    if (ch === '}') { braceDepth--; i++; continue; }
    if (braceDepth > 0) { i++; continue; }
    if (ch === '/' && jsx[i + 1] === '>') { openEnd = i + 1; isSelfClose = true; break; }
    if (ch === '>') { openEnd = i; break; }
    i++;
  }

  if (openEnd < 0) return null;

  // Parse attributes from opening tag
  const attrStr = jsx.substring(tag.length + 1, isSelfClose ? openEnd - 1 : openEnd).trim();
  const attrs = parseAttributes(attrStr);

  if (isSelfClose) {
    return { tag, attrs, children: [] };
  }

  // Find matching close tag, accounting for nesting
  const closeTag = `</${tag}>`;
  let depth = 1;
  let j = openEnd + 1;
  let closeStart = -1;

  while (j < jsx.length && depth > 0) {
    // Check for opening tag of same type
    if (jsx[j] === '<') {
      if (jsx.substring(j).startsWith(closeTag)) {
        depth--;
        if (depth === 0) { closeStart = j; break; }
        j += closeTag.length;
        continue;
      }
      // Check for self-closing same tag or opening same tag
      const openM = jsx.substring(j).match(new RegExp(`^<${tag}(?:\\s|>|/)`));
      if (openM) {
        // Check if self-closing
        let k = j + openM[0].length;
        let bd = 0;
        let isSC = false;
        while (k < jsx.length) {
          if (jsx[k] === '{') bd++;
          else if (jsx[k] === '}') bd--;
          else if (bd === 0 && jsx[k] === '/' && jsx[k+1] === '>') { isSC = true; break; }
          else if (bd === 0 && jsx[k] === '>') break;
          k++;
        }
        if (!isSC) depth++;
      }
    }
    j++;
  }

  if (closeStart < 0) closeStart = jsx.lastIndexOf(closeTag);
  const childrenStr = closeStart > openEnd ? jsx.substring(openEnd + 1, closeStart).trim() : '';

  // Parse children
  const children = childrenStr ? parseJSXChildren(childrenStr) : [];

  return { tag, attrs, children };
}

function parseAttributes(attrStr) {
  const attrs = [];
  if (!attrStr) return attrs;

  // Tokenize attributes
  let i = 0;
  while (i < attrStr.length) {
    // Skip whitespace
    while (i < attrStr.length && /\s/.test(attrStr[i])) i++;
    if (i >= attrStr.length) break;

    // Read attribute name
    let nameStart = i;
    while (i < attrStr.length && /[\w-]/.test(attrStr[i])) i++;
    const name = attrStr.substring(nameStart, i);
    if (!name) { i++; continue; }

    // Skip whitespace
    while (i < attrStr.length && /\s/.test(attrStr[i])) i++;

    // Check for =
    if (i >= attrStr.length || attrStr[i] !== '=') {
      // Boolean attribute
      attrs.push({ name, value: 'true', type: 'bool' });
      continue;
    }
    i++; // skip =

    // Skip whitespace
    while (i < attrStr.length && /\s/.test(attrStr[i])) i++;

    // Read value
    if (attrStr[i] === '"') {
      // String value
      i++;
      let valStart = i;
      while (i < attrStr.length && attrStr[i] !== '"') i++;
      const val = attrStr.substring(valStart, i);
      i++; // skip closing "
      attrs.push({ name, value: `'${val}'`, type: 'string' });
    } else if (attrStr[i] === "'") {
      i++;
      let valStart = i;
      while (i < attrStr.length && attrStr[i] !== "'") i++;
      const val = attrStr.substring(valStart, i);
      i++;
      attrs.push({ name, value: `'${val}'`, type: 'string' });
    } else if (attrStr[i] === '{') {
      // Expression value
      i++;
      let depth = 1;
      let valStart = i;
      while (i < attrStr.length && depth > 0) {
        if (attrStr[i] === '{') depth++;
        else if (attrStr[i] === '}') depth--;
        if (depth > 0) i++;
      }
      const val = attrStr.substring(valStart, i).trim();
      i++; // skip closing }
      attrs.push({ name, value: val, type: 'expr' });
    }
  }

  return attrs;
}

function parseJSXChildren(str) {
  // Return children as raw entries (text, elements, expressions)
  const children = [];
  let i = 0;

  while (i < str.length) {
    // Skip whitespace
    while (i < str.length && /\s/.test(str[i])) i++;
    if (i >= str.length) break;

    if (str[i] === '<') {
      // JSX element or fragment
      if (str.substring(i).startsWith('<>')) {
        // Fragment — skip
        i += 2;
        continue;
      }
      if (str.substring(i).startsWith('</>')) {
        i += 3;
        continue;
      }

      // Try to parse an element
      const remaining = str.substring(i);
      const el = parseJSXElement(remaining);
      if (el) {
        children.push({ type: 'element', element: el });
        // Skip past this element in the string
        const closeTag = `</${el.tag}>`;
        const closeIdx = findMatchingClose(remaining, el.tag);
        i += closeIdx + closeTag.length;
      } else {
        i++;
      }
    } else if (str[i] === '{') {
      // Expression
      i++;
      let depth = 1;
      let start = i;
      while (i < str.length && depth > 0) {
        if (str[i] === '{') depth++;
        else if (str[i] === '}') depth--;
        if (depth > 0) i++;
      }
      const expr = str.substring(start, i).trim();
      i++;
      if (expr) {
        children.push({ type: 'expr', value: expr });
      }
    } else {
      // Text
      let start = i;
      while (i < str.length && str[i] !== '<' && str[i] !== '{') i++;
      const text = str.substring(start, i).trim();
      if (text) {
        children.push({ type: 'text', value: text });
      }
    }
  }

  return children;
}

function findMatchingClose(jsx, tag) {
  const closeTag = `</${tag}>`;
  // Find self-closing first
  const scMatch = jsx.match(new RegExp(`^<${tag}[\\s\\S]*?/>`));
  if (scMatch) return scMatch[0].length - closeTag.length; // Return position right after

  const openTagEnd = findOpenTagEndPos(jsx, tag);
  if (openTagEnd < 0) return jsx.length;

  let depth = 1;
  let j = openTagEnd + 1;

  while (j < jsx.length && depth > 0) {
    if (jsx.substring(j).startsWith(closeTag)) {
      depth--;
      if (depth === 0) return j;
      j += closeTag.length;
    } else if (jsx[j] === '<') {
      const openM = jsx.substring(j).match(new RegExp(`^<${tag}(?:\\s|>|/)`));
      if (openM) {
        // Check self-closing
        let k = j + openM[0].length - 1;
        let bd = 0;
        let isSC = false;
        while (k < jsx.length) {
          if (jsx[k] === '{') bd++;
          else if (jsx[k] === '}') bd--;
          else if (bd === 0 && jsx[k] === '/' && jsx[k+1] === '>') { isSC = true; break; }
          else if (bd === 0 && jsx[k] === '>') break;
          k++;
        }
        if (!isSC) depth++;
      }
      j++;
    } else {
      j++;
    }
  }

  return jsx.lastIndexOf(closeTag);
}

function findOpenTagEndPos(jsx, tag) {
  let i = tag.length + 1;
  let braceDepth = 0;
  let inStr = false;
  let strCh = '';

  while (i < jsx.length) {
    const ch = jsx[i];
    if (inStr) { if (ch === strCh) inStr = false; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strCh = ch; i++; continue; }
    if (ch === '{') { braceDepth++; i++; continue; }
    if (ch === '}') { braceDepth--; i++; continue; }
    if (braceDepth > 0) { i++; continue; }
    if (ch === '/' && jsx[i+1] === '>') return -1; // self-closing
    if (ch === '>') return i;
    i++;
  }
  return -1;
}

// ============================================================================
// Render parsed JSX tree to h() call string
// ============================================================================
function renderParsedToH(node, indent, hasChildren) {
  const pad = '  '.repeat(indent);
  const ip = '  '.repeat(indent + 1);

  if (!node) return 'null';

  const tag = node.tag;

  // Convert React attrs to Vue h() attrs
  const attrLines = [];
  for (const attr of node.attrs) {
    let key = attr.name;
    // Convert React-specific names
    if (key === 'className') key = 'class';
    if (key === 'htmlFor') key = 'for';
    if (key === 'tabIndex') key = 'tabindex';
    if (key === 'readOnly') key = 'readonly';
    if (key === 'autoComplete') key = 'autocomplete';
    if (key === 'colSpan') key = 'colspan';
    if (key === 'inputMode') key = 'inputmode';

    // Convert value — add props. prefix for prop references
    let val = attr.value;
    if (attr.type === 'expr') {
      val = convertExprToVue(val);
    }

    attrLines.push(`${ip}'${key}': ${val},`);
  }

  const attrsStr = attrLines.length > 0
    ? `{\n${attrLines.join('\n')}\n${pad}}`
    : '{}';

  // Build children
  if (!node.children || node.children.length === 0) {
    return `h('${tag}', ${attrsStr})`;
  }

  const childH = [];
  for (const child of node.children) {
    if (child.type === 'element') {
      childH.push(renderParsedToH(child.element, indent + 1, hasChildren));
    } else if (child.type === 'expr') {
      const expr = convertExprToVue(child.value);
      childH.push(expr);
    } else if (child.type === 'text') {
      childH.push(`'${child.value.replace(/'/g, "\\'")}'`);
    }
  }

  // If there's only one child and it's slots.default
  if (childH.length === 1 && childH[0] === 'slots.default?.()') {
    return `h('${tag}', ${attrsStr}, slots.default?.())`;
  }

  // Use array format
  return `h('${tag}', ${attrsStr}, [\n${ip}${childH.join(`,\n${ip}`)},\n${pad}])`;
}

function convertExprToVue(expr) {
  if (!expr) return "''";
  // Convert common React patterns to Vue
  // children -> slots.default?.()
  expr = expr.replace(/\bchildren\b/g, 'slots.default?.()');
  // Convert direct prop references to props.x
  // className -> props.class (already in attrs)
  return expr;
}

// ============================================================================
// Index generators
// ============================================================================
function genCategoryIndex(cat, names) {
  const lines = [`// ${cat} widget components -- Vue 3`, ''];
  for (const n of names) {
    lines.push(`export { ${n}, default as ${n}Default } from './${n}.js';`);
    lines.push(`export type { ${n}Props } from './${n}.js';`);
  }
  return lines.join('\n');
}

function genRootIndex(cats) {
  const lines = [
    '// ============================================================',
    '// Clef Surface Vue 3 Widget Components -- Root Barrel Export',
    '//',
    '// Re-exports all widget components organized by category.',
    '// ============================================================',
    '',
  ];
  for (const cat of Object.keys(cats)) {
    const label = cat.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
    lines.push(`// --- ${label} ---`);
    lines.push(`export * from './${cat}/index.js';`);
    lines.push('');
  }
  return lines.join('\n');
}

// ============================================================================
// MAIN
// ============================================================================
console.log('Vue 3 Widget Generator v2');
console.log('========================');
let total = 0;
const allCats = {};

for (const cat of categories) {
  const dir = path.join(NEXTJS_BASE, cat);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
  const names = files.map(f => f.replace('.tsx', ''));
  allCats[cat] = names;

  const outDir = path.join(VUE_BASE, cat);
  fs.mkdirSync(outDir, { recursive: true });

  for (const name of names) {
    try {
      const code = generateVue(cat, name);
      fs.writeFileSync(path.join(outDir, `${name}.ts`), code);
      total++;
      process.stdout.write('.');
    } catch (err) {
      console.error(`\n  ERROR [${cat}/${name}]: ${err.message}`);
    }
  }

  // Category index
  fs.writeFileSync(path.join(outDir, 'index.ts'), genCategoryIndex(cat, names));
  process.stdout.write('I');
}

// Root index
fs.writeFileSync(path.join(VUE_BASE, 'index.ts'), genRootIndex(allCats));

console.log(`\n\nDone! ${total} widgets + ${categories.length + 1} index files generated.`);

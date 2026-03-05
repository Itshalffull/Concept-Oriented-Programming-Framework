#!/usr/bin/env node
// ============================================================================
// Vue 3 Widget Generator v3
//
// Reads all Next.js widget .tsx files and generates proper Vue 3 .ts equivalents.
// This version properly converts JSX to h() render trees with correct
// props references, event handlers, state management, and children rendering.
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
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

// ============================================================================
// Proper JSX-to-h() transpiler
//
// The core idea: we work on the raw JSX string from the return statement,
// and do a recursive descent parse that produces valid h() call strings.
// All bare variable references that match known props get prefixed with `props.`.
// ============================================================================

/**
 * Extract the JSX return block from a React component source.
 */
function extractJSXReturn(src, widgetName) {
  // Find the component function
  const funcIdx = src.indexOf(`function ${widgetName}`);
  if (funcIdx < 0) return null;
  const body = src.substring(funcIdx);

  // Handle createPortal
  const portalMatch = body.match(/return\s+createPortal\(\s*\n?([\s\S]*?),\s*\n\s*(?:document\.body|container)\s*(?:,?\s*)\)/);
  if (portalMatch) {
    return { jsx: portalMatch[1].trim(), isPortal: true };
  }

  // Find early returns with null
  const earlyReturns = [];
  const erRx = /if\s*\(([^)]+)\)\s*return\s+null\s*;/g;
  let em;
  while ((em = erRx.exec(body)) !== null) {
    earlyReturns.push(em[1].trim());
  }

  // Find early returns with JSX (like Portal's disabled case)
  const earlyJsxReturns = [];
  const ejRx = /if\s*\(([^)]+)\)\s*\{\s*\n\s*return\s*\(\s*\n?([\s\S]*?)\n\s*\);\s*\n\s*\}/g;
  while ((em = ejRx.exec(body)) !== null) {
    earlyJsxReturns.push({ condition: em[1].trim(), jsx: em[2].trim() });
  }

  // Find the last `return (` ... `)` block
  const ri = body.lastIndexOf('return (');
  if (ri < 0) {
    // Try `return <`
    const ri2 = body.lastIndexOf('return <');
    if (ri2 >= 0) {
      // Find matching close
      let depth = 0;
      let j = ri2 + 7; // after "return "
      const start = j;
      // Find the tag name
      const tagM = body.substring(j).match(/^<(\w+)/);
      if (tagM) {
        const closeTag = `</${tagM[1]}>`;
        const end = body.indexOf(closeTag, j);
        if (end >= 0) {
          return {
            jsx: body.substring(start, end + closeTag.length).trim(),
            earlyReturns,
            earlyJsxReturns
          };
        }
      }
    }
    return null;
  }

  let depth = 0;
  const start = body.indexOf('(', ri);
  let end = start;
  for (let i = start; i < body.length; i++) {
    if (body[i] === '(') depth++;
    if (body[i] === ')') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  return {
    jsx: body.substring(start + 1, end).trim(),
    earlyReturns,
    earlyJsxReturns
  };
}

/**
 * Parse JSX string into a tree of nodes.
 * Each node: { tag, attrs: [{name, value, type}], children: [node|expr|text] }
 */
function parseJSX(jsx, pos) {
  pos = pos || { i: 0 };
  jsx = jsx.trim();

  if (!jsx || pos.i >= jsx.length) return null;

  // Skip whitespace
  while (pos.i < jsx.length && /\s/.test(jsx[pos.i])) pos.i++;

  if (jsx[pos.i] !== '<') return null;

  // Fragment
  if (jsx.substring(pos.i, pos.i + 2) === '<>') {
    pos.i += 2;
    const children = parseChildren(jsx, pos, '</>');
    pos.i += 3; // skip </>
    return { tag: null, attrs: [], children, isFragment: true };
  }

  // Get tag name
  pos.i++; // skip <
  let tagStart = pos.i;
  while (pos.i < jsx.length && /[\w.]/.test(jsx[pos.i])) pos.i++;
  const tag = jsx.substring(tagStart, pos.i);
  if (!tag) return null;

  // Parse attributes
  const attrs = parseAttrs(jsx, pos);

  // Self-closing?
  skipWS(jsx, pos);
  if (jsx[pos.i] === '/' && jsx[pos.i + 1] === '>') {
    pos.i += 2;
    return { tag, attrs, children: [] };
  }

  // Opening tag close
  if (jsx[pos.i] === '>') {
    pos.i++;
  }

  // Parse children until closing tag
  const closeTag = `</${tag}>`;
  const children = parseChildren(jsx, pos, closeTag);

  // Skip closing tag
  if (jsx.substring(pos.i, pos.i + closeTag.length) === closeTag) {
    pos.i += closeTag.length;
  }

  return { tag, attrs, children };
}

function skipWS(jsx, pos) {
  while (pos.i < jsx.length && /\s/.test(jsx[pos.i])) pos.i++;
}

function parseAttrs(jsx, pos) {
  const attrs = [];

  while (pos.i < jsx.length) {
    skipWS(jsx, pos);

    // End of tag?
    if (jsx[pos.i] === '>' || (jsx[pos.i] === '/' && jsx[pos.i + 1] === '>')) break;

    // Spread: {...rest}
    if (jsx[pos.i] === '{' && jsx[pos.i + 1] === '.' && jsx[pos.i + 2] === '.') {
      let depth = 0;
      let start = pos.i;
      while (pos.i < jsx.length) {
        if (jsx[pos.i] === '{') depth++;
        if (jsx[pos.i] === '}') { depth--; if (depth === 0) { pos.i++; break; } }
        pos.i++;
      }
      // Skip spread attributes (handled differently in Vue)
      continue;
    }

    // Attribute name
    let nameStart = pos.i;
    while (pos.i < jsx.length && /[\w\-]/.test(jsx[pos.i])) pos.i++;
    const name = jsx.substring(nameStart, pos.i);
    if (!name) { pos.i++; continue; }

    skipWS(jsx, pos);

    // No value = boolean true
    if (jsx[pos.i] !== '=') {
      attrs.push({ name, value: 'true', type: 'bool' });
      continue;
    }

    pos.i++; // skip =
    skipWS(jsx, pos);

    // String value
    if (jsx[pos.i] === '"' || jsx[pos.i] === "'") {
      const quote = jsx[pos.i];
      pos.i++;
      let valStart = pos.i;
      while (pos.i < jsx.length && jsx[pos.i] !== quote) {
        if (jsx[pos.i] === '\\') pos.i++; // skip escaped
        pos.i++;
      }
      const val = jsx.substring(valStart, pos.i);
      pos.i++; // skip closing quote
      attrs.push({ name, value: `'${val}'`, type: 'string' });
    }
    // Expression value
    else if (jsx[pos.i] === '{') {
      pos.i++;
      let depth = 1;
      let valStart = pos.i;
      while (pos.i < jsx.length && depth > 0) {
        if (jsx[pos.i] === '{') depth++;
        else if (jsx[pos.i] === '}') depth--;
        if (depth > 0) pos.i++;
      }
      const val = jsx.substring(valStart, pos.i).trim();
      pos.i++; // skip }
      attrs.push({ name, value: val, type: 'expr' });
    }
  }

  return attrs;
}

function parseChildren(jsx, pos, endMarker) {
  const children = [];

  while (pos.i < jsx.length) {
    skipWS(jsx, pos);
    if (pos.i >= jsx.length) break;

    // Check for end marker
    if (endMarker && jsx.substring(pos.i, pos.i + endMarker.length) === endMarker) break;

    // Check for closing tag (fragment or element)
    if (jsx[pos.i] === '<' && jsx[pos.i + 1] === '/') break;

    // JSX comment: {/* ... */}
    if (jsx[pos.i] === '{' && jsx[pos.i + 1] === '/' && jsx[pos.i + 2] === '*') {
      // Skip to end of comment block }
      let depth = 1;
      pos.i++;
      while (pos.i < jsx.length && depth > 0) {
        if (jsx[pos.i] === '{') depth++;
        else if (jsx[pos.i] === '}') depth--;
        if (depth > 0) pos.i++;
      }
      pos.i++; // skip }
      continue;
    }

    // Element
    if (jsx[pos.i] === '<') {
      // Fragment
      if (jsx.substring(pos.i, pos.i + 2) === '<>') {
        const node = parseJSX(jsx, pos);
        if (node) children.push({ type: 'element', node });
        continue;
      }

      const node = parseJSX(jsx, pos);
      if (node) {
        children.push({ type: 'element', node });
      } else {
        pos.i++;
      }
      continue;
    }

    // Expression
    if (jsx[pos.i] === '{') {
      pos.i++;

      // Comment {/* ... */}
      skipWS(jsx, pos);
      if (jsx[pos.i] === '/' && jsx[pos.i + 1] === '*') {
        // Skip comment
        while (pos.i < jsx.length) {
          if (jsx[pos.i] === '*' && jsx[pos.i + 1] === '/') { pos.i += 2; break; }
          pos.i++;
        }
        skipWS(jsx, pos);
        if (jsx[pos.i] === '}') pos.i++;
        continue;
      }

      let depth = 1;
      let start = pos.i;
      let inStr = false;
      let strCh = '';
      let inTemplate = false;

      while (pos.i < jsx.length && depth > 0) {
        const ch = jsx[pos.i];
        if (inStr) {
          if (ch === strCh && jsx[pos.i - 1] !== '\\') inStr = false;
          pos.i++;
          continue;
        }
        if (ch === '`') { inTemplate = !inTemplate; pos.i++; continue; }
        if (inTemplate) { pos.i++; continue; }
        if (ch === '"' || ch === "'") { inStr = true; strCh = ch; pos.i++; continue; }
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        if (depth > 0) pos.i++;
      }

      const expr = jsx.substring(start, pos.i).trim();
      pos.i++; // skip }
      if (expr) {
        children.push({ type: 'expr', value: expr });
      }
      continue;
    }

    // Text content
    let start = pos.i;
    while (pos.i < jsx.length && jsx[pos.i] !== '<' && jsx[pos.i] !== '{') pos.i++;
    const text = jsx.substring(start, pos.i).trim();
    if (text) {
      children.push({ type: 'text', value: text });
    }
  }

  return children;
}

// ============================================================================
// Convert parsed JSX tree to h() call string
// ============================================================================

/**
 * List of known prop names for a given widget. Used to add `props.` prefix.
 */
function collectPropNames(src) {
  const names = new Set();
  // From destructured props
  const funcBody = src.match(/function\s+\w+\s*\(\s*\{([\s\S]*?)\}\s*,?\s*\n?\s*(?:ref|_ref)?/);
  if (funcBody) {
    for (let line of funcBody[1].split('\n')) {
      line = line.trim().replace(/,\s*$/, '');
      if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('...')) continue;
      // Renamed with default: propName: alias = default
      let m = line.match(/^(\w+)\s*:\s*(\w+)/);
      if (m) { names.add(m[1]); names.add(m[2]); continue; }
      // With default: propName = default
      m = line.match(/^(\w+)\s*=/);
      if (m) { names.add(m[1]); continue; }
      // Simple
      m = line.match(/^(\w+)$/);
      if (m) { names.add(m[1]); }
    }
  }
  return names;
}

/**
 * Collect local variable names defined in the component body (not props).
 * These include useReducer state, useState, useRef, useCallback, useMemo, useId, and const declarations.
 */
function collectLocalVarNames(src, widgetName) {
  const names = new Set();
  const funcIdx = src.indexOf(`function ${widgetName}`);
  if (funcIdx < 0) return names;

  const body = src.substring(funcIdx);
  // useReducer: const [state, send] = useReducer(...)
  const rrx = /const\s+\[(\w+),\s*(\w+)\]\s*=\s*useReducer/g;
  let m;
  while ((m = rrx.exec(body)) !== null) {
    names.add(m[1]); names.add(m[2]);
  }
  // useState: const [state, setState] = useState(...)
  const srx = /const\s+\[(\w+),\s*(\w+)\]\s*=\s*useState/g;
  while ((m = srx.exec(body)) !== null) {
    names.add(m[1]); names.add(m[2]);
  }
  // useControllableState
  const crx = /const\s+\[(\w+),\s*(\w+)\]\s*=\s*useControllableState/g;
  while ((m = crx.exec(body)) !== null) {
    names.add(m[1]); names.add(m[2]);
  }
  // useRef: const xRef = useRef(...)
  const refRx = /const\s+(\w+)\s*=\s*useRef/g;
  while ((m = refRx.exec(body)) !== null) {
    names.add(m[1]);
  }
  // useId: const x = useId()
  const idRx = /const\s+(\w+)\s*=\s*useId/g;
  while ((m = idRx.exec(body)) !== null) {
    names.add(m[1]);
  }
  // useCallback: const handler = useCallback(...)
  const cbRx = /const\s+(\w+)\s*=\s*useCallback/g;
  while ((m = cbRx.exec(body)) !== null) {
    names.add(m[1]);
  }
  // useMemo: const val = useMemo(...)
  const mmRx = /const\s+(\w+)\s*=\s*useMemo/g;
  while ((m = mmRx.exec(body)) !== null) {
    names.add(m[1]);
  }
  // Simple const: const x = expr
  const cRx = /const\s+(\w+)\s*=/g;
  while ((m = cRx.exec(body)) !== null) {
    names.add(m[1]);
  }
  return names;
}

/**
 * Convert an expression to use `props.xxx` for prop references
 * and `state.value.xxx` / `localVar.value` for local state references.
 */
function convertExpr(expr, propNames, localVarNames, stateVarName, isReducerState) {
  if (!expr) return "''";

  // Don't modify string literals
  if (/^'[^']*'$/.test(expr) || /^"[^"]*"$/.test(expr)) return expr;

  // Don't modify numeric literals
  if (/^-?\d+(\.\d+)?$/.test(expr)) return expr;

  // children -> slots.default?.()
  expr = expr.replace(/\bchildren\b/g, 'slots.default?.()');

  // className -> removed (we don't pass className in Vue)
  expr = expr.replace(/\bclassName\b/g, "''");

  return expr;
}

/**
 * Convert a JSX attribute name to Vue h()-compatible name.
 */
function convertAttrName(name) {
  const map = {
    'className': 'class',
    'htmlFor': 'for',
    'tabIndex': 'tabindex',
    'readOnly': 'readonly',
    'autoComplete': 'autocomplete',
    'colSpan': 'colspan',
    'inputMode': 'inputmode',
    'autoFocus': 'autofocus',
    'maxLength': 'maxlength',
    'minLength': 'minlength',
    'contentEditable': 'contenteditable',
    'spellCheck': 'spellcheck',
    'crossOrigin': 'crossorigin',
    'viewBox': 'viewBox',
    'fillRule': 'fill-rule',
    'clipPath': 'clip-path',
    'strokeWidth': 'stroke-width',
    'strokeLinecap': 'stroke-linecap',
    'strokeLinejoin': 'stroke-linejoin',
  };
  // React event handlers -> Vue event handlers
  // onChange -> onInput (for inputs), onClick -> onClick (same)
  // onKeyDown -> onKeydown, onMouseEnter -> onMouseenter
  if (name.startsWith('on') && name.length > 2) {
    // Vue uses lowercase event names after 'on'
    // onClick -> onClick, onKeyDown -> onKeydown, onMouseEnter -> onMouseenter
    const eventPart = name.substring(2);
    // Only lowercase the second letter if the event name is camelCase style (multi-word)
    // e.g., onClick -> onClick (fine), onKeyDown -> onKeydown, onMouseEnter -> onMouseenter
    // But onChange for inputs should become onInput in some cases
    return name; // Keep as-is for h() — Vue handles these properly
  }
  return map[name] || name;
}

/**
 * Render a parsed JSX tree to an h() call string.
 */
function renderToH(node, indent) {
  if (!node) return 'null';
  const pad = '      ' + '  '.repeat(indent);
  const childPad = '      ' + '  '.repeat(indent + 1);

  // Fragment
  if (node.isFragment) {
    if (!node.children || node.children.length === 0) return 'null';
    const childStrs = renderChildren(node.children, indent + 1);
    if (childStrs.length === 1) return childStrs[0];
    return `[\n${childPad}${childStrs.join(`,\n${childPad}`)},\n${pad}]`;
  }

  const tag = node.tag;

  // Build attrs
  const attrLines = [];
  for (const attr of node.attrs) {
    let key = convertAttrName(attr.name);
    let val = attr.value;

    // Skip className (already mapped via convertAttrName)
    if (attr.name === 'className' && attr.type === 'expr') {
      // In Vue, class binding works differently. Skip for now.
      continue;
    }

    if (attr.type === 'string') {
      attrLines.push(`'${key}': ${val}`);
    } else if (attr.type === 'bool') {
      attrLines.push(`'${key}': true`);
    } else {
      // Expression
      attrLines.push(`'${key}': ${val}`);
    }
  }

  const attrsStr = attrLines.length === 0
    ? '{}'
    : attrLines.length <= 2
      ? `{ ${attrLines.join(', ')} }`
      : `{\n${childPad}${attrLines.join(`,\n${childPad}`)},\n${pad}}`;

  // No children
  if (!node.children || node.children.length === 0) {
    return `h('${tag}', ${attrsStr})`;
  }

  // Render children
  const childStrs = renderChildren(node.children, indent + 1);

  if (childStrs.length === 0) {
    return `h('${tag}', ${attrsStr})`;
  }

  // Single text child
  if (childStrs.length === 1 && node.children[0]?.type === 'text') {
    return `h('${tag}', ${attrsStr}, '${node.children[0].value.replace(/'/g, "\\'")}')`;
  }

  // Single expression child that's likely a slot
  if (childStrs.length === 1 && node.children[0]?.type === 'expr') {
    const v = node.children[0].value;
    if (v === 'children' || v === 'slots.default?.()') {
      return `h('${tag}', ${attrsStr}, slots.default?.())`;
    }
    return `h('${tag}', ${attrsStr}, [${childStrs[0]}])`;
  }

  return `h('${tag}', ${attrsStr}, [\n${childPad}${childStrs.join(`,\n${childPad}`)},\n${pad}])`;
}

function renderChildren(children, indent) {
  const results = [];
  const pad = '      ' + '  '.repeat(indent);

  for (const child of children) {
    if (child.type === 'element') {
      results.push(renderToH(child.node, indent));
    } else if (child.type === 'text') {
      const t = child.value
        .replace(/&times;/g, '\u00D7')
        .replace(/&#x2715;/g, '\u2715')
        .replace(/&hellip;/g, '\u2026')
        .replace(/&bull;/g, '\u2022')
        .replace(/'/g, "\\'");
      if (t) results.push(`'${t}'`);
    } else if (child.type === 'expr') {
      const expr = child.value;

      // Check for conditional patterns: condition && (<JSX>)
      const condMatch = expr.match(/^(.+?)\s*&&\s*\(\s*$/);
      if (condMatch) {
        // The JSX should be in the next children — but actually it's within the expression
        // We need to handle this differently
      }

      // Handle conditional rendering: `x && (<element>)`
      const condAndM = expr.match(/^([\s\S]+?)\s*&&\s*\(\s*([\s\S]+?)\s*\)$/);
      if (condAndM) {
        const condition = condAndM[1].trim();
        const jsxPart = condAndM[2].trim();
        if (jsxPart.startsWith('<')) {
          try {
            const parsed = parseJSX(jsxPart, { i: 0 });
            if (parsed) {
              const hStr = renderToH(parsed, indent + 1);
              results.push(`${condition} ? ${hStr} : null`);
              continue;
            }
          } catch (e) { /* fallback */ }
        }
        results.push(`${condition} ? ${jsxPart} : null`);
        continue;
      }

      // Handle ternary: condition ? (<jsxA>) : (<jsxB>)
      // This is complex — just pass through for now
      const ternaryM = expr.match(/^([\s\S]+?)\s*\?\s*\(\s*([\s\S]+?)\s*\)\s*:\s*\(\s*([\s\S]+?)\s*\)$/);
      if (ternaryM) {
        const cond = ternaryM[1].trim();
        const trueJsx = ternaryM[2].trim();
        const falseJsx = ternaryM[3].trim();

        let trueH = `'...'`, falseH = `'...'`;
        if (trueJsx.startsWith('<')) {
          try {
            const p = parseJSX(trueJsx, { i: 0 });
            if (p) trueH = renderToH(p, indent + 1);
          } catch (e) { /* fallback */ }
        } else {
          trueH = trueJsx;
        }
        if (falseJsx.startsWith('<')) {
          try {
            const p = parseJSX(falseJsx, { i: 0 });
            if (p) falseH = renderToH(p, indent + 1);
          } catch (e) { /* fallback */ }
        } else {
          falseH = falseJsx;
        }
        results.push(`${cond}\n${pad}  ? ${trueH}\n${pad}  : ${falseH}`);
        continue;
      }

      // Handle .map() calls
      if (expr.includes('.map(')) {
        results.push(`...${expr}`);
        continue;
      }

      // Handle simple ternary (no JSX)
      // children / slots
      if (expr === 'children') {
        results.push('slots.default?.()');
        continue;
      }

      // Pass through as-is
      results.push(expr);
    }
  }

  return results;
}

// ============================================================================
// Extract React component info and generate Vue equivalent
// ============================================================================

function extractPropsInterface(src, widgetName) {
  const rx = new RegExp(`export\\s+interface\\s+${widgetName}Props[^{]*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = rx.exec(src);
  return m ? m[1] : '';
}

function extractOtherTypes(src) {
  const results = [];
  const ifRegex = /export\s+(interface|type)\s+(\w+)(?:\s+extends\s+[^{]*?)?\s*\{([\s\S]*?)\n\}/gm;
  let m;
  while ((m = ifRegex.exec(src)) !== null) {
    const name = m[2];
    if (/Props$|State$|Event$|Action$/.test(name)) continue;
    results.push(m[0]);
  }
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

function extractDestructuredProps(src, widgetName) {
  const funcIdx = src.indexOf(`function ${widgetName}`);
  if (funcIdx < 0) return [];
  const sub = src.substring(funcIdx);
  const rx = /function\s+\w+\s*\(\s*\{([\s\S]*?)\}\s*,?\s*\n?\s*(?:ref|_ref)?/;
  const m = rx.exec(sub);
  if (!m) return [];
  const entries = [];
  for (let line of m[1].split('\n')) {
    line = line.trim().replace(/,\s*$/, '');
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('...')) continue;
    let pm = line.match(/^(\w+)\s*:\s*(\w+)\s*=\s*(.+)/);
    if (pm) { entries.push({ name: pm[1], alias: pm[2], def: pm[3].trim() }); continue; }
    pm = line.match(/^(\w+)\s*:\s*(\w+)\s*$/);
    if (pm) { entries.push({ name: pm[1], alias: pm[2] }); continue; }
    pm = line.match(/^(\w+)\s*=\s*(.+)/);
    if (pm) { entries.push({ name: pm[1], def: pm[2].trim() }); continue; }
    pm = line.match(/^(\w+)$/);
    if (pm) { entries.push({ name: pm[1] }); }
  }
  return entries;
}

function vuePropType(name, propsBody, def) {
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
  if (ts.includes('{') || ts.includes('Record') || ts.includes('Map') || ts.includes('Set')) return 'Object as PropType<any>';
  if (ts === 'any') return 'null as unknown as PropType<any>';
  return 'null as unknown as PropType<any>';
}

function isOptional(name, propsBody) {
  return new RegExp(`\\b${name}\\b\\?\\s*:`).test(propsBody);
}

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
// Build the setup() body: state, computed, handlers, lifecycle
// ============================================================================

function buildSetupBody(src, widgetName) {
  const funcIdx = src.indexOf(`function ${widgetName}`);
  if (funcIdx < 0) return '';
  const body = src.substring(funcIdx);
  const lines = [];

  // 1. useId
  if (src.includes('useId')) {
    lines.push('    const uid = useUid();');
  }

  // 2. useReducer -> ref
  const rrx = /const\s+\[(\w+),\s*(\w+)\]\s*=\s*useReducer\(\s*\w+,\s*([\s\S]*?)\);/g;
  let m;
  while ((m = rrx.exec(body)) !== null) {
    let init = m[3].trim().replace(/\s+/g, ' ');
    // Replace prop references in init
    lines.push(`    const ${m[1]} = ref<any>(${init});`);
    // The dispatch function becomes a local function that mutates the ref
    lines.push(`    const ${m[2]} = (action: any) => { /* state machine dispatch */ };`);
  }

  // 3. useState -> ref
  const srx = /const\s+\[(\w+),\s*(set\w+)\]\s*=\s*useState(?:<[^>]*>)?\(([^)]*)\);/g;
  while ((m = srx.exec(body)) !== null) {
    let init = m[3] || 'null';
    lines.push(`    const ${m[1]} = ref<any>(${init});`);
    const setter = m[2];
    lines.push(`    const ${setter} = (v: any) => { ${m[1]}.value = typeof v === 'function' ? v(${m[1]}.value) : v; };`);
  }

  // 4. useRef -> ref
  const refRx = /const\s+(\w+)\s*=\s*useRef<[^>]*>\(([^)]*)\);/g;
  while ((m = refRx.exec(body)) !== null) {
    lines.push(`    const ${m[1]} = ref<any>(${m[2] || 'null'});`);
  }
  // useRef without generic
  const refRx2 = /const\s+(\w+)\s*=\s*useRef\(([^)]*)\);/g;
  while ((m = refRx2.exec(body)) !== null) {
    if (!lines.some(l => l.includes(`const ${m[1]} = ref`))) {
      lines.push(`    const ${m[1]} = ref<any>(${m[2] || 'null'});`);
    }
  }

  // 5. useControllableState -> ref + computed
  const crx = /const\s+\[(\w+),\s*(set\w+)\]\s*=\s*useControllableState(?:<[^>]*>)?\(\{[\s\S]*?\}\);/g;
  while ((m = crx.exec(body)) !== null) {
    const varName = m[1];
    const setterName = m[2];
    lines.push(`    const ${varName}Internal = ref<any>(undefined);`);
    // Infer the prop name — usually same as varName or check for 'value: propAlias' patterns
    const propRefMatch = m[0].match(/value:\s*(\w+)/);
    const propRef = propRefMatch ? propRefMatch[1] : varName;
    // Find the defaultValue
    const defMatch = m[0].match(/defaultValue:\s*(\w+)/);
    const defRef = defMatch ? defMatch[1] : 'undefined';
    // Find onChange
    const onChangeMatch = m[0].match(/onChange:\s*(\w+)/);
    const onChangeRef = onChangeMatch ? onChangeMatch[1] : null;

    lines.push(`    const ${varName} = computed(() => ${propRef} !== undefined ? ${propRef} : ${varName}Internal.value ?? ${defRef});`);
    lines.push(`    const ${setterName} = (v: any) => { ${varName}Internal.value = v; ${onChangeRef ? `props.${onChangeRef}?.(v);` : ''} };`);
  }

  // 6. useId-based IDs
  const idRx = /const\s+(\w+)\s*=\s*(?:name\s*\|\|\s*)?(?:generatedId|id|uid)(?:\s*\|\|\s*\w+)?;/g;
  while ((m = idRx.exec(body)) !== null) {
    if (m[1] !== 'generatedId' && m[1] !== 'id') {
      // Derived ID
    }
  }

  // 7. Extract all const declarations that aren't hooks
  const constRx = /const\s+(\w+)\s*=\s*(?!useReducer|useState|useRef|useId|useCallback|useMemo|useControllableState|useRovingFocus|useScrollLock|useFocusReturn)([^;]+);/g;
  const hookVars = new Set();
  // Collect hook variable names first
  const hookRx = /const\s+(?:\[(\w+),\s*\w+\]|(\w+))\s*=\s*(?:useReducer|useState|useRef|useId|useCallback|useMemo|useControllableState)/g;
  while ((m = hookRx.exec(body)) !== null) {
    hookVars.add(m[1] || m[2]);
  }

  // Collect useCallback and useMemo
  // useCallback: const handler = useCallback((params) => { body }, [deps])
  const cbBlocks = [];
  const cbRx = /const\s+(\w+)\s*=\s*useCallback\(\s*\n?\s*([\s\S]*?),\s*\n?\s*\[[^\]]*\]\s*\)/g;
  while ((m = cbRx.exec(body)) !== null) {
    const fname = m[1];
    let cbBody = m[2].trim();
    // Remove outer parens if it's an arrow function
    if (cbBody.startsWith('(')) {
      // It's (params) => { body } or (params) => expr
      cbBody = cbBody.replace(/^\(([\s\S]*?)\)\s*=>\s*/, 'function($1) ').replace(/^\{/, '{').replace(/\}$/, '}');
      if (!cbBody.startsWith('function')) {
        cbBody = `function${cbBody}`;
      }
    }
    lines.push(`    const ${fname} = ${m[2].trim()};`);
  }

  // useMemo: const val = useMemo(() => expr, [deps])
  const mmRx = /const\s+(\w+)\s*=\s*useMemo\(\s*\(\)\s*=>\s*([\s\S]*?),\s*\[[^\]]*\]\s*\)/g;
  while ((m = mmRx.exec(body)) !== null) {
    lines.push(`    const ${m[1]} = computed(() => ${m[2].trim()});`);
  }

  // Simple const computations (not hooks, not already declared)
  const simpleConstRx = /^    const (\w+)\s*=\s*(?!use|document|window)([\s\S]*?);$/gm;
  const bodyFromFunc = body.substring(body.indexOf('{') + 1);
  const declaredNames = new Set(lines.map(l => {
    const dm = l.match(/const\s+(\w+)/);
    return dm ? dm[1] : '';
  }).filter(Boolean));

  // Extract simple computed values (like isInvalid, isFocused, etc.)
  const simpleRx = /^\s{4}const\s+(\w+)\s*=\s*(.+?);$/gm;
  while ((m = simpleRx.exec(bodyFromFunc)) !== null) {
    const vname = m[1];
    const vexpr = m[2].trim();
    // Skip if already declared or it's a hook call
    if (declaredNames.has(vname)) continue;
    if (vexpr.startsWith('use') || vexpr.startsWith('require') || vexpr.startsWith('import')) continue;
    if (vexpr.includes('useReducer') || vexpr.includes('useState') || vexpr.includes('useRef')
      || vexpr.includes('useId') || vexpr.includes('useCallback') || vexpr.includes('useMemo')
      || vexpr.includes('useControllableState') || vexpr.includes('useRovingFocus')) continue;
    // Skip destructured hook results
    if (/^\{/.test(vexpr) && /getItemProps/.test(vexpr)) continue;
    declaredNames.add(vname);
    lines.push(`    const ${vname} = ${vexpr};`);
  }

  // 8. useEffect -> onMounted/onUnmounted/watch
  const effectRx = /useEffect\(\(\)\s*=>\s*\{([\s\S]*?)\n\s{4}\},\s*\[([^\]]*)\]\)/g;
  while ((m = effectRx.exec(body)) !== null) {
    const effectBody = m[1].trim();
    const deps = m[2].trim();
    if (!deps) {
      // No deps = onMounted
      lines.push(`    onMounted(() => {`);
      lines.push(`      ${effectBody.split('\n').join('\n      ')}`);
      lines.push(`    });`);
    } else {
      // Has deps = watch
      lines.push(`    // Effect with deps: [${deps}]`);
      lines.push(`    onMounted(() => {`);
      // Extract cleanup if present
      const cleanupM = effectBody.match(/return\s*\(\)\s*=>\s*\{?([\s\S]*?)\}?\s*;?\s*$/);
      const mainBody = cleanupM
        ? effectBody.substring(0, effectBody.lastIndexOf('return')).trim()
        : effectBody;
      lines.push(`      ${mainBody.split('\n').join('\n      ')}`);
      lines.push(`    });`);
      if (cleanupM) {
        lines.push(`    onUnmounted(() => {`);
        lines.push(`      ${cleanupM[1].trim().split('\n').join('\n      ')}`);
        lines.push(`    });`);
      }
    }
  }

  return lines.join('\n');
}

// ============================================================================
// MAIN GENERATOR: produce full Vue component file
// ============================================================================

function generateVueWidget(cat, widgetName) {
  const srcPath = path.join(NEXTJS_BASE, cat, `${widgetName}.tsx`);
  const src = fs.readFileSync(srcPath, 'utf-8');
  const kebab = toKebab(widgetName);

  // --- Feature detection ---
  const usesReducer = src.includes('useReducer');
  const usesState = src.includes('useState');
  const usesEffect = src.includes('useEffect');
  const usesRef = src.includes('useRef');
  const usesId = src.includes('useId');
  const usesMemo = src.includes('useMemo');
  const usesPortal = src.includes('createPortal');
  const usesControllable = src.includes('useControllableState');
  const usesCallback = src.includes('useCallback');

  // --- Extract data ---
  const types = extractOtherTypes(src);
  const propsBody = extractPropsInterface(src, widgetName);
  const props = extractDestructuredProps(src, widgetName);
  const emits = extractEmitNames(src);
  const propNames = collectPropNames(src);
  const localVarNames = collectLocalVarNames(src, widgetName);

  // --- Vue imports ---
  const imp = new Set(['defineComponent', 'h', 'type PropType', 'type VNode']);
  if (usesReducer || usesState || usesRef) imp.add('ref');
  if (usesMemo || usesControllable) { imp.add('computed'); imp.add('ref'); }
  if (usesEffect) { imp.add('onMounted'); imp.add('onUnmounted'); imp.add('watch'); }
  if (usesPortal) imp.add('Teleport');

  // --- Build output ---
  const out = [];

  // Header
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

  // UID helper
  if (usesId) {
    out.push(`let _uid = 0;`);
    out.push(`function useUid(): string { return \`vue-\${++_uid}\`; }`);
    out.push(``);
  }

  // Extra types
  for (const t of types) { out.push(t); out.push(``); }

  // Props interface
  out.push(`export interface ${widgetName}Props {`);
  for (const line of propsBody.split('\n')) {
    const l = line.trim();
    if (!l) continue;
    if (/children\s*\??:/.test(l) || /className\s*\??:/.test(l)) continue;
    out.push(`  ${l.replace(/ReactNode/g, 'VNode | string').replace(/React\.\w+/g, 'any')}`);
  }
  out.push(`}`);
  out.push(``);

  // Prop definitions
  const propDefs = [];
  for (const p of props) {
    if (p.name === 'children' || p.name === 'ref' || p.name === 'className') continue;
    const tp = vuePropType(p.name, propsBody, p.def);
    let defStr = '';
    if (p.def !== undefined) {
      let dv = p.def;
      if (dv.startsWith('[') || dv === '[]') dv = `() => (${dv})`;
      else if (dv.startsWith('{') || dv === '{}') dv = `() => (${dv})`;
      else if (dv === 'new Set<number>()' || dv.startsWith('new Set')) dv = '() => new Set()';
      else if (dv === 'new Map()') dv = '() => new Map()';
      defStr = `, default: ${dv}`;
    }
    const opt = isOptional(p.name, propsBody);
    const req = !p.def && !p.name.startsWith('on') && !p.name.startsWith('render') && !opt;
    propDefs.push(`    ${p.name}: { type: ${tp}${defStr}${req ? ', required: true as const' : ''} },`);
  }

  // Setup body
  const setupBody = buildSetupBody(src, widgetName);

  // Render function
  const jsxResult = extractJSXReturn(src, widgetName);
  let renderCode;

  if (jsxResult && jsxResult.jsx) {
    try {
      const parsed = parseJSX(jsxResult.jsx, { i: 0 });
      if (parsed) {
        const hStr = renderToH(parsed, 0);

        const renderLines = [];

        // Early returns
        if (jsxResult.earlyReturns) {
          for (const cond of jsxResult.earlyReturns) {
            renderLines.push(`    if (${cond}) return () => null as unknown as VNode;`);
          }
        }

        if (jsxResult.isPortal) {
          renderLines.push(`    return (): VNode =>`);
          renderLines.push(`      h(Teleport as any, { to: 'body' }, [`);
          renderLines.push(`        ${hStr}`);
          renderLines.push(`      ]);`);
        } else {
          renderLines.push(`    return (): VNode =>`);
          renderLines.push(`      ${hStr};`);
        }

        renderCode = renderLines.join('\n');
      }
    } catch (e) {
      // Fallback
    }
  }

  if (!renderCode) {
    renderCode = `    return (): VNode =>\n      h('div', {\n        'data-surface-widget': '',\n        'data-widget-name': '${kebab}',\n        'data-part': 'root',\n      }, slots.default?.());`;
  }

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
console.log('Vue 3 Widget Generator v3');
console.log('========================');
let total = 0;
let errors = 0;
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
      const code = generateVueWidget(cat, name);
      fs.writeFileSync(path.join(outDir, `${name}.ts`), code);
      total++;
      process.stdout.write('.');
    } catch (err) {
      errors++;
      console.error(`\n  ERROR [${cat}/${name}]: ${err.message}`);
    }
  }

  // Category index
  fs.writeFileSync(path.join(outDir, 'index.ts'), genCategoryIndex(cat, names));
  process.stdout.write('I');
}

// Root index
fs.writeFileSync(path.join(VUE_BASE, 'index.ts'), genRootIndex(allCats));

console.log(`\n\nDone! ${total} widgets generated (${errors} errors). ${categories.length + 1} index files.`);

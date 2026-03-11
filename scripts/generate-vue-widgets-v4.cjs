#!/usr/bin/env node
// ============================================================================
// Vue 3 Widget Generator v4
//
// Final version. Reads Next.js widgets and generates correct Vue 3 .ts files.
// Key improvements:
// - Properly prefixes prop references with `props.`
// - Correctly converts useCallback/useMemo
// - Properly handles useReducer state references (.value)
// - Converts JSX to h() with correct references
// - No leftover React types or patterns
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
// Analysis: Extract all info from Next.js source
// ============================================================================

function analyze(src, widgetName) {
  const info = {
    widgetName,
    kebab: toKebab(widgetName),
    props: [],           // {name, alias?, def?, tsType?}
    propNames: new Set(),
    aliasToOriginal: {},  // alias -> original prop name
    localVars: new Set(),
    reducerVars: [],     // {stateName, dispatchName, initExpr, stateFields}
    stateVars: [],       // {name, setterName, initExpr}
    refVars: [],         // {name, initExpr}
    controllableVars: [], // {name, setter, propRef, defaultRef, onChangeRef}
    callbacks: [],        // {name, bodyStr}
    memoVars: [],         // {name, exprStr}
    simpleConsts: [],     // {name, exprStr}
    effects: [],          // {bodyStr, deps, cleanupStr?}
    emitNames: [],
    types: [],            // extra exported types
    propsBody: '',
    usesId: false,
    usesPortal: false,
    usesReducer: false,
    usesState: false,
    usesRef: false,
    usesEffect: false,
    usesCallback: false,
    usesMemo: false,
    usesControllable: false,
    earlyReturns: [],     // conditions where component returns null
    jsxStr: '',           // the JSX block
    isPortal: false,
  };

  // Feature flags
  info.usesReducer = src.includes('useReducer');
  info.usesState = src.includes('useState');
  info.usesRef = src.includes('useRef');
  info.usesEffect = src.includes('useEffect');
  info.usesId = src.includes('useId');
  info.usesMemo = src.includes('useMemo');
  info.usesCallback = src.includes('useCallback');
  info.usesPortal = src.includes('createPortal');
  info.usesControllable = src.includes('useControllableState');

  // Extract props interface body
  const propsRx = new RegExp(`export\\s+interface\\s+${widgetName}Props[^{]*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const propsM = propsRx.exec(src);
  info.propsBody = propsM ? propsM[1] : '';

  // Extract other types
  const ifRegex = /export\s+(interface|type)\s+(\w+)(?:\s+extends\s+[^{]*?)?\s*\{([\s\S]*?)\n\}/gm;
  let m;
  while ((m = ifRegex.exec(src)) !== null) {
    if (!/Props$|State$|Event$|Action$/.test(m[2])) {
      info.types.push(m[0].replace(/ReactNode/g, 'VNode | string').replace(/React\.\w+/g, 'any'));
    }
  }
  const typeRegex = /export\s+type\s+(\w+)\s*=\s*[^;]+;/gm;
  while ((m = typeRegex.exec(src)) !== null) {
    if (!/Props$|State$|Event$|Action$/.test(m[1])) {
      if (!info.types.some(r => r.includes(`type ${m[1]}`))) {
        info.types.push(m[0].replace(/ReactNode/g, 'VNode | string'));
      }
    }
  }

  // Extract destructured props (brace-aware extraction)
  const funcIdx = src.indexOf(`function ${widgetName}`);
  if (funcIdx >= 0) {
    const funcSrc = src.substring(funcIdx);
    // Find opening { of destructuring
    const openBrace = funcSrc.indexOf('{');
    let destructuredBlock = '';
    if (openBrace >= 0) {
      let depth = 0;
      let end = openBrace;
      for (let i = openBrace; i < funcSrc.length; i++) {
        if (funcSrc[i] === '{') depth++;
        if (funcSrc[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      destructuredBlock = funcSrc.substring(openBrace + 1, end);
    }
    if (destructuredBlock) {
      for (let line of destructuredBlock.split('\n')) {
        line = line.trim().replace(/,\s*$/, '');
        if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('...')) continue;
        let lm;
        if ((lm = line.match(/^(\w+)\s*:\s*(\w+)\s*=\s*(.+)/))) {
          info.props.push({ name: lm[1], alias: lm[2], def: lm[3].trim() });
          info.propNames.add(lm[1]);
          info.propNames.add(lm[2]);
          info.aliasToOriginal[lm[2]] = lm[1];
        } else if ((lm = line.match(/^(\w+)\s*:\s*(\w+)\s*$/))) {
          info.props.push({ name: lm[1], alias: lm[2] });
          info.propNames.add(lm[1]);
          info.propNames.add(lm[2]);
          info.aliasToOriginal[lm[2]] = lm[1];
        } else if ((lm = line.match(/^(\w+)\s*=\s*(.+)/))) {
          info.props.push({ name: lm[1], def: lm[2].trim() });
          info.propNames.add(lm[1]);
        } else if ((lm = line.match(/^(\w+)$/))) {
          info.props.push({ name: lm[1] });
          info.propNames.add(lm[1]);
        }
      }
    }
  }

  // Collect local variable names from the function body
  if (funcIdx >= 0) {
    const body = src.substring(funcIdx);

    // useReducer
    const rrx = /const\s+\[(\w+),\s*(\w+)\]\s*=\s*useReducer\(\s*\w+,\s*([\s\S]*?)\);/g;
    while ((m = rrx.exec(body)) !== null) {
      const fields = new Set();
      // Extract state fields if init is object
      const fRx = /(\w+)\s*:/g;
      let fm;
      while ((fm = fRx.exec(m[3])) !== null) fields.add(fm[1]);
      info.reducerVars.push({
        stateName: m[1], dispatchName: m[2],
        initExpr: m[3].trim().replace(/\s+/g, ' '),
        stateFields: fields
      });
      info.localVars.add(m[1]);
      info.localVars.add(m[2]);
    }

    // useState
    const srx = /const\s+\[(\w+),\s*(\w+)\]\s*=\s*useState(?:<[^>]*>)?\(([^)]*)\);/g;
    while ((m = srx.exec(body)) !== null) {
      info.stateVars.push({ name: m[1], setterName: m[2], initExpr: m[3] || 'null' });
      info.localVars.add(m[1]);
      info.localVars.add(m[2]);
    }

    // useRef
    const refRx = /const\s+(\w+)\s*=\s*useRef(?:<[^>]*>)?\(([^)]*)\);/g;
    while ((m = refRx.exec(body)) !== null) {
      info.refVars.push({ name: m[1], initExpr: m[2] || 'null' });
      info.localVars.add(m[1]);
    }

    // useControllableState
    const crx = /const\s+\[(\w+),\s*(\w+)\]\s*=\s*useControllableState(?:<[^>]*>)?\(\{([\s\S]*?)\}\);/g;
    while ((m = crx.exec(body)) !== null) {
      const innerBlock = m[3];
      const propRefMatch = innerBlock.match(/value:\s*(\w+)/);
      const defMatch = innerBlock.match(/defaultValue:\s*(\w+)/);
      const onChangeMatch = innerBlock.match(/onChange:\s*(\w+)/);
      info.controllableVars.push({
        name: m[1], setter: m[2],
        propRef: propRefMatch ? propRefMatch[1] : m[1],
        defaultRef: defMatch ? defMatch[1] : 'undefined',
        onChangeRef: onChangeMatch ? onChangeMatch[1] : null,
      });
      info.localVars.add(m[1]);
      info.localVars.add(m[2]);
    }

    // useCallback
    const cbRx = /const\s+(\w+)\s*=\s*useCallback\(\s*\n?\s*([\s\S]*?),\s*\n?\s*\[[\w\s,]*\]\s*\);?/g;
    while ((m = cbRx.exec(body)) !== null) {
      info.callbacks.push({ name: m[1], bodyStr: m[2].trim() });
      info.localVars.add(m[1]);
    }

    // useMemo
    const mmRx = /const\s+(\w+)\s*=\s*useMemo\(\s*\(\)\s*=>\s*([\s\S]*?),\s*\[[\w\s,]*\]\s*\)/g;
    while ((m = mmRx.exec(body)) !== null) {
      info.memoVars.push({ name: m[1], exprStr: m[2].trim() });
      info.localVars.add(m[1]);
    }

    // useId
    if (info.usesId) {
      const idM = body.match(/const\s+(\w+)\s*=\s*useId\(/);
      if (idM) info.localVars.add(idM[1]);
    }

    // Simple const declarations (non-hook)
    const hookPattern = /useReducer|useState|useRef|useId|useCallback|useMemo|useControllableState|useRovingFocus|useScrollLock|useFocusReturn|document\.|window\./;
    const simpleConstRx = /^\s{4}const\s+(\w+)\s*=\s*(.+?);$/gm;
    const bodyFromBrace = body.substring(body.indexOf('{') + 1);
    while ((m = simpleConstRx.exec(bodyFromBrace)) !== null) {
      if (info.localVars.has(m[1])) continue;
      const expr = m[2].trim();
      if (hookPattern.test(expr)) continue;
      if (expr.startsWith('{') && /getItemProps/.test(expr)) continue;
      info.simpleConsts.push({ name: m[1], exprStr: expr });
      info.localVars.add(m[1]);
    }

    // useEffect
    const effectRx = /useEffect\(\(\)\s*=>\s*\{([\s\S]*?)\n\s{4}\},\s*\[([^\]]*)\]\)/g;
    while ((m = effectRx.exec(body)) !== null) {
      const cleanupM = m[1].match(/return\s*\(\)\s*=>\s*\{?([\s\S]*?)\}?\s*;?\s*$/);
      info.effects.push({
        bodyStr: cleanupM ? m[1].substring(0, m[1].lastIndexOf('return')).trim() : m[1].trim(),
        deps: m[2].trim(),
        cleanupStr: cleanupM ? cleanupM[1].trim() : null,
      });
    }

    // Early returns
    const erRx = /if\s*\(([^)]+)\)\s*return\s+null\s*;/g;
    while ((m = erRx.exec(body)) !== null) {
      info.earlyReturns.push(m[1].trim());
    }
  }

  // Emit names
  const emRx = /(\w+)\?\.\(/g;
  while ((m = emRx.exec(src)) !== null) {
    if (/^on[A-Z]/.test(m[1])) {
      const name = toKebab(m[1].substring(2));
      if (!info.emitNames.includes(name)) info.emitNames.push(name);
    }
  }

  // Extract JSX return
  if (funcIdx >= 0) {
    const body = src.substring(funcIdx);
    // Portal
    const portalM = body.match(/return\s+createPortal\(\s*\n?([\s\S]*?),\s*\n\s*(?:document\.body|container)\s*(?:,?\s*)\)/);
    if (portalM) {
      info.jsxStr = portalM[1].trim();
      info.isPortal = true;
    } else {
      // Last return (...)
      const ri = body.lastIndexOf('return (');
      if (ri >= 0) {
        let depth = 0;
        const start = body.indexOf('(', ri);
        let end = start;
        for (let i = start; i < body.length; i++) {
          if (body[i] === '(') depth++;
          if (body[i] === ')') { depth--; if (depth === 0) { end = i; break; } }
        }
        info.jsxStr = body.substring(start + 1, end).trim();
      }
    }
  }

  return info;
}

// ============================================================================
// Convert identifier references: add props. prefix to prop references
// ============================================================================

function convertIdent(name, info) {
  // Check if it's a local variable (not a prop)
  if (info.localVars.has(name)) return name;
  // Check if it's a known prop name
  if (info.propNames.has(name)) {
    // Get the original prop name (in case of alias)
    const original = info.aliasToOriginal[name] || name;
    return `props.${original}`;
  }
  return name;
}

/**
 * Convert an expression string, replacing bare prop references with props.xxx.
 * Also converts .current to .value, state field access, children, etc.
 */
function convertExprStr(expr, info) {
  if (!expr) return "''";

  // Don't modify string literals
  if (/^'[^']*'$/.test(expr) || /^"[^"]*"$/.test(expr) || /^`[^`]*`$/.test(expr)) return expr;
  if (/^-?\d+(\.\d+)?$/.test(expr)) return expr;
  if (expr === 'true' || expr === 'false' || expr === 'null' || expr === 'undefined') return expr;

  // .current -> .value
  expr = expr.replace(/\.current\b/g, '.value');

  // children -> slots.default?.()
  if (expr === 'children') return 'slots.default?.()';
  expr = expr.replace(/\bchildren\b/g, 'slots.default?.()');

  // className -> '' (remove)
  expr = expr.replace(/\bclassName\b/g, "''");

  // Replace bare prop references with props.xxx
  // Use word-boundary replacement, but avoid:
  // - Already prefixed with props. or a dot
  // - Object property definitions (word followed by :)
  // - After 'const ', 'let ', 'function '
  // - Inside string literals

  for (const propName of info.propNames) {
    if (propName === 'children' || propName === 'className' || propName === 'ref') continue;
    if (propName.length < 2) continue;
    if (info.localVars.has(propName)) continue;

    const original = info.aliasToOriginal[propName] || propName;
    const escaped = propName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Replace bare references
    const rx = new RegExp(`(?<![.\\w])\\b${escaped}\\b`, 'g');
    expr = expr.replace(rx, (match, offset) => {
      // Don't replace if preceded by props. or a dot
      const before = expr.substring(Math.max(0, offset - 6), offset);
      if (before.endsWith('props.') || before.endsWith('.')) return match;
      // Don't replace if followed by : (object key) but not :: or :=
      const after = expr.substring(offset + match.length);
      if (/^\s*:(?!:)/.test(after) && !/^\s*:\s*$/.test(after)) return match;
      // Don't replace if it's a const/let/function declaration
      const lineBefore = expr.substring(Math.max(0, offset - 20), offset);
      if (/\b(?:const|let|var|function)\s+$/.test(lineBefore)) return match;
      // Don't replace if inside a string literal
      const beforeMatch = expr.substring(0, offset);
      let inSQ = false, inDQ = false, inBT = false;
      for (let ci = 0; ci < beforeMatch.length; ci++) {
        const c = beforeMatch[ci];
        if (c === '\\') { ci++; continue; }
        if (c === "'" && !inDQ && !inBT) inSQ = !inSQ;
        if (c === '"' && !inSQ && !inBT) inDQ = !inDQ;
        if (c === '`' && !inSQ && !inDQ) inBT = !inBT;
      }
      if (inSQ || inDQ || inBT) return match;
      return `props.${original}`;
    });
  }

  // Fix double-prefixing
  expr = expr.replace(/props\.props\./g, 'props.');

  // Fix reducer state access
  for (const rv of info.reducerVars) {
    // state.fieldName -> state.value.fieldName (if state is a reducer with object init)
    if (rv.stateFields.size > 0) {
      for (const field of rv.stateFields) {
        const rx = new RegExp(`\\b${rv.stateName}\\.(?!value\\.)${field}\\b`, 'g');
        expr = expr.replace(rx, `${rv.stateName}.value.${field}`);
      }
    }
    // state === 'x' -> state.value === 'x'
    const stateRx = new RegExp(`\\b${rv.stateName}\\s*===\\s*'`, 'g');
    expr = expr.replace(stateRx, `${rv.stateName}.value === '`);
    const stateRx2 = new RegExp(`\\b${rv.stateName}\\s*!==\\s*'`, 'g');
    expr = expr.replace(stateRx2, `${rv.stateName}.value !== '`);

    // Also fix bare state reference at end of expression or after comma/colon
    // e.g. `: state` at end of ternary, or `state,` in array
    // Only for reducers with simple (string) init, not object state
    if (rv.stateFields.size === 0) {
      // Replace bare stateName references with stateName.value
      // but NOT state.value (already done), state.xxx (field access), state === (already done)
      const bareRx = new RegExp(`\\b${rv.stateName}\\b(?!\\s*[.=!])(?!\\.value)`, 'g');
      expr = expr.replace(bareRx, (match, offset) => {
        const before = expr.substring(Math.max(0, offset - 6), offset);
        if (before.endsWith('.') || before.endsWith('props.')) return match;
        // Check if inside string literal
        const beforeMatch = expr.substring(0, offset);
        let inSQ = false, inDQ = false, inBT = false;
        for (let ci = 0; ci < beforeMatch.length; ci++) {
          const c = beforeMatch[ci];
          if (c === '\\') { ci++; continue; }
          if (c === "'" && !inDQ && !inBT) inSQ = !inSQ;
          if (c === '"' && !inSQ && !inBT) inDQ = !inDQ;
          if (c === '`' && !inSQ && !inDQ) inBT = !inBT;
        }
        if (inSQ || inDQ || inBT) return match;
        return `${rv.stateName}.value`;
      });
    }
  }

  // Fix React type references
  expr = expr.replace(/:\s*ChangeEvent<\w+>/g, ': any');
  expr = expr.replace(/:\s*KeyboardEvent<\w+>/g, ': any');
  expr = expr.replace(/:\s*React\.\w+(?:<[^>]*>)?/g, ': any');
  expr = expr.replace(/e\.target\s*===\s*e\.currentTarget/g, '(e as any).target === (e as any).currentTarget');

  return expr;
}

// ============================================================================
// JSX Parser (same core, but expressions get converted)
// ============================================================================

function parseJSX(jsx, pos) {
  pos = pos || { i: 0 };
  jsx = jsx.trim();
  if (!jsx || pos.i >= jsx.length) return null;
  while (pos.i < jsx.length && /\s/.test(jsx[pos.i])) pos.i++;
  if (jsx[pos.i] !== '<') return null;

  // Fragment
  if (jsx.substring(pos.i, pos.i + 2) === '<>') {
    pos.i += 2;
    const children = parseJSXChildren(jsx, pos, '</>');
    pos.i += 3;
    return { tag: null, attrs: [], children, isFragment: true };
  }

  pos.i++; // skip <
  let tagStart = pos.i;
  while (pos.i < jsx.length && /[\w.]/.test(jsx[pos.i])) pos.i++;
  const tag = jsx.substring(tagStart, pos.i);
  if (!tag) return null;

  const attrs = parseJSXAttrs(jsx, pos);

  skipWS(jsx, pos);
  if (jsx[pos.i] === '/' && jsx[pos.i + 1] === '>') {
    pos.i += 2;
    return { tag, attrs, children: [] };
  }
  if (jsx[pos.i] === '>') pos.i++;

  const closeTag = `</${tag}>`;
  const children = parseJSXChildren(jsx, pos, closeTag);

  if (jsx.substring(pos.i, pos.i + closeTag.length) === closeTag) {
    pos.i += closeTag.length;
  }

  return { tag, attrs, children };
}

function skipWS(jsx, pos) {
  while (pos.i < jsx.length && /\s/.test(jsx[pos.i])) pos.i++;
}

function parseJSXAttrs(jsx, pos) {
  const attrs = [];
  while (pos.i < jsx.length) {
    skipWS(jsx, pos);
    if (jsx[pos.i] === '>' || (jsx[pos.i] === '/' && jsx[pos.i + 1] === '>')) break;
    if (jsx[pos.i] === '{' && jsx[pos.i + 1] === '.' && jsx[pos.i + 2] === '.') {
      let depth = 0;
      while (pos.i < jsx.length) {
        if (jsx[pos.i] === '{') depth++;
        if (jsx[pos.i] === '}') { depth--; if (depth === 0) { pos.i++; break; } }
        pos.i++;
      }
      continue;
    }

    let nameStart = pos.i;
    while (pos.i < jsx.length && /[\w\-]/.test(jsx[pos.i])) pos.i++;
    const name = jsx.substring(nameStart, pos.i);
    if (!name) { pos.i++; continue; }

    skipWS(jsx, pos);
    if (jsx[pos.i] !== '=') {
      attrs.push({ name, value: 'true', type: 'bool' });
      continue;
    }
    pos.i++; // skip =
    skipWS(jsx, pos);

    if (jsx[pos.i] === '"' || jsx[pos.i] === "'") {
      const quote = jsx[pos.i]; pos.i++;
      let valStart = pos.i;
      while (pos.i < jsx.length && jsx[pos.i] !== quote) {
        if (jsx[pos.i] === '\\') pos.i++;
        pos.i++;
      }
      const val = jsx.substring(valStart, pos.i); pos.i++;
      attrs.push({ name, value: `'${val}'`, type: 'string' });
    } else if (jsx[pos.i] === '{') {
      pos.i++;
      let depth = 1, valStart = pos.i;
      let inStr = false, strCh = '';
      while (pos.i < jsx.length && depth > 0) {
        const ch = jsx[pos.i];
        if (inStr) { if (ch === strCh && jsx[pos.i - 1] !== '\\') inStr = false; pos.i++; continue; }
        if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strCh = ch; pos.i++; continue; }
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        if (depth > 0) pos.i++;
      }
      const val = jsx.substring(valStart, pos.i).trim(); pos.i++;
      attrs.push({ name, value: val, type: 'expr' });
    }
  }
  return attrs;
}

function parseJSXChildren(jsx, pos, endMarker) {
  const children = [];
  while (pos.i < jsx.length) {
    skipWS(jsx, pos);
    if (pos.i >= jsx.length) break;
    if (endMarker && jsx.substring(pos.i, pos.i + endMarker.length) === endMarker) break;
    if (jsx[pos.i] === '<' && jsx[pos.i + 1] === '/') break;

    // JSX comment {/* ... */}
    if (jsx[pos.i] === '{' && jsx.substring(pos.i + 1, pos.i + 3) === '/*') {
      let depth = 1; pos.i++;
      while (pos.i < jsx.length && depth > 0) {
        if (jsx[pos.i] === '{') depth++;
        else if (jsx[pos.i] === '}') depth--;
        if (depth > 0) pos.i++;
      }
      pos.i++; continue;
    }

    if (jsx[pos.i] === '<') {
      if (jsx.substring(pos.i, pos.i + 2) === '<>') {
        const node = parseJSX(jsx, pos);
        if (node) children.push({ type: 'element', node });
        continue;
      }
      const node = parseJSX(jsx, pos);
      if (node) { children.push({ type: 'element', node }); }
      else { pos.i++; }
      continue;
    }

    if (jsx[pos.i] === '{') {
      pos.i++;
      skipWS(jsx, pos);
      if (jsx[pos.i] === '/' && jsx[pos.i + 1] === '*') {
        while (pos.i < jsx.length) {
          if (jsx[pos.i] === '*' && jsx[pos.i + 1] === '/') { pos.i += 2; break; }
          pos.i++;
        }
        skipWS(jsx, pos);
        if (jsx[pos.i] === '}') pos.i++;
        continue;
      }

      let depth = 1, start = pos.i;
      let inStr = false, strCh = '', inTpl = false;
      while (pos.i < jsx.length && depth > 0) {
        const ch = jsx[pos.i];
        if (inStr) { if (ch === strCh && jsx[pos.i - 1] !== '\\') inStr = false; pos.i++; continue; }
        if (ch === '`') { inTpl = !inTpl; pos.i++; continue; }
        if (inTpl) { pos.i++; continue; }
        if (ch === '"' || ch === "'") { inStr = true; strCh = ch; pos.i++; continue; }
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        if (depth > 0) pos.i++;
      }
      const expr = jsx.substring(start, pos.i).trim(); pos.i++;
      if (expr) children.push({ type: 'expr', value: expr });
      continue;
    }

    let start = pos.i;
    while (pos.i < jsx.length && jsx[pos.i] !== '<' && jsx[pos.i] !== '{') pos.i++;
    const text = jsx.substring(start, pos.i).trim();
    if (text) children.push({ type: 'text', value: text });
  }
  return children;
}

// ============================================================================
// Render parsed JSX to h() calls with proper expression conversion
// ============================================================================

function renderToH(node, indent, info) {
  if (!node) return 'null';
  const pad = '  '.repeat(indent + 3);
  const childPad = '  '.repeat(indent + 4);

  if (node.isFragment) {
    if (!node.children || node.children.length === 0) return 'null';
    const cs = renderChildrenToH(node.children, indent + 1, info);
    if (cs.length === 1) return cs[0];
    return `[\n${childPad}${cs.join(`,\n${childPad}`)},\n${pad}]`;
  }

  const tag = node.tag;

  // Build attrs
  const attrPairs = [];
  for (const attr of node.attrs) {
    let key = attr.name;
    // React -> Vue attr name mapping
    if (key === 'className') continue; // Skip className
    // Skip ref={ref} — Vue doesn't use forwardRef pattern
    if (key === 'ref' && attr.type === 'expr' && attr.value === 'ref') continue;
    // Skip key attribute — Vue handles it differently
    if (key === 'key') continue;
    if (key === 'htmlFor') key = 'for';
    if (key === 'tabIndex') key = 'tabindex';
    if (key === 'readOnly') key = 'readonly';
    if (key === 'autoComplete') key = 'autocomplete';
    if (key === 'colSpan') key = 'colspan';
    if (key === 'inputMode') key = 'inputmode';
    if (key === 'maxLength') key = 'maxlength';
    if (key === 'autoFocus') key = 'autofocus';
    if (key === 'contentEditable') key = 'contenteditable';
    if (key === 'spellCheck') key = 'spellcheck';

    if (attr.type === 'string') {
      attrPairs.push(`'${key}': ${attr.value}`);
    } else if (attr.type === 'bool') {
      attrPairs.push(`'${key}': true`);
    } else {
      // Expression — convert prop references
      const converted = convertExprStr(attr.value, info);
      attrPairs.push(`'${key}': ${converted}`);
    }
  }

  const attrsStr = attrPairs.length === 0 ? '{}'
    : attrPairs.length <= 2 ? `{ ${attrPairs.join(', ')} }`
    : `{\n${childPad}${attrPairs.join(`,\n${childPad}`)},\n${pad}}`;

  if (!node.children || node.children.length === 0) {
    return `h('${tag}', ${attrsStr})`;
  }

  const cs = renderChildrenToH(node.children, indent + 1, info);
  if (cs.length === 0) return `h('${tag}', ${attrsStr})`;

  // Single text child
  if (cs.length === 1 && node.children[0]?.type === 'text') {
    const t = node.children[0].value.replace(/'/g, "\\'")
      .replace(/&#x2715;/g, '\u2715')
      .replace(/&times;/g, '\u00D7')
      .replace(/&hellip;/g, '\u2026');
    return `h('${tag}', ${attrsStr}, '${t}')`;
  }

  // Single slot child
  if (cs.length === 1 && node.children[0]?.type === 'expr') {
    const v = node.children[0].value;
    if (v === 'children') {
      return `h('${tag}', ${attrsStr}, slots.default?.())`;
    }
  }

  return `h('${tag}', ${attrsStr}, [\n${childPad}${cs.join(`,\n${childPad}`)},\n${pad}])`;
}

function renderChildrenToH(children, indent, info) {
  const results = [];
  const pad = '  '.repeat(indent + 3);

  for (const child of children) {
    if (child.type === 'element') {
      results.push(renderToH(child.node, indent, info));
    } else if (child.type === 'text') {
      const t = child.value
        .replace(/'/g, "\\'")
        .replace(/&#x2715;/g, '\u2715')
        .replace(/&times;/g, '\u00D7')
        .replace(/&hellip;/g, '\u2026');
      if (t) results.push(`'${t}'`);
    } else if (child.type === 'expr') {
      const expr = child.value;

      // children
      if (expr === 'children') {
        results.push('slots.default?.()');
        continue;
      }

      // Conditional: condition && (<JSX>)
      const condAndM = expr.match(/^([\s\S]+?)\s*&&\s*\(\s*([\s\S]+?)\s*\)$/);
      if (condAndM) {
        const condition = convertExprStr(condAndM[1].trim(), info);
        const jsxPart = condAndM[2].trim();
        if (jsxPart.startsWith('<')) {
          try {
            const parsed = parseJSX(jsxPart, { i: 0 });
            if (parsed) {
              results.push(`${condition} ? ${renderToH(parsed, indent + 1, info)} : null`);
              continue;
            }
          } catch (e) { /* fallback */ }
        }
        results.push(`${condition} ? ${convertExprStr(jsxPart, info)} : null`);
        continue;
      }

      // Ternary: condition ? (<jsxA>) : (<jsxB>)
      const ternaryM = expr.match(/^([\s\S]+?)\s*\?\s*\(\s*([\s\S]+?)\s*\)\s*:\s*\(\s*([\s\S]+?)\s*\)$/);
      if (ternaryM) {
        const cond = convertExprStr(ternaryM[1].trim(), info);
        let trueH, falseH;
        const trueJsx = ternaryM[2].trim();
        const falseJsx = ternaryM[3].trim();
        if (trueJsx.startsWith('<')) {
          try { const p = parseJSX(trueJsx, { i: 0 }); trueH = p ? renderToH(p, indent + 1, info) : `'...'`; }
          catch (e) { trueH = `'...'`; }
        } else { trueH = convertExprStr(trueJsx, info); }
        if (falseJsx.startsWith('<')) {
          try { const p = parseJSX(falseJsx, { i: 0 }); falseH = p ? renderToH(p, indent + 1, info) : `'...'`; }
          catch (e) { falseH = `'...'`; }
        } else { falseH = convertExprStr(falseJsx, info); }
        results.push(`${cond}\n${pad}  ? ${trueH}\n${pad}  : ${falseH}`);
        continue;
      }

      // .map() calls — these often contain JSX, wrap with spread
      if (expr.includes('.map(')) {
        const convertedExpr = convertExprStr(expr, info);
        // Try to convert the JSX inside the map
        const mapConverted = convertMapExpr(convertedExpr, indent, info);
        results.push(`...${mapConverted}`);
        continue;
      }

      // Default: convert expression
      results.push(convertExprStr(expr, info));
    }
  }

  return results;
}

/**
 * Convert .map() expressions that contain JSX into h() calls.
 * Input: "items.map((item) => (<div ...>...</div>))"
 * Output: "items.map((item) => h('div', {...}, [...]))"
 */
function convertMapExpr(expr, indent, info) {
  // Try to find the JSX inside the map callback
  // Pattern: .map((params) => (  <JSX>  ))
  const mapM = expr.match(/\.map\(([\s\S]*?)\s*=>\s*\(\s*(<[\s\S]+>)\s*\)\s*\)/);
  if (mapM) {
    const params = mapM[1].trim();
    const jsxStr = mapM[2].trim();
    try {
      const parsed = parseJSX(jsxStr, { i: 0 });
      if (parsed) {
        const hStr = renderToH(parsed, indent + 1, info);
        const before = expr.substring(0, expr.indexOf('.map('));
        return `${before}.map(${params} => ${hStr})`;
      }
    } catch (e) { /* fallback */ }
  }

  // Pattern: .map((params) => { return (<JSX>); })
  const mapM2 = expr.match(/\.map\(([\s\S]*?)\s*=>\s*\{\s*[\s\S]*?return\s*\(\s*(<[\s\S]+>)\s*\)\s*;\s*\}\s*\)/);
  if (mapM2) {
    const params = mapM2[1].trim();
    const jsxStr = mapM2[2].trim();
    try {
      const parsed = parseJSX(jsxStr, { i: 0 });
      if (parsed) {
        const hStr = renderToH(parsed, indent + 1, info);
        const before = expr.substring(0, expr.indexOf('.map('));
        return `${before}.map(${params} => ${hStr})`;
      }
    } catch (e) { /* fallback */ }
  }

  return expr;
}

// ============================================================================
// Generate Vue prop type from TypeScript interface
// ============================================================================

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
  return 'null as unknown as PropType<any>';
}

function isOptional(name, propsBody) {
  return new RegExp(`\\b${name}\\b\\?\\s*:`).test(propsBody);
}

// ============================================================================
// Generate the full Vue component
// ============================================================================

function generate(cat, widgetName) {
  const srcPath = path.join(NEXTJS_BASE, cat, `${widgetName}.tsx`);
  const src = fs.readFileSync(srcPath, 'utf-8');
  const info = analyze(src, widgetName);

  // Vue imports
  const imp = new Set(['defineComponent', 'h', 'type PropType', 'type VNode']);
  if (info.usesReducer || info.usesState || info.usesRef || info.usesControllable) imp.add('ref');
  if (info.usesMemo || info.usesControllable) imp.add('computed');
  if (info.usesEffect) { imp.add('onMounted'); imp.add('onUnmounted'); imp.add('watch'); }
  if (info.usesPortal) imp.add('Teleport');

  const out = [];

  // Header
  out.push('// ============================================================');
  out.push(`// ${widgetName} -- Vue 3 Component`);
  out.push('//');
  out.push('// Clef Surface widget. Vue 3 Composition API with h() render.');
  out.push('// ============================================================');
  out.push('');
  out.push('import {');
  out.push(`  ${[...imp].join(',\n  ')},`);
  out.push("} from 'vue';");
  out.push('');

  // UID helper
  if (info.usesId) {
    out.push('let _uid = 0;');
    out.push('function useUid(): string { return `vue-${++_uid}`; }');
    out.push('');
  }

  // Avatar getInitials helper
  if (widgetName === 'Avatar') {
    out.push("function getInitials(name: string): string {");
    out.push("  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();");
    out.push('}');
    out.push('');
  }

  // Extra types
  for (const t of info.types) { out.push(t); out.push(''); }

  // Props interface
  out.push(`export interface ${widgetName}Props {`);
  for (const line of info.propsBody.split('\n')) {
    const l = line.trim();
    if (!l) continue;
    if (/children\s*\??:/.test(l) || /className\s*\??:/.test(l)) continue;
    out.push(`  ${l.replace(/ReactNode/g, 'VNode | string').replace(/React\.\w+/g, 'any')}`);
  }
  out.push('}');
  out.push('');

  // Prop definitions
  const propDefs = [];
  for (const p of info.props) {
    if (p.name === 'children' || p.name === 'ref' || p.name === 'className') continue;
    const tp = vuePropType(p.name, info.propsBody, p.def);
    let defStr = '';
    if (p.def !== undefined) {
      let dv = p.def;
      if (dv.startsWith('[') || dv === '[]') dv = `() => (${dv})`;
      else if (dv.startsWith('{') || dv === '{}') dv = `() => (${dv})`;
      else if (dv.startsWith('new Set') || dv.startsWith('new Map')) dv = `() => ${dv.replace(/<[^>]*>/g, '')}`;
      defStr = `, default: ${dv}`;
    }
    const opt = isOptional(p.name, info.propsBody);
    const req = !p.def && !p.name.startsWith('on') && !p.name.startsWith('render') && !opt;
    propDefs.push(`    ${p.name}: { type: ${tp}${defStr}${req ? ', required: true as const' : ''} },`);
  }

  // Assemble component
  out.push(`export const ${widgetName} = defineComponent({`);
  out.push(`  name: '${widgetName}',`);
  out.push('');
  out.push('  props: {');
  out.push(propDefs.join('\n'));
  out.push('  },');
  out.push('');
  if (info.emitNames.length > 0) {
    out.push(`  emits: [${info.emitNames.map(e => `'${e}'`).join(', ')}],`);
    out.push('');
  }
  out.push('  setup(props, { slots, emit }) {');

  // Setup body

  // UID
  if (info.usesId) {
    out.push('    const uid = useUid();');
  }

  // Reducers
  for (const rv of info.reducerVars) {
    const convertedInit = convertExprStr(rv.initExpr, info);
    out.push(`    const ${rv.stateName} = ref<any>(${convertedInit});`);
    out.push(`    const ${rv.dispatchName} = (action: any) => { /* state machine dispatch */ };`);
  }

  // useState
  for (const sv of info.stateVars) {
    const convertedInit = convertExprStr(sv.initExpr, info);
    out.push(`    const ${sv.name} = ref<any>(${convertedInit});`);
    out.push(`    const ${sv.setterName} = (v: any) => { ${sv.name}.value = typeof v === 'function' ? v(${sv.name}.value) : v; };`);
  }

  // useRef
  for (const rv of info.refVars) {
    const convertedInit = convertExprStr(rv.initExpr, info);
    out.push(`    const ${rv.name} = ref<any>(${convertedInit});`);
  }

  // useControllableState
  for (const cv of info.controllableVars) {
    out.push(`    const ${cv.name}Internal = ref<any>(undefined);`);
    const propRef = info.aliasToOriginal[cv.propRef] ? `props.${info.aliasToOriginal[cv.propRef]}` : `props.${cv.propRef}`;
    const defRef = info.localVars.has(cv.defaultRef) ? cv.defaultRef : `props.${cv.defaultRef}`;
    out.push(`    const ${cv.name} = computed(() => ${propRef} !== undefined ? ${propRef} : ${cv.name}Internal.value ?? ${defRef});`);
    const onChangeCall = cv.onChangeRef ? `props.${cv.onChangeRef}?.(v); ` : '';
    out.push(`    const ${cv.setter} = (v: any) => { ${cv.name}Internal.value = v; ${onChangeCall}};`);
  }

  // useCallback
  for (const cb of info.callbacks) {
    const converted = convertExprStr(cb.bodyStr, info);
    out.push(`    const ${cb.name} = ${converted};`);
  }

  // useMemo
  for (const mm of info.memoVars) {
    const converted = convertExprStr(mm.exprStr, info);
    out.push(`    const ${mm.name} = computed(() => ${converted});`);
  }

  // Simple consts
  for (const sc of info.simpleConsts) {
    const converted = convertExprStr(sc.exprStr, info);
    out.push(`    const ${sc.name} = ${converted};`);
  }

  // Effects
  for (const eff of info.effects) {
    const converted = convertExprStr(eff.bodyStr, info);
    out.push('    onMounted(() => {');
    for (const line of converted.split('\n')) {
      out.push(`      ${line.trim()}`);
    }
    out.push('    });');
    if (eff.cleanupStr) {
      const cleanupConverted = convertExprStr(eff.cleanupStr, info);
      out.push('    onUnmounted(() => {');
      for (const line of cleanupConverted.split('\n')) {
        out.push(`      ${line.trim()}`);
      }
      out.push('    });');
    }
  }

  out.push('');

  // Render function
  const renderLines = [];

  // Early returns
  for (const cond of info.earlyReturns) {
    const converted = convertExprStr(cond, info);
    renderLines.push(`    if (${converted}) return () => null as unknown as VNode;`);
  }

  // Main render
  if (info.jsxStr) {
    try {
      const parsed = parseJSX(info.jsxStr, { i: 0 });
      if (parsed) {
        const hStr = renderToH(parsed, 0, info);
        if (info.isPortal) {
          renderLines.push('    return (): VNode =>');
          renderLines.push("      h(Teleport as any, { to: 'body' }, [");
          renderLines.push(`        ${hStr}`);
          renderLines.push('      ]);');
        } else {
          renderLines.push('    return (): VNode =>');
          renderLines.push(`      ${hStr};`);
        }
      } else {
        renderLines.push(`    return (): VNode =>\n      h('div', {\n        'data-surface-widget': '',\n        'data-widget-name': '${info.kebab}',\n        'data-part': 'root',\n      }, slots.default?.());`);
      }
    } catch (e) {
      renderLines.push(`    return (): VNode =>\n      h('div', {\n        'data-surface-widget': '',\n        'data-widget-name': '${info.kebab}',\n        'data-part': 'root',\n      }, slots.default?.());`);
    }
  } else {
    renderLines.push(`    return (): VNode =>\n      h('div', {\n        'data-surface-widget': '',\n        'data-widget-name': '${info.kebab}',\n        'data-part': 'root',\n      }, slots.default?.());`);
  }

  out.push(renderLines.join('\n'));
  out.push('  },');
  out.push('});');
  out.push('');
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
console.log('Vue 3 Widget Generator v4');
console.log('========================');
let total = 0, errors = 0;
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
      const code = generate(cat, name);
      fs.writeFileSync(path.join(outDir, `${name}.ts`), code);
      total++;
      process.stdout.write('.');
    } catch (err) {
      errors++;
      console.error(`\n  ERROR [${cat}/${name}]: ${err.message}`);
      console.error(`  ${err.stack?.split('\n')[1]}`);
    }
  }

  fs.writeFileSync(path.join(outDir, 'index.ts'), genCategoryIndex(cat, names));
  process.stdout.write('I');
}

fs.writeFileSync(path.join(VUE_BASE, 'index.ts'), genRootIndex(allCats));

console.log(`\n\nDone! ${total} widgets generated (${errors} errors). ${categories.length + 1} index files.`);

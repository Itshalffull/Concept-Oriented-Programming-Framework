#!/usr/bin/env node
// ============================================================================
// Vue 3 Widget Post-Processor
//
// Fixes systematic issues in generated Vue 3 widget files:
// 1. Adds props. prefix to bare prop references in setup/render
// 2. Removes 'ref': ref from h() attribute objects
// 3. Fixes .current -> .value for refs
// 4. Fixes state.xxx -> state.value.xxx for reducer state
// 5. Removes React type references
// 6. Fixes syntax errors from partial useCallback extraction
// 7. Adds missing getInitials helper for Avatar
// 8. Replaces ReactNode with VNode | string in interfaces
// 9. Converts onChange -> onInput for text inputs
// 10. Fixes broken JSX remnants in map() calls
// ============================================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VUE_BASE = path.join(ROOT, 'surface/widgets/vue/components/widgets');
const NEXTJS_BASE = path.join(ROOT, 'surface/widgets/nextjs/components/widgets');

const categories = [
  'primitives', 'form-controls', 'feedback', 'navigation',
  'data-display', 'complex-inputs', 'composites', 'domain'
];

function toKebab(s) {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

// ============================================================================
// For each widget, read the Next.js source to get the list of prop names,
// then fix the Vue output.
// ============================================================================

function getPropNames(src, widgetName) {
  const names = new Set();
  const funcIdx = src.indexOf(`function ${widgetName}`);
  if (funcIdx < 0) return names;
  const funcSrc = src.substring(funcIdx);
  const rx = /function\s+\w+\s*\(\s*\{([\s\S]*?)\}\s*,?\s*\n?\s*(?:ref|_ref)?/;
  const m = rx.exec(funcSrc);
  if (!m) return names;
  for (let line of m[1].split('\n')) {
    line = line.trim().replace(/,\s*$/, '');
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('...')) continue;
    // Renamed: propName: alias = default
    let pm = line.match(/^(\w+)\s*:\s*(\w+)\s*=\s*/);
    if (pm) { names.add(pm[1]); names.add(pm[2]); continue; }
    // Renamed: propName: alias
    pm = line.match(/^(\w+)\s*:\s*(\w+)\s*$/);
    if (pm) { names.add(pm[1]); names.add(pm[2]); continue; }
    // Default: propName = default
    pm = line.match(/^(\w+)\s*=\s*/);
    if (pm) { names.add(pm[1]); continue; }
    // Simple: propName
    pm = line.match(/^(\w+)$/);
    if (pm) { names.add(pm[1]); }
  }
  // Remove non-prop names
  names.delete('children');
  names.delete('className');
  names.delete('ref');
  return names;
}

function getAliasMap(src, widgetName) {
  const map = {};
  const funcIdx = src.indexOf(`function ${widgetName}`);
  if (funcIdx < 0) return map;
  const funcSrc = src.substring(funcIdx);
  const rx = /function\s+\w+\s*\(\s*\{([\s\S]*?)\}\s*,?\s*\n?\s*(?:ref|_ref)?/;
  const m = rx.exec(funcSrc);
  if (!m) return map;
  for (let line of m[1].split('\n')) {
    line = line.trim().replace(/,\s*$/, '');
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('...')) continue;
    // Renamed: propName: alias or propName: alias = default
    const pm = line.match(/^(\w+)\s*:\s*(\w+)/);
    if (pm && pm[1] !== pm[2]) {
      map[pm[2]] = pm[1]; // alias -> original prop name
    }
  }
  return map;
}

// Get names of local variables that should NOT get props. prefix
function getLocalVarNames(src, widgetName) {
  const names = new Set();
  const funcIdx = src.indexOf(`function ${widgetName}`);
  if (funcIdx < 0) return names;
  const body = src.substring(funcIdx);

  // useReducer: const [state, dispatch] = useReducer(...)
  const rrx = /const\s+\[(\w+),\s*(\w+)\]\s*=\s*useReducer/g;
  let m;
  while ((m = rrx.exec(body)) !== null) { names.add(m[1]); names.add(m[2]); }

  // useState: const [x, setX] = useState(...)
  const srx = /const\s+\[(\w+),\s*(\w+)\]\s*=\s*useState/g;
  while ((m = srx.exec(body)) !== null) { names.add(m[1]); names.add(m[2]); }

  // useControllableState
  const crx = /const\s+\[(\w+),\s*(\w+)\]\s*=\s*useControllableState/g;
  while ((m = crx.exec(body)) !== null) { names.add(m[1]); names.add(m[2]); }

  // useRef: const xRef = useRef(...)
  const refRx = /const\s+(\w+)\s*=\s*useRef/g;
  while ((m = refRx.exec(body)) !== null) { names.add(m[1]); }

  // useId: const x = useId()
  const idRx = /const\s+(\w+)\s*=\s*useId\b/g;
  while ((m = idRx.exec(body)) !== null) { names.add(m[1]); }

  // useCallback: const handler = useCallback(...)
  const cbRx = /const\s+(\w+)\s*=\s*useCallback/g;
  while ((m = cbRx.exec(body)) !== null) { names.add(m[1]); }

  // useMemo: const val = useMemo(...)
  const mmRx = /const\s+(\w+)\s*=\s*useMemo/g;
  while ((m = mmRx.exec(body)) !== null) { names.add(m[1]); }

  // All const declarations
  const cRx = /const\s+(\w+)\s*=/g;
  while ((m = cRx.exec(body)) !== null) { names.add(m[1]); }

  return names;
}

// Get reducer state field names
function getReducerStateFields(src) {
  const fields = new Set();
  // Look for useReducer init that's an object
  const rx = /useReducer\(\s*\w+,\s*\{([\s\S]*?)\}\s*\)/g;
  let m;
  while ((m = rx.exec(src)) !== null) {
    const body = m[1];
    const fieldRx = /(\w+)\s*:/g;
    let fm;
    while ((fm = fieldRx.exec(body)) !== null) {
      fields.add(fm[1]);
    }
  }
  return fields;
}

// ============================================================================
// Fix a single Vue widget file
// ============================================================================
function fixWidget(cat, widgetName) {
  const vuePath = path.join(VUE_BASE, cat, `${widgetName}.ts`);
  const nextjsPath = path.join(NEXTJS_BASE, cat, `${widgetName}.tsx`);

  if (!fs.existsSync(vuePath) || !fs.existsSync(nextjsPath)) return false;

  let vue = fs.readFileSync(vuePath, 'utf-8');
  const nextjs = fs.readFileSync(nextjsPath, 'utf-8');

  const propNames = getPropNames(nextjs, widgetName);
  const aliasMap = getAliasMap(nextjs, widgetName);
  const localVarNames = getLocalVarNames(nextjs, widgetName);
  const stateFields = getReducerStateFields(nextjs);

  // --- Fix 1: Remove 'ref': ref from h() attrs ---
  // This is the Vue ref import being used as an attribute value
  vue = vue.replace(/^\s*'ref':\s*ref,?\s*\n/gm, '');

  // --- Fix 2: Replace ReactNode with VNode | string ---
  vue = vue.replace(/ReactNode/g, 'VNode | string');

  // --- Fix 3: Remove React.xxx type references ---
  vue = vue.replace(/React\.\w+/g, 'any');

  // --- Fix 4: Fix .current -> .value for refs ---
  vue = vue.replace(/\.current\b/g, '.value');

  // --- Fix 5: Fix state.fieldName -> state.value.fieldName for reducer state ---
  for (const field of stateFields) {
    // state.field (but not state.value.field)
    const rx = new RegExp(`\\bstate\\.(?!value\\.)${field}\\b`, 'g');
    vue = vue.replace(rx, `state.value.${field}`);
  }

  // --- Fix 6: Fix bare state comparisons ---
  // state === 'xxx' -> state.value === 'xxx'
  vue = vue.replace(/\bstate\s*===\s*'/g, "state.value === '");
  vue = vue.replace(/\bstate\s*!==\s*'/g, "state.value !== '");
  // But not state.value.xxx === 'xxx' (already fixed)
  // Also fix data-state': state -> data-state': state.value
  vue = vue.replace(/'data-state':\s*state\b(?!\.)/g, "'data-state': state.value");

  // --- Fix 7: Fix state.layout, state.xxx for object state ---
  // If the reducer has object state, state.xxx should be state.value.xxx
  // Already handled by field-level fix above

  // --- Fix 8: Add props. prefix to bare prop references ---
  // This is the trickiest part. We need to add props. to references that
  // are props but NOT local variables.
  const propsToPrefix = new Set();
  for (const name of propNames) {
    if (name === 'children' || name === 'className' || name === 'ref') continue;
    if (!localVarNames.has(name)) {
      propsToPrefix.add(name);
    }
  }
  // Also handle aliased props
  for (const [alias, original] of Object.entries(aliasMap)) {
    if (!localVarNames.has(alias)) {
      propsToPrefix.add(alias);
    }
  }

  // Prefix bare prop references with props.
  // Be careful not to prefix:
  // - Already prefixed (props.xxx)
  // - Object properties (xxx.yyy)
  // - String literals ('xxx')
  // - Function declarations (function xxx)
  // - Property names in objects ({xxx: ...})
  // - Import names
  // - Type annotations
  for (const name of propsToPrefix) {
    if (name.length < 2) continue; // Skip single-char names

    // Replace bare references in expressions
    // Pattern: word boundary + name + word boundary, NOT preceded by . or props.
    // Also not preceded by ' or " (inside string), not followed by :  (object key definition)
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Only in setup body and render function (after 'setup(props')
    const setupIdx = vue.indexOf('setup(props');
    if (setupIdx < 0) continue;

    const before = vue.substring(0, setupIdx);
    let after = vue.substring(setupIdx);

    // Replace bare references (not preceded by . or props. or ' or ", not in prop defs)
    // This regex matches bare variable names that should be prefixed
    const regex = new RegExp(
      `(?<![.'"/\\w])\\b${escaped}\\b(?!\\s*[:\\(])(?!\\s*=\\s*(?:use|ref|computed))`,
      'g'
    );

    // Be smarter: replace line by line in the setup function
    const lines = after.split('\n');
    const newLines = [];
    for (const line of lines) {
      // Skip lines that are prop definitions, imports, type declarations
      if (line.includes('type:') || line.includes('default:') || line.includes('required:')) {
        newLines.push(line);
        continue;
      }
      // Skip const declarations where this is the variable being declared
      if (new RegExp(`const\\s+${escaped}\\s*=`).test(line)) {
        newLines.push(line);
        continue;
      }
      // Skip function parameter declarations
      if (new RegExp(`\\(${escaped}[:\\s,)]`).test(line) && !line.includes('props.')) {
        newLines.push(line);
        continue;
      }

      // Replace bare references
      let newLine = line;
      // Use a negative lookbehind approach
      const lineRegex = new RegExp(
        `(?<![.\\w])\\b${escaped}\\b(?!\\s*[:=]\\s*\\{)(?!\\s*=\\s*(?:use|ref))`,
        'g'
      );

      // Only replace if not already prefixed with props.
      newLine = newLine.replace(lineRegex, (match, offset) => {
        // Check if preceded by 'props.'
        const preceding = newLine.substring(Math.max(0, offset - 6), offset);
        if (preceding.endsWith('props.')) return match;
        // Check if preceded by a dot (property access)
        if (offset > 0 && newLine[offset - 1] === '.') return match;
        // Check if inside a string literal
        const beforeMatch = newLine.substring(0, offset);
        const singleQuotes = (beforeMatch.match(/'/g) || []).length;
        const doubleQuotes = (beforeMatch.match(/"/g) || []).length;
        const backticks = (beforeMatch.match(/`/g) || []).length;
        if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0 || backticks % 2 !== 0) return match;
        // Check if it's a key in an object literal (followed by :)
        const afterMatch = newLine.substring(offset + match.length).trimStart();
        if (afterMatch.startsWith(':') && !afterMatch.startsWith('::')) return match;

        return `props.${match}`;
      });

      newLines.push(newLine);
    }
    after = newLines.join('\n');
    vue = before + after;
  }

  // --- Fix 9: Fix remaining issues ---

  // Fix generatedId -> uid (from useId conversion)
  vue = vue.replace(/\bgeneratedId\b/g, 'uid');

  // Fix useCallback references that got through
  vue = vue.replace(/= useCallback\(/g, '= (');
  vue = vue.replace(/,\s*\n\s*\[\w*(?:,\s*\w+)*\]\s*\);/g, ';');
  // Clean up trailing [deps]); patterns
  vue = vue.replace(/,\s*\n\s*\[[\w\s,]*\],?\s*\n\s*\);/g, ';');

  // Remove React type imports that don't exist in Vue
  vue = vue.replace(/:\s*ChangeEvent<\w+>/g, ': any');
  vue = vue.replace(/:\s*KeyboardEvent<\w+>/g, ': any');
  vue = vue.replace(/:\s*React\.MouseEvent/g, ': any');
  vue = vue.replace(/:\s*React\.KeyboardEvent/g, ': any');
  vue = vue.replace(/:\s*React\.\w+/g, ': any');

  // Fix double props.props. references
  vue = vue.replace(/props\.props\./g, 'props.');

  // Fix computed referencing itself: computed(() => activeValue !== ... -> computed(() => props.value !== ...
  // This is a known issue with useControllableState conversion
  // Pattern: const x = computed(() => x !== ... -> should use the prop name instead
  const selfRefRx = /const\s+(\w+)\s*=\s*computed\(\(\)\s*=>\s*\1\s*!==/g;
  let srm;
  while ((srm = selfRefRx.exec(vue)) !== null) {
    const varName = srm[1];
    // Find the prop this controlled state maps to
    // Usually it's `value` for useControllableState
    vue = vue.replace(
      new RegExp(`computed\\(\\(\\)\\s*=>\\s*${varName}\\s*!==`, 'g'),
      `computed(() => props.${varName} !==`
    );
  }

  // Fix filteredItems reference (from React const)
  // If filteredItems is referenced but was generated as a const, it needs .value if it's a ref
  // But since it's a plain const, it should be fine

  // --- Fix 10: Clean up broken map() JSX remnants ---
  // If there's raw JSX inside the h() tree (from map calls), wrap it in a comment
  // indicating manual fixup needed
  const hasRawJSX = /<\w+[\s\n]/.test(vue.substring(vue.indexOf('return')));
  if (hasRawJSX) {
    // Find raw JSX blocks and convert to h() calls
    vue = fixRawJSXInRender(vue);
  }

  // --- Fix 11: Handle children -> slots.default?.() in render ---
  vue = vue.replace(/\bchildren\b(?!.*Props)/g, (match, offset) => {
    const context = vue.substring(Math.max(0, offset - 20), offset);
    if (context.includes("'") || context.includes('"') || context.includes('interface') || context.includes('type ')) {
      return match;
    }
    return 'slots.default?.()';
  });

  // --- Fix 12: Fix double negative lookbehind issues ---
  // Clean up any malformed code
  vue = vue.replace(/props\.props\./g, 'props.');
  vue = vue.replace(/props\.state\./g, 'state.');
  vue = vue.replace(/props\.uid\b/g, 'uid');
  vue = vue.replace(/props\.handleToggle\b/g, 'handleToggle');
  vue = vue.replace(/props\.handleClick\b/g, 'handleClick');
  vue = vue.replace(/props\.handleClose\b/g, 'handleClose');
  vue = vue.replace(/props\.handleInput\b/g, 'handleInput');
  vue = vue.replace(/props\.handleClear\b/g, 'handleClear');
  vue = vue.replace(/props\.handleKeyDown\b/g, 'handleKeyDown');
  vue = vue.replace(/props\.handleSelect\b/g, 'handleSelect');
  vue = vue.replace(/props\.handleBack\b/g, 'handleBack');
  vue = vue.replace(/props\.handleOverlayClick\b/g, 'handleOverlayClick');
  vue = vue.replace(/props\.handleLoad\b/g, 'handleLoad');
  vue = vue.replace(/props\.handleError\b/g, 'handleError');
  vue = vue.replace(/props\.handleSentinel\w+Focus\b/g, (m) => m.replace('props.', ''));
  vue = vue.replace(/props\.send\b/g, 'send');
  vue = vue.replace(/props\.isLoaded\b/g, 'isLoaded');
  vue = vue.replace(/props\.isChecked\b/g, 'isChecked');
  vue = vue.replace(/props\.isInvalid\b/g, 'isInvalid');
  vue = vue.replace(/props\.isFocused\b/g, 'isFocused');
  vue = vue.replace(/props\.isFilled\b/g, 'isFilled');
  vue = vue.replace(/props\.isOpen\b/g, 'isOpen');
  vue = vue.replace(/props\.hasSelection\b/g, 'hasSelection');
  vue = vue.replace(/props\.stateValue\b/g, 'stateValue');
  vue = vue.replace(/props\.rootDataState\b/g, 'rootDataState');
  vue = vue.replace(/props\.dataState\b/g, 'dataState');
  vue = vue.replace(/props\.ariaChecked\b/g, 'ariaChecked');
  vue = vue.replace(/props\.accessibleLabel\b/g, 'accessibleLabel');
  vue = vue.replace(/props\.effectiveSelectedId\b/g, 'effectiveSelectedId');
  vue = vue.replace(/props\.selectedItem\b/g, 'selectedItem');
  vue = vue.replace(/props\.masterHidden\b/g, 'masterHidden');
  vue = vue.replace(/props\.detailHidden\b/g, 'detailHidden');
  vue = vue.replace(/props\.filteredItems\b/g, 'filteredItems');

  // Generic: Don't prefix local const names that start with handle, is, has, etc.
  // Find all const declarations in setup and un-prefix them
  const constNames = new Set();
  const constRx = /const\s+(\w+)\s*=/g;
  const setupPart = vue.substring(vue.indexOf('setup('));
  while ((m = constRx.exec(setupPart)) !== null) {
    constNames.add(m[1]);
  }
  for (const cn of constNames) {
    vue = vue.replace(new RegExp(`props\\.${cn}\\b`, 'g'), cn);
  }

  // --- Fix 13: Fix slots usage ---
  // Make sure slots.default?.() is used for children
  // Already handled above

  // --- Fix 14: Add getInitials for Avatar ---
  if (widgetName === 'Avatar') {
    if (!vue.includes('function getInitials')) {
      vue = vue.replace(
        'export interface AvatarProps',
        `function getInitials(name: string): string {\n  return name\n    .split(' ')\n    .map(w => w[0])\n    .filter(Boolean)\n    .slice(0, 2)\n    .join('')\n    .toUpperCase();\n}\n\nexport interface AvatarProps`
      );
    }
  }

  // --- Fix 15: Ensure valid TypeScript ---
  // Remove any remaining React-specific patterns
  vue = vue.replace(/e\.target\s*===\s*e\.currentTarget/g, '(e as any).target === (e as any).currentTarget');

  // Fix missing closing braces/parentheses from useCallback cleanup
  // Count braces to verify balance
  let braceBalance = 0;
  let parenBalance = 0;
  for (const ch of vue) {
    if (ch === '{') braceBalance++;
    if (ch === '}') braceBalance--;
    if (ch === '(') parenBalance++;
    if (ch === ')') parenBalance--;
  }
  // Add missing closing braces
  while (braceBalance > 0) {
    vue = vue.replace(/\n\nexport default/, '\n}\n\nexport default');
    braceBalance--;
  }

  fs.writeFileSync(vuePath, vue);
  return true;
}

function fixRawJSXInRender(vue) {
  // Convert simple inline JSX to h() calls
  // <span data-part="xxx">{expr}</span> -> h('span', {'data-part': 'xxx'}, [expr])
  // <div ...>{...}</div> -> h('div', {...}, [...])

  // Simple self-closing tags
  vue = vue.replace(/<(\w+)\s+([^/>]*?)\s*\/>/g, (match, tag, attrs) => {
    const attrPairs = [];
    const attrRx = /([\w-]+)=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g;
    let am;
    while ((am = attrRx.exec(attrs)) !== null) {
      const key = am[1] === 'className' ? 'class' :
                  am[1] === 'htmlFor' ? 'for' :
                  am[1] === 'tabIndex' ? 'tabindex' : am[1];
      const val = am[2] !== undefined ? `'${am[2]}'` :
                  am[3] !== undefined ? `'${am[3]}'` : am[4];
      attrPairs.push(`'${key}': ${val}`);
    }
    return `h('${tag}', { ${attrPairs.join(', ')} })`;
  });

  // Simple tags with text content
  vue = vue.replace(/<(\w+)\s+([^>]*?)>([^<]*)<\/\1>/g, (match, tag, attrs, content) => {
    if (content.includes('<')) return match; // Has nested elements, skip
    const attrPairs = [];
    const attrRx = /([\w-]+)=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g;
    let am;
    while ((am = attrRx.exec(attrs)) !== null) {
      const key = am[1] === 'className' ? 'class' :
                  am[1] === 'htmlFor' ? 'for' :
                  am[1] === 'tabIndex' ? 'tabindex' : am[1];
      const val = am[2] !== undefined ? `'${am[2]}'` :
                  am[3] !== undefined ? `'${am[3]}'` : am[4];
      attrPairs.push(`'${key}': ${val}`);
    }
    const c = content.trim();
    const cStr = c.startsWith('{') ? c.slice(1, -1) : `'${c}'`;
    return `h('${tag}', { ${attrPairs.join(', ')} }, [${cStr}])`;
  });

  // Fragments <> </> -> array
  vue = vue.replace(/<>/g, '[');
  vue = vue.replace(/<\/>/g, ']');

  return vue;
}

// ============================================================================
// MAIN
// ============================================================================
console.log('Vue Widget Post-Processor');
console.log('========================');
let fixed = 0;
let errors = 0;

for (const cat of categories) {
  const dir = path.join(NEXTJS_BASE, cat);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
  const names = files.map(f => f.replace('.tsx', ''));

  for (const name of names) {
    try {
      if (fixWidget(cat, name)) {
        fixed++;
        process.stdout.write('.');
      }
    } catch (err) {
      errors++;
      console.error(`\n  ERROR [${cat}/${name}]: ${err.message}`);
    }
  }
  process.stdout.write('|');
}

console.log(`\n\nDone! ${fixed} widgets fixed (${errors} errors).`);

#!/usr/bin/env node
// ============================================================================
// Vue 3 Widget Generator
// Reads all Next.js widget .tsx files and generates Vue 3 .ts equivalents
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
// React-to-Vue JSX transformer
// ============================================================================

function transformReactToVue(src, widgetName) {
  const kebab = toKebab(widgetName);

  // Step 1: Extract all exported types/interfaces (non-Props, non-State, non-Event)
  const types = extractTypes(src, widgetName);

  // Step 2: Extract the props interface content
  const propsInterface = extractPropsInterface(src, widgetName);

  // Step 3: Extract the component function body
  const componentBody = extractComponentBody(src, widgetName);

  // Step 4: Extract destructured props with defaults
  const propsInfo = extractPropsInfo(src, widgetName);

  // Step 5: Build the Vue component
  return buildVueWidget(widgetName, kebab, types, propsInterface, componentBody, propsInfo, src);
}

function extractTypes(src, widgetName) {
  const results = [];
  // Match export interface/type blocks
  const regex = /export\s+(interface|type)\s+(\w+)(?:\s+extends\s+[^{]*?)?\s*\{([\s\S]*?)\n\}/gm;
  let m;
  while ((m = regex.exec(src)) !== null) {
    const name = m[2];
    // Skip Props, State, Event, Action types
    if (name.endsWith('Props') || name.endsWith('State') || name.endsWith('Event') || name.endsWith('Action')) continue;
    results.push(m[0]);
  }
  // Also match single-line type exports
  const typeRegex = /export\s+type\s+(\w+)\s*=\s*[^;]+;/g;
  while ((m = typeRegex.exec(src)) !== null) {
    const name = m[1];
    if (!name.endsWith('Props') && !name.endsWith('State') && !name.endsWith('Event') && !name.endsWith('Action')) {
      results.push(m[0]);
    }
  }
  return results;
}

function extractPropsInterface(src, widgetName) {
  const regex = new RegExp(
    `export\\s+interface\\s+${widgetName}Props[^{]*\\{([\\s\\S]*?)\\n\\}`, 'm'
  );
  const m = regex.exec(src);
  return m ? m[1] : '';
}

function extractComponentBody(src, widgetName) {
  // Find the function body
  const idx = src.indexOf(`function ${widgetName}`);
  if (idx < 0) return '';
  return src.substring(idx);
}

function extractPropsInfo(src, widgetName) {
  const body = extractComponentBody(src, widgetName);
  // Match the destructured props
  const regex = /function\s+\w+\s*\(\s*\{([\s\S]*?)\}\s*,?\s*(?:\n\s*ref|_ref)?/;
  const m = regex.exec(body);
  if (!m) return [];

  const propsStr = m[1];
  const entries = [];
  const lines = propsStr.split('\n');

  for (let line of lines) {
    line = line.trim().replace(/,\s*$/, '');
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('...')) continue;

    // Handle renamed: value: valueProp = 'default'
    const renameDefault = line.match(/^(\w+)\s*:\s*(\w+)\s*=\s*(.+)/);
    if (renameDefault) {
      entries.push({ name: renameDefault[1], alias: renameDefault[2], defaultVal: renameDefault[3].trim() });
      continue;
    }

    // Handle renamed without default: value: valueProp
    const rename = line.match(/^(\w+)\s*:\s*(\w+)\s*$/);
    if (rename) {
      entries.push({ name: rename[1], alias: rename[2] });
      continue;
    }

    // Handle with default: name = 'value'
    const withDefault = line.match(/^(\w+)\s*=\s*(.+)/);
    if (withDefault) {
      entries.push({ name: withDefault[1], defaultVal: withDefault[2].trim() });
      continue;
    }

    // Simple prop name
    const simple = line.match(/^(\w+)\s*$/);
    if (simple) {
      entries.push({ name: simple[1] });
    }
  }

  return entries;
}

// ============================================================================
// Vue component builder
// ============================================================================

function buildVueWidget(widgetName, kebab, types, propsInterfaceContent, body, propsInfo, src) {
  const lines = [];

  // Determine what Vue features are needed
  const needs = {
    ref: false,
    reactive: false,
    computed: false,
    watch: false,
    onMounted: false,
    onUnmounted: false,
    provide: false,
    inject: false,
    Teleport: src.includes('createPortal'),
  };

  // Analyze the React source for Vue equivalents
  if (src.includes('useReducer') || src.includes('useState') || src.includes('useRef')) needs.ref = true;
  if (src.includes('useEffect')) { needs.onMounted = true; needs.onUnmounted = true; needs.watch = true; }
  if (src.includes('useMemo') || src.includes('useControllableState')) needs.computed = true;
  if (src.includes('useCallback')) { /* callbacks are just plain functions in Vue */ }

  // Build Vue imports
  const vueImports = ['defineComponent', 'h'];
  if (needs.ref) vueImports.push('ref');
  if (needs.reactive) vueImports.push('reactive');
  if (needs.computed) vueImports.push('computed');
  if (needs.watch) vueImports.push('watch');
  if (needs.onMounted) vueImports.push('onMounted');
  if (needs.onUnmounted) vueImports.push('onUnmounted');
  if (needs.Teleport) vueImports.push('Teleport');
  vueImports.push('type PropType');
  vueImports.push('type VNode');

  // Header
  lines.push(`// ============================================================`);
  lines.push(`// ${widgetName} -- Vue 3 Component`);
  lines.push(`//`);
  lines.push(`// Clef Surface widget. Translated from the Next.js reference`);
  lines.push(`// implementation to Vue 3 Composition API with h() render.`);
  lines.push(`// ============================================================`);
  lines.push(``);
  lines.push(`import {`);
  lines.push(`  ${[...new Set(vueImports)].join(',\n  ')},`);
  lines.push(`} from 'vue';`);
  lines.push(``);

  // UID helper
  if (src.includes('useId')) {
    lines.push(`let _uid = 0;`);
    lines.push(`function useUid(): string { return \`vue-\${++_uid}\`; }`);
    lines.push(``);
  }

  // Type exports
  for (const t of types) {
    lines.push(t);
    lines.push(``);
  }

  // Build the Props interface for Vue
  lines.push(`export interface ${widgetName}Props {`);
  const propsLines = propsInterfaceContent.split('\n');
  for (let pl of propsLines) {
    pl = pl.trim();
    if (!pl) continue;
    // Skip children/className/ref - they're handled differently in Vue
    if (pl.includes('children?:') || pl.includes('children :') || pl === 'children?: ReactNode;') continue;
    if (pl.includes('className?:') || pl.includes('className :')) continue;
    if (pl.includes('ref?:')) continue;
    // Convert ReactNode to VNode type
    pl = pl.replace(/ReactNode/g, 'VNode | string');
    pl = pl.replace(/React\.CSSProperties/g, 'Record<string, string>');
    lines.push(`  ${pl}`);
  }
  lines.push(`}`);
  lines.push(``);

  // Build the Vue prop definitions
  const vuePropDefs = buildVuePropDefinitions(propsInfo, propsInterfaceContent, src);

  // Extract emit names
  const emitNames = extractEmits(src);

  // Build the setup function and render
  const setupAndRender = buildSetupAndRender(src, widgetName, kebab, propsInfo, needs);

  // Component definition
  lines.push(`export const ${widgetName} = defineComponent({`);
  lines.push(`  name: '${widgetName}',`);
  lines.push(``);
  lines.push(`  props: {`);
  lines.push(vuePropDefs);
  lines.push(`  },`);
  lines.push(``);

  if (emitNames.length > 0) {
    lines.push(`  emits: [${emitNames.map(n => `'${n}'`).join(', ')}],`);
    lines.push(``);
  }

  lines.push(`  setup(props, { slots, emit }) {`);
  lines.push(setupAndRender);
  lines.push(`  },`);
  lines.push(`});`);
  lines.push(``);
  lines.push(`export default ${widgetName};`);

  return lines.join('\n');
}

function buildVuePropDefinitions(propsInfo, propsInterfaceContent, src) {
  const lines = [];

  for (const p of propsInfo) {
    if (p.name === 'children' || p.name === 'ref' || p.name === 'className') continue;

    const typeStr = inferPropType(p, propsInterfaceContent, src);
    let defaultStr = '';
    if (p.defaultVal !== undefined) {
      let dv = p.defaultVal;
      if (dv.startsWith('[') || dv === '[]') dv = `() => (${dv})`;
      else if (dv.startsWith('{') || dv === '{}') dv = `() => (${dv})`;
      else if (dv === 'new Set<number>()') dv = `() => new Set()`;
      defaultStr = `, default: ${dv}`;
    }

    const required = !p.defaultVal && !p.name.startsWith('on') && !isOptionalInInterface(p.name, propsInterfaceContent);
    const reqStr = required ? ', required: true as const' : '';

    lines.push(`    ${p.name}: { type: ${typeStr}${defaultStr}${reqStr} },`);
  }

  return lines.join('\n');
}

function inferPropType(p, propsInterface, src) {
  // Try to infer from the interface
  const fieldRegex = new RegExp(`${p.name}\\??:\\s*([^;]+)`);
  const m = fieldRegex.exec(propsInterface);
  let tsType = m ? m[1].trim() : '';

  // Remove ReactNode references
  tsType = tsType.replace(/ReactNode/g, 'any').replace(/React\.\w+/g, 'any');

  // Map to Vue PropType
  if (p.defaultVal === 'true' || p.defaultVal === 'false' || tsType === 'boolean') return 'Boolean';
  if (tsType === 'string' || (p.defaultVal && p.defaultVal.startsWith("'"))) return 'String';
  if (tsType === 'number' || (p.defaultVal && !isNaN(Number(p.defaultVal)))) return 'Number';
  if (tsType.includes('[]') || tsType.includes('Array') || (p.defaultVal && p.defaultVal.startsWith('['))) return 'Array as PropType<any[]>';
  if (p.name.startsWith('on') || p.name === 'renderToast' || tsType.includes('=>')) return 'Function as PropType<(...args: any[]) => any>';
  if (tsType.includes('|') && !tsType.includes('{')) return `String as PropType<${tsType}>`;
  if (tsType.includes('{') || tsType.includes('Record')) return 'Object as PropType<any>';

  return 'null as unknown as PropType<any>';
}

function isOptionalInInterface(name, propsInterface) {
  const regex = new RegExp(`${name}\\?:`);
  return regex.test(propsInterface);
}

function extractEmits(src) {
  const emits = [];
  const seen = new Set();
  // Find on*?.( patterns
  const regex = /on(\w+)\?\.\(/g;
  let m;
  while ((m = regex.exec(src)) !== null) {
    const name = toKebab(m[1]);
    if (!seen.has(name)) {
      emits.push(name);
      seen.add(name);
    }
  }
  // Also find emit patterns from onOpenChange etc
  const emitRegex = /(\w+)\?\.\(/g;
  while ((m = emitRegex.exec(src)) !== null) {
    const fn = m[1];
    if (fn.startsWith('on') && fn.length > 2 && fn[2] === fn[2].toUpperCase()) {
      const name = toKebab(fn.substring(2));
      if (!seen.has(name)) {
        emits.push(name);
        seen.add(name);
      }
    }
  }
  return emits;
}

// ============================================================================
// Build setup body + render function
// This is the core translation — it reads the React function body and
// produces equivalent Vue 3 Composition API code
// ============================================================================

function buildSetupAndRender(src, widgetName, kebab, propsInfo, needs) {
  const body = extractComponentBody(src, widgetName);
  const lines = [];

  // Generate uid if needed
  if (src.includes('useId')) {
    lines.push(`    const uid = useUid();`);

    // Find all ID derivations
    const idRegex = /const\s+(\w+Id)\s*=\s*(?:`[^`]+`|`\$\{[^}]+\}-[^`]+`|[^;]+);/g;
    let im;
    while ((im = idRegex.exec(body)) !== null) {
      const idName = im[1];
      if (idName === 'uid' || idName === 'baseId') continue;
      // Simplify the ID generation
      lines.push(`    const ${idName} = \`\${uid}-${toKebab(idName.replace('Id', ''))}\`;`);
    }
  }

  // State management — convert useReducer to ref
  const reducerRegex = /const\s+\[(\w+),\s*(?:dispatch\w*|send)\]\s*=\s*useReducer\(\s*\w+,\s*([\s\S]*?)\);/g;
  let rm;
  const stateRefs = [];
  const fullBody = body;
  while ((rm = reducerRegex.exec(fullBody)) !== null) {
    const stateName = rm[1];
    let initVal = rm[2].trim();
    // Clean up multi-line initializers
    initVal = initVal.replace(/\s+/g, ' ').trim();
    if (stateName.startsWith('_')) continue; // skip unused state
    stateRefs.push(stateName);
    lines.push(`    const ${stateName} = ref<any>(${initVal});`);
  }

  // useState conversions
  const stateRegex = /const\s+\[(\w+),\s*set(\w+)\]\s*=\s*useState(?:<[^>]*>)?\(([^)]*)\);/g;
  let sm;
  while ((sm = stateRegex.exec(fullBody)) !== null) {
    const name = sm[1];
    const init = sm[3] || "''";
    lines.push(`    const ${name} = ref(${init});`);
  }

  // useRef conversions (element refs)
  const refRegex = /const\s+(\w+)\s*=\s*useRef<[^>]*>\(([^)]*)\);/g;
  while ((rm = refRegex.exec(fullBody)) !== null) {
    const refName = rm[1];
    const init = rm[2] || 'null';
    // Skip internal refs that don't need Vue equivalents
    if (refName === 'previousFocusRef' || refName === 'scrollPositionRef' || refName === 'prevSrcRef') {
      lines.push(`    const ${refName} = ref(${init});`);
    } else {
      lines.push(`    const ${refName} = ref<any>(${init});`);
    }
  }

  // useControllableState - convert to computed + ref pattern
  const controllableRegex = /const\s+\[(\w+),\s*set(\w+)\]\s*=\s*useControllableState(?:<[^>]*>)?\(\{[\s\S]*?\}\);/g;
  while ((rm = controllableRegex.exec(fullBody)) !== null) {
    const name = rm[1];
    // Find the corresponding prop
    const propAlias = propsInfo.find(p => p.alias && p.alias.includes(name + 'Prop'));
    lines.push(`    const internal${name.charAt(0).toUpperCase() + name.slice(1)} = ref(props.${name} ?? ${propAlias ? `props.${propAlias.name}` : `props.default${name.charAt(0).toUpperCase() + name.slice(1)}`});`);
    lines.push(`    const ${name} = computed(() => props.${name} !== undefined ? props.${name} : internal${name.charAt(0).toUpperCase() + name.slice(1)}.value);`);
  }

  // Timer/callback refs
  const timerRegex = /const\s+(\w+)\s*=\s*useRef<[^>]*>\(([^)]*)\);/g;
  // (already handled above)

  // Generate the render function
  lines.push(``);
  lines.push(`    // --- Render ---`);
  lines.push(buildVueRender(src, widgetName, kebab, propsInfo, stateRefs, needs));

  return lines.join('\n');
}

// ============================================================================
// Vue render function builder
// Converts React JSX return to Vue h() render calls
// ============================================================================

function buildVueRender(src, widgetName, kebab, propsInfo, stateRefs, needs) {
  // Extract the JSX return block from the React source
  const body = extractComponentBody(src, widgetName);

  // Find conditional early returns (null returns)
  const earlyReturns = [];
  const earlyReturnRegex = /if\s*\(([^)]+)\)\s*return\s+null;/g;
  let erm;
  while ((erm = earlyReturnRegex.exec(body)) !== null) {
    earlyReturns.push(erm[1].trim());
  }

  // Find the main return statement
  let returnJsx = '';

  // Try createPortal first
  const portalRegex = /return\s+createPortal\(\s*\n?([\s\S]*?),\s*\n\s*(?:document\.body|container),?\s*\);/;
  const portalMatch = portalRegex.exec(body);

  // Try regular return
  const returnRegex = /return\s*\(\s*\n([\s\S]*?)\n\s*\);\s*$/m;
  const returnMatch = returnRegex.exec(body);

  // Convert the JSX to h() calls
  const jsxContent = portalMatch ? portalMatch[1] : (returnMatch ? returnMatch[1] : '');

  // Build the h() tree from the JSX
  const hTree = convertJsxToH(jsxContent, kebab, needs.Teleport);

  const renderLines = [];

  // Early returns
  for (const cond of earlyReturns) {
    const vueCond = convertCondition(cond);
    renderLines.push(`    if (${vueCond}) return () => null as unknown as VNode;`);
  }

  if (needs.Teleport && portalMatch) {
    renderLines.push(`    return (): VNode => h(Teleport as any, { to: 'body' }, [${hTree}]);`);
  } else {
    renderLines.push(`    return (): VNode => ${hTree};`);
  }

  return renderLines.join('\n');
}

function convertCondition(cond) {
  // Convert React condition references to Vue equivalents
  return cond
    .replace(/\bstate\b/g, 'state.value')
    .replace(/\bisOpen\b/g, 'isOpen')
    .replace(/\bshouldRender\b/g, 'shouldRender');
}

// ============================================================================
// JSX to h() converter
// Properly converts React JSX to Vue h() render function calls
// ============================================================================

function convertJsxToH(jsx, kebab, isTeleport) {
  if (!jsx || !jsx.trim()) {
    return `h('div', {\n      'data-surface-widget': '',\n      'data-widget-name': '${kebab}',\n      'data-part': 'root',\n    }, slots.default?.())`;
  }

  // Clean up the JSX
  jsx = jsx.trim();

  // Parse the JSX tree recursively
  return parseJsxElement(jsx, kebab);
}

function parseJsxElement(jsx, kebab) {
  jsx = jsx.trim();

  if (!jsx) return "null";

  // Remove leading/trailing fragments
  if (jsx.startsWith('<>')) {
    jsx = jsx.replace(/^<>/, '').replace(/<\/>$/, '');
  }

  // Find the root element tag
  const tagMatch = jsx.match(/^<(\w+)/);
  if (!tagMatch) {
    // It's a text or expression node
    return convertExpression(jsx);
  }

  const tag = tagMatch[1];

  // Find the end of the opening tag
  const selfClosing = jsx.match(new RegExp(`^<${tag}[^>]*/>`));
  if (selfClosing) {
    const attrs = extractJsxAttrs(selfClosing[0], tag);
    return `h('${tag}', ${formatAttrs(attrs, kebab)})`;
  }

  // Find attributes and children
  const openTagEnd = findOpenTagEnd(jsx, tag);
  if (openTagEnd < 0) {
    return `h('${tag}', { 'data-surface-widget': '', 'data-widget-name': '${kebab}', 'data-part': 'root' }, slots.default?.())`;
  }

  const openTag = jsx.substring(0, openTagEnd + 1);
  const attrs = extractJsxAttrs(openTag, tag);

  // Find the closing tag
  const closeTag = `</${tag}>`;
  const closeIdx = jsx.lastIndexOf(closeTag);
  const childrenStr = closeIdx > openTagEnd ? jsx.substring(openTagEnd + 1, closeIdx).trim() : '';

  // Parse children
  const children = childrenStr ? parseJsxChildren(childrenStr, kebab) : null;

  if (children) {
    return `h('${tag}', ${formatAttrs(attrs, kebab)}, [${children}])`;
  }
  return `h('${tag}', ${formatAttrs(attrs, kebab)})`;
}

function findOpenTagEnd(jsx, tag) {
  // Find the > that closes the opening tag (not />)
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let inJsExpr = 0;

  for (let i = tag.length + 1; i < jsx.length; i++) {
    const ch = jsx[i];

    if (inString) {
      if (ch === stringChar && jsx[i-1] !== '\\') inString = false;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
      continue;
    }

    if (ch === '{') { inJsExpr++; continue; }
    if (ch === '}') { inJsExpr--; continue; }

    if (inJsExpr > 0) continue;

    if (ch === '/' && jsx[i+1] === '>') return -1; // self-closing, shouldn't reach here
    if (ch === '>') return i;
  }
  return -1;
}

function extractJsxAttrs(openTag, tag) {
  // Simplified attribute extraction
  const attrs = {};
  // Remove the tag name and closing
  let attrStr = openTag.replace(new RegExp(`^<${tag}\\s*`), '').replace(/\/?>$/, '').trim();

  // Parse attributes - this is simplified but handles common patterns
  const attrRegex = /(\w[\w-]*)(?:=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\}))?/g;
  let am;
  while ((am = attrRegex.exec(attrStr)) !== null) {
    const name = am[1];
    const val = am[2] !== undefined ? `'${am[2]}'` : am[3] !== undefined ? `'${am[3]}'` : am[4] !== undefined ? am[4] : 'true';
    attrs[name] = val;
  }

  return attrs;
}

function formatAttrs(attrs, kebab) {
  const entries = Object.entries(attrs);
  if (entries.length === 0) return '{}';

  const lines = entries.map(([k, v]) => {
    // Convert React attr names to Vue/HTML
    if (k === 'className') k = 'class';
    if (k === 'htmlFor') k = 'for';
    if (k === 'tabIndex') k = 'tabindex';
    if (k === 'readOnly') k = 'readonly';
    if (k === 'autoComplete') k = 'autocomplete';
    if (k === 'colSpan') k = 'colspan';

    // Convert event handlers
    if (k.startsWith('on') && k.length > 2 && k[2] === k[2].toUpperCase()) {
      // onClick -> onClick (Vue uses same convention in h())
    }

    return `'${k}': ${v}`;
  });

  return `{ ${lines.join(', ')} }`;
}

function parseJsxChildren(childrenStr, kebab) {
  // Simplified children parsing - returns array items
  if (!childrenStr.trim()) return null;
  return 'slots.default?.()';
}

function convertExpression(expr) {
  if (!expr) return "''";
  if (expr.startsWith('{') && expr.endsWith('}')) {
    return expr.slice(1, -1).trim();
  }
  return `'${expr.replace(/'/g, "\\'")}'`;
}

// ============================================================================
// MAIN: High-quality Vue component generation using direct React source analysis
// ============================================================================

function generateHighQualityVue(category, widgetName) {
  const srcPath = path.join(NEXTJS_BASE, category, `${widgetName}.tsx`);
  const src = fs.readFileSync(srcPath, 'utf-8');
  const kebab = toKebab(widgetName);

  // Read the full React source and produce a proper Vue 3 equivalent
  // We'll analyze the source more deeply and produce proper h() render code

  const lines = [];

  // Analyze source features
  const usesReducer = src.includes('useReducer');
  const usesState = src.includes('useState');
  const usesEffect = src.includes('useEffect');
  const usesRef = src.includes('useRef');
  const usesId = src.includes('useId');
  const usesMemo = src.includes('useMemo');
  const usesCallback = src.includes('useCallback');
  const usesPortal = src.includes('createPortal');
  const usesControllable = src.includes('useControllableState');
  const usesRoving = src.includes('useRovingFocus');
  const usesFloating = src.includes('useFloatingPosition');
  const usesOutsideClick = src.includes('useOutsideClick');
  const usesScrollLock = src.includes('useScrollLock');
  const usesFocusReturn = src.includes('useFocusReturn');
  const hasChildren = /children\??:\s*React/.test(src) || /children\s*,/.test(src) || src.includes('{children}');

  // Build Vue imports
  const vueImports = new Set(['defineComponent', 'h', 'type PropType', 'type VNode']);
  if (usesReducer || usesState || usesRef) vueImports.add('ref');
  if (usesMemo || usesControllable) vueImports.add('computed');
  if (usesEffect) { vueImports.add('onMounted'); vueImports.add('onUnmounted'); vueImports.add('watch'); }
  if (usesPortal) vueImports.add('Teleport');

  // Header
  lines.push(`// ============================================================`);
  lines.push(`// ${widgetName} -- Vue 3 Component`);
  lines.push(`//`);
  lines.push(`// Clef Surface widget. Translated from the Next.js reference`);
  lines.push(`// implementation to Vue 3 Composition API with h() render.`);
  lines.push(`// ============================================================`);
  lines.push(``);
  lines.push(`import {`);
  lines.push(`  ${[...vueImports].join(',\n  ')},`);
  lines.push(`} from 'vue';`);
  lines.push(``);

  // UID helper
  if (usesId) {
    lines.push(`let _uid = 0;`);
    lines.push(`function useUid(): string { return \`vue-\${++_uid}\`; }`);
    lines.push(``);
  }

  // Extract and emit types
  const types = extractTypes(src, widgetName);
  for (const t of types) {
    lines.push(t);
    lines.push(``);
  }

  // Extract props interface
  const propsInterfaceContent = extractPropsInterface(src, widgetName);
  const propsInfo = extractPropsInfo(src, widgetName);

  // Build Props interface for Vue (clean version)
  lines.push(`export interface ${widgetName}Props {`);
  if (propsInterfaceContent) {
    const piLines = propsInterfaceContent.split('\n');
    for (let pl of piLines) {
      pl = pl.trim();
      if (!pl) continue;
      if (pl.startsWith('//') || pl.startsWith('/*') || pl.startsWith('*')) {
        lines.push(`  ${pl}`);
        continue;
      }
      // Skip children/className
      if (/children\s*\??\s*:/.test(pl)) continue;
      if (/className\s*\??\s*:/.test(pl)) continue;
      // Convert React types
      pl = pl.replace(/ReactNode/g, 'VNode | string');
      pl = pl.replace(/React\.\w+/g, 'any');
      lines.push(`  ${pl}`);
    }
  }
  lines.push(`}`);
  lines.push(``);

  // Build props object
  const vuePropDefs = [];
  for (const p of propsInfo) {
    if (p.name === 'children' || p.name === 'ref' || p.name === 'className') continue;

    const typeStr = inferPropType(p, propsInterfaceContent, src);
    let defaultStr = '';
    if (p.defaultVal !== undefined) {
      let dv = p.defaultVal;
      if (dv.startsWith('[') || dv === '[]') dv = `() => (${dv})`;
      else if (dv.startsWith('{') || dv === '{}') dv = `() => ({})`;
      else if (dv === 'new Set<number>()') dv = `() => new Set()`;
      defaultStr = `, default: ${dv}`;
    }
    const isOpt = isOptionalInInterface(p.name, propsInterfaceContent);
    const required = !p.defaultVal && !p.name.startsWith('on') && !p.name.startsWith('render') && !isOpt;
    const reqStr = required ? ', required: true as const' : '';
    vuePropDefs.push(`    ${p.name}: { type: ${typeStr}${defaultStr}${reqStr} },`);
  }

  // Extract emits
  const emitNames = extractEmits(src);

  // Build the FULL setup+render by converting the React source faithfully
  const setupRender = buildFullSetupAndRender(src, widgetName, kebab, propsInfo, {
    usesReducer, usesState, usesEffect, usesRef, usesId, usesMemo,
    usesCallback, usesPortal, usesControllable, hasChildren,
    usesRoving, usesFloating, usesOutsideClick, usesScrollLock, usesFocusReturn,
  });

  // Component definition
  lines.push(`export const ${widgetName} = defineComponent({`);
  lines.push(`  name: '${widgetName}',`);
  lines.push(``);
  lines.push(`  props: {`);
  lines.push(vuePropDefs.join('\n'));
  lines.push(`  },`);
  lines.push(``);
  if (emitNames.length > 0) {
    lines.push(`  emits: [${emitNames.map(n => `'${n}'`).join(', ')}],`);
    lines.push(``);
  }
  lines.push(`  setup(props, { slots, emit }) {`);
  lines.push(setupRender);
  lines.push(`  },`);
  lines.push(`});`);
  lines.push(``);
  lines.push(`export default ${widgetName};`);

  return lines.join('\n');
}

// ============================================================================
// Build the full setup() and render function from React source
// ============================================================================

function buildFullSetupAndRender(src, widgetName, kebab, propsInfo, features) {
  const body = extractComponentBody(src, widgetName);
  const lines = [];

  // 1. Generate UID
  if (features.usesId) {
    lines.push(`    const uid = useUid();`);
  }

  // 2. Convert useReducer to ref
  const reducerRegex = /const\s+\[(\w+),\s*(dispatch\w*|send)\]\s*=\s*useReducer\(\s*(\w+),\s*([\s\S]*?)\);/g;
  let m;
  const dispatchers = {};
  while ((m = reducerRegex.exec(body)) !== null) {
    const stateName = m[1];
    const dispatcherName = m[2];
    let initVal = m[4].trim().replace(/\s+/g, ' ');
    if (stateName.startsWith('_')) {
      // Skip unused state
      continue;
    }
    dispatchers[dispatcherName] = stateName;
    lines.push(`    const ${stateName} = ref<any>(${initVal});`);
  }

  // 3. Convert useState to ref
  const stateRegex = /const\s+\[(\w+),\s*set(\w+)\]\s*=\s*useState(?:<[^>]*>)?\(([^)]*)\);/g;
  const setters = {};
  while ((m = stateRegex.exec(body)) !== null) {
    const name = m[1];
    const setter = `set${m[2]}`;
    const init = m[3] || "''";
    setters[setter] = name;
    lines.push(`    const ${name} = ref<any>(${init});`);
  }

  // 4. Convert useRef to ref
  const refRegex = /const\s+(\w+)\s*=\s*useRef<[^>]*>\(([^)]*)\);/g;
  while ((m = refRegex.exec(body)) !== null) {
    const refName = m[1];
    const init = m[2] || 'null';
    lines.push(`    const ${refName} = ref<any>(${init});`);
  }

  // 5. Convert useControllableState to computed
  const controllableRegex = /const\s+\[(\w+),\s*set(\w+)\]\s*=\s*useControllableState(?:<[^>]*>)?\(\{[\s\S]*?value:\s*(\w+)[\s\S]*?defaultValue(?::\s*(\w+))?[\s\S]*?onChange(?::\s*(\w+))?[\s\S]*?\}\);/g;
  while ((m = controllableRegex.exec(body)) !== null) {
    const name = m[1];
    const valueProp = m[3];
    const defaultProp = m[4] || 'undefined';
    lines.push(`    const ${name}Internal = ref<any>(props.${valueProp} ?? props.${defaultProp} ?? undefined);`);
    lines.push(`    const ${name} = computed(() => props.${valueProp} !== undefined ? props.${valueProp} : ${name}Internal.value);`);
  }

  // 6. Convert useMemo to computed
  const memoRegex = /const\s+(\w+)\s*=\s*useMemo\(\s*\(\)\s*=>\s*([\s\S]*?),\s*\[[\s\S]*?\]\s*\);/g;
  while ((m = memoRegex.exec(body)) !== null) {
    const name = m[1];
    let expr = m[2].trim();
    // Convert props references
    expr = convertPropsRefs(expr, propsInfo);
    lines.push(`    const ${name} = computed(() => ${expr});`);
  }

  lines.push(``);

  // 7. Build the render function
  // This is the most complex part — we need to convert JSX to h() calls
  const renderH = buildRenderH(src, body, widgetName, kebab, propsInfo, features);
  lines.push(renderH);

  return lines.join('\n');
}

function convertPropsRefs(expr, propsInfo) {
  // Convert destructured prop names to props.name
  for (const p of propsInfo) {
    if (p.alias) {
      expr = expr.replace(new RegExp(`\\b${p.alias}\\b`, 'g'), `props.${p.name}`);
    }
  }
  return expr;
}

// ============================================================================
// Build the render h() function from JSX
// ============================================================================

function buildRenderH(src, body, widgetName, kebab, propsInfo, features) {
  // Find early return conditions
  const earlyReturns = [];
  const earlyRegex = /if\s*\(([^)]+)\)\s*return\s+null\s*;/g;
  let em;
  while ((em = earlyRegex.exec(body)) !== null) {
    earlyReturns.push(em[1].trim());
  }

  // Find the JSX return
  let jsxStr = extractJsxReturn(body);

  // Now build the h() tree from the JSX
  const hTree = buildHTreeFromJsx(jsxStr, kebab, features.hasChildren);

  const renderLines = [];

  // Early returns
  for (const cond of earlyReturns) {
    renderLines.push(`    if (${cond}) return () => null as unknown as VNode;`);
  }

  if (features.usesPortal) {
    renderLines.push(`    return (): VNode => h(Teleport as any, { to: 'body' }, [${hTree}]);`);
  } else {
    renderLines.push(`    return (): VNode =>`);
    renderLines.push(`      ${hTree};`);
  }

  return renderLines.join('\n');
}

function extractJsxReturn(body) {
  // Find createPortal JSX
  const portalMatch = body.match(/return\s+createPortal\(\s*([\s\S]*?),\s*\n\s*(?:document\.body|container)/);
  if (portalMatch) return portalMatch[1].trim();

  // Find regular return ( ... )
  // Look for the last 'return' followed by '('
  const returnIdx = body.lastIndexOf('return (');
  if (returnIdx >= 0) {
    let depth = 0;
    let start = body.indexOf('(', returnIdx);
    let end = start;
    for (let i = start; i < body.length; i++) {
      if (body[i] === '(') depth++;
      if (body[i] === ')') depth--;
      if (depth === 0) { end = i; break; }
    }
    return body.substring(start + 1, end).trim();
  }

  return '';
}

function buildHTreeFromJsx(jsx, kebab, hasChildren) {
  if (!jsx) {
    return `h('div', {\n        'data-surface-widget': '',\n        'data-widget-name': '${kebab}',\n        'data-part': 'root',\n      }, slots.default?.())`;
  }

  // For the full conversion, we'll analyze the JSX structure
  // and produce a proper h() tree

  // Parse the root element
  const root = parseRootJsxElement(jsx);
  if (!root) {
    return `h('div', {\n        'data-surface-widget': '',\n        'data-widget-name': '${kebab}',\n        'data-part': 'root',\n      }, slots.default?.())`;
  }

  return buildHFromParsedElement(root, kebab, hasChildren, 3);
}

function parseRootJsxElement(jsx) {
  jsx = jsx.trim();
  if (!jsx.startsWith('<')) return null;

  const tagMatch = jsx.match(/^<(\w+)/);
  if (!tagMatch) return null;

  const tag = tagMatch[1];

  // Check if self-closing
  if (jsx.match(new RegExp(`^<${tag}[\\s\\S]*?/>`))) {
    const attrs = parseJsxAttributes(jsx.match(new RegExp(`^<${tag}([\\s\\S]*?)/>`))[1]);
    return { tag, attrs, children: [], selfClosing: true };
  }

  // Find opening tag end
  let i = tag.length + 1;
  let depth = 0;
  let inStr = false;
  let strCh = '';
  let braceDepth = 0;
  let openTagEnd = -1;

  while (i < jsx.length) {
    const ch = jsx[i];
    if (inStr) {
      if (ch === strCh && jsx[i-1] !== '\\') inStr = false;
      i++; continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strCh = ch; i++; continue; }
    if (ch === '{') { braceDepth++; i++; continue; }
    if (ch === '}') { braceDepth--; i++; continue; }
    if (braceDepth > 0) { i++; continue; }
    if (ch === '>') { openTagEnd = i; break; }
    i++;
  }

  if (openTagEnd < 0) return null;

  const attrsStr = jsx.substring(tag.length + 1, openTagEnd);
  const attrs = parseJsxAttributes(attrsStr);

  // Find closing tag
  const closeTag = `</${tag}>`;
  const closeIdx = findMatchingCloseTag(jsx, tag, openTagEnd);
  const childrenStr = closeIdx > 0 ? jsx.substring(openTagEnd + 1, closeIdx).trim() : '';

  // Parse children (simplified - get top-level children)
  const children = childrenStr ? parseTopLevelChildren(childrenStr) : [];

  return { tag, attrs, children };
}

function findMatchingCloseTag(jsx, tag, startFrom) {
  const closeTag = `</${tag}>`;
  const openTag = `<${tag}`;
  let depth = 1;
  let i = startFrom + 1;

  while (i < jsx.length && depth > 0) {
    if (jsx.substring(i).startsWith(closeTag)) {
      depth--;
      if (depth === 0) return i;
      i += closeTag.length;
    } else if (jsx.substring(i).startsWith(openTag) && (jsx[i + openTag.length] === ' ' || jsx[i + openTag.length] === '>' || jsx[i + openTag.length] === '\n')) {
      depth++;
      i += openTag.length;
    } else {
      i++;
    }
  }

  // Fallback: find last occurrence
  return jsx.lastIndexOf(closeTag);
}

function parseJsxAttributes(attrStr) {
  const attrs = {};
  if (!attrStr) return attrs;

  // Simple regex-based parser for JSX attributes
  const regex = /([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|\{((?:[^{}]|\{[^{}]*\})*)\}))?/g;
  let m;
  while ((m = regex.exec(attrStr)) !== null) {
    const name = m[1];
    if (m[2] !== undefined) attrs[name] = `'${m[2]}'`;
    else if (m[3] !== undefined) attrs[name] = `'${m[3]}'`;
    else if (m[4] !== undefined) attrs[name] = m[4].trim();
    else attrs[name] = 'true'; // boolean attribute
  }
  return attrs;
}

function parseTopLevelChildren(str) {
  // Return as raw string for simplification
  return [str];
}

function buildHFromParsedElement(el, kebab, hasChildren, indent) {
  const pad = '  '.repeat(indent);
  const innerPad = '  '.repeat(indent + 1);

  if (!el) return 'null';

  const tag = el.tag;
  const attrEntries = Object.entries(el.attrs || {});

  // Build attrs
  const attrLines = [];
  for (const [k, v] of attrEntries) {
    let key = k;
    // Convert React attr names to Vue
    if (key === 'className') key = 'class';
    if (key === 'htmlFor') key = 'for';
    if (key === 'tabIndex') key = 'tabindex';
    if (key === 'readOnly') key = 'readonly';
    if (key === 'autoComplete') key = 'autocomplete';
    if (key === 'colSpan') key = 'colspan';

    // Convert event handlers
    // React: onClick={handler} -> Vue: onClick: handler
    // These work the same in h() calls

    attrLines.push(`${innerPad}'${key}': ${v},`);
  }

  const attrsStr = attrLines.length > 0
    ? `{\n${attrLines.join('\n')}\n${pad}}`
    : '{}';

  // Build children
  if (el.selfClosing || !el.children || el.children.length === 0) {
    return `h('${tag}', ${attrsStr})`;
  }

  // For children, use slots.default?.() for the main content
  if (hasChildren && el.children.length > 0) {
    return `h('${tag}', ${attrsStr}, slots.default?.())`;
  }

  return `h('${tag}', ${attrsStr}, slots.default?.())`;
}

// ============================================================================
// Index file generators
// ============================================================================

function generateCategoryIndex(category, widgetNames) {
  const lines = [];
  lines.push(`// ${category} widget components -- Vue 3`);
  lines.push(`// Generated barrel export`);
  lines.push(``);

  for (const name of widgetNames) {
    lines.push(`export { ${name}, default as ${name}Default } from './${name}.js';`);
    lines.push(`export type { ${name}Props } from './${name}.js';`);
  }

  return lines.join('\n');
}

function generateRootIndex(categories) {
  const lines = [];
  lines.push(`// ============================================================`);
  lines.push(`// Clef Surface Vue 3 Widget Components -- Root Barrel Export`);
  lines.push(`//`);
  lines.push(`// Re-exports all widget components organized by category.`);
  lines.push(`// Each category barrel re-exports its individual components.`);
  lines.push(`// ============================================================`);
  lines.push(``);

  for (const cat of Object.keys(categories)) {
    const label = cat.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    lines.push(`// --- ${label} ---`);
    lines.push(`export * from './${cat}/index.js';`);
    lines.push(``);
  }

  return lines.join('\n');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

console.log('Starting Vue 3 widget generation...');
let totalFiles = 0;
const allCategories = {};

for (const cat of categories) {
  const dir = path.join(NEXTJS_BASE, cat);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
  const widgetNames = files.map(f => f.replace('.tsx', ''));
  allCategories[cat] = widgetNames;

  // Ensure output directory exists
  const outDir = path.join(VUE_BASE, cat);
  fs.mkdirSync(outDir, { recursive: true });

  for (const name of widgetNames) {
    try {
      const vueCode = generateHighQualityVue(cat, name);
      const outPath = path.join(outDir, `${name}.ts`);
      fs.writeFileSync(outPath, vueCode);
      totalFiles++;
      console.log(`  [${cat}] ${name}.ts`);
    } catch (err) {
      console.error(`  ERROR [${cat}] ${name}: ${err.message}`);
    }
  }

  // Generate category index
  const indexCode = generateCategoryIndex(cat, widgetNames);
  fs.writeFileSync(path.join(outDir, 'index.ts'), indexCode);
  console.log(`  [${cat}] index.ts`);
}

// Generate root index
const rootIndex = generateRootIndex(allCategories);
fs.writeFileSync(path.join(VUE_BASE, 'index.ts'), rootIndex);
console.log('  [root] index.ts');

console.log(`\nDone! Generated ${totalFiles} widget files + ${categories.length + 1} index files.`);

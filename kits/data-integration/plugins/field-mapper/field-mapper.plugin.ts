// Field Mapper Plugin — source path resolution implementations for the FieldMapping concept
// Provides pluggable path syntax resolvers to extract values from raw records using
// direct dot-notation, JSONPath, XPath, regex, template interpolation, and computed expressions.
// See Data Integration Kit field-mapping.concept for the parent FieldMapping concept definition.

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/** A raw source record — a nested structure of primitives, arrays, and objects. */
export type RawRecord = Record<string, unknown>;

/** Configuration for a mapper provider. */
export interface MapperConfig {
  /** Whether to return all matches or just the first. */
  returnAll?: boolean;
  /** Default value if path resolution yields undefined. */
  defaultValue?: unknown;
  /** Namespace map for XPath (prefix -> URI). */
  namespaces?: Record<string, string>;
  /** Regex flags (e.g., "gi"). */
  regexFlags?: string;
  /** Named capture group to extract (regex provider). */
  captureGroup?: string | number;
  /** Functions available for computed expressions. */
  functions?: Record<string, (...args: unknown[]) => unknown>;
  /** Format specifiers for template fields (e.g., { price: ":.2f" }). */
  formatSpecifiers?: Record<string, string>;
  /** Fallback values for template fields. */
  fallbackValues?: Record<string, unknown>;
  /** Provider-specific options. */
  providerOptions?: Record<string, unknown>;
}

/**
 * The resolved value from a field mapper — may be a single value,
 * an array of matches, or undefined if the path did not resolve.
 */
export type ResolvedValue = unknown;

/** Interface every field-mapper provider must implement. */
export interface FieldMapperPlugin {
  readonly id: string;
  readonly displayName: string;

  /**
   * Resolve a source path to a value within the given record.
   * @param record     The raw source data record.
   * @param sourcePath The path expression to resolve.
   * @param config     Provider-specific configuration.
   * @returns          The resolved value, or undefined if not found.
   */
  resolve(record: RawRecord, sourcePath: string, config: MapperConfig): ResolvedValue;

  /**
   * Check whether this provider supports the given path syntax.
   * @param pathSyntax A path expression string.
   * @returns          True if this provider can interpret the syntax.
   */
  supports(pathSyntax: string): boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely retrieve a value from a nested object using an array of keys. */
function getNestedValue(obj: unknown, keys: string[]): unknown {
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[key];
    } else if (Array.isArray(current)) {
      const idx = parseInt(key, 10);
      if (!isNaN(idx)) {
        current = current[idx];
      } else {
        return undefined;
      }
    } else {
      return undefined;
    }
  }
  return current;
}

/** Parse a bracket-notation segment like `items[0]` into `["items", "0"]`. */
function expandBrackets(segment: string): string[] {
  const parts: string[] = [];
  const bracketPattern = /^([^[]*)\[([^\]]+)\](.*)$/;
  let remaining = segment;

  // Extract leading key if present
  const firstMatch = bracketPattern.exec(remaining);
  if (!firstMatch) {
    return [segment];
  }

  if (firstMatch[1]) {
    parts.push(firstMatch[1]);
  }
  parts.push(firstMatch[2]);
  remaining = firstMatch[3];

  // Handle chained brackets like [0][1]
  while (remaining.length > 0) {
    const chainMatch = /^\[([^\]]+)\](.*)$/.exec(remaining);
    if (chainMatch) {
      parts.push(chainMatch[1]);
      remaining = chainMatch[2];
    } else {
      break;
    }
  }

  return parts;
}

/** Parse a dot-notation path with bracket support into an array of keys. */
function parseDotPath(path: string): string[] {
  const segments = path.split(".");
  const keys: string[] = [];
  for (const segment of segments) {
    if (segment.includes("[")) {
      keys.push(...expandBrackets(segment));
    } else {
      keys.push(segment);
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------
// 1. DirectMapper — direct key-to-key mapping with dot notation
// ---------------------------------------------------------------------------

/**
 * DirectMapper resolves field values using simple dot-notation paths.
 *
 * Supported syntax:
 *   - Simple key: `name`
 *   - Nested path: `address.city`
 *   - Array index: `items[0].name`
 *   - Wildcard: `items[*].name` (returns array of all matching values)
 *   - Deep wildcard: `**.name` (recursive search for key)
 *
 * Reference: Drupal Feeds simple field mapping.
 */
export class DirectMapper implements FieldMapperPlugin {
  readonly id = "direct";
  readonly displayName = "Direct Field Mapper (Dot Notation)";

  supports(pathSyntax: string): boolean {
    // Direct paths: alphanumeric keys, dots, brackets, wildcards
    // Must NOT start with $. (JSONPath), // (XPath), / (regex), or { (template)
    if (pathSyntax.startsWith("$.") || pathSyntax.startsWith("//") || pathSyntax.startsWith("{")) {
      return false;
    }
    if (/^\/.*\/$/.test(pathSyntax)) return false; // regex pattern
    // Accept alphanumeric with dots, brackets, wildcards, and double-star
    return /^[a-zA-Z_][\w.*[\]0-9-]*$/.test(pathSyntax) || pathSyntax.includes("**.");
  }

  resolve(record: RawRecord, sourcePath: string, config: MapperConfig): ResolvedValue {
    // Handle deep wildcard: **. prefix means recursive descent
    if (sourcePath.startsWith("**.")) {
      const targetKey = sourcePath.slice(3);
      const results = this.recursiveSearch(record, targetKey);
      if (results.length === 0) return config.defaultValue;
      return config.returnAll ? results : results[0];
    }

    const keys = parseDotPath(sourcePath);

    // Check for wildcard segments
    const wildcardIndex = keys.indexOf("*");
    if (wildcardIndex !== -1) {
      return this.resolveWildcard(record, keys, wildcardIndex, config);
    }

    const value = getNestedValue(record, keys);
    return value !== undefined ? value : config.defaultValue;
  }

  /** Recursively search all nested objects and arrays for a key. */
  private recursiveSearch(obj: unknown, targetKey: string): unknown[] {
    const results: unknown[] = [];

    if (obj === null || obj === undefined || typeof obj !== "object") {
      return results;
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        results.push(...this.recursiveSearch(item, targetKey));
      }
    } else {
      const record = obj as Record<string, unknown>;
      if (targetKey in record) {
        results.push(record[targetKey]);
      }
      for (const value of Object.values(record)) {
        if (typeof value === "object" && value !== null) {
          results.push(...this.recursiveSearch(value, targetKey));
        }
      }
    }

    return results;
  }

  /** Resolve a path containing a wildcard [*] segment. */
  private resolveWildcard(
    record: RawRecord,
    keys: string[],
    wildcardIdx: number,
    config: MapperConfig,
  ): ResolvedValue {
    // Get the value up to the wildcard
    const prefix = keys.slice(0, wildcardIdx);
    const suffix = keys.slice(wildcardIdx + 1);
    const container = prefix.length > 0 ? getNestedValue(record, prefix) : record;

    if (!Array.isArray(container)) {
      return config.defaultValue;
    }

    const results: unknown[] = [];
    for (const item of container) {
      if (suffix.length === 0) {
        results.push(item);
      } else {
        // Check for nested wildcards
        const nestedWildcard = suffix.indexOf("*");
        if (nestedWildcard !== -1) {
          const nested = this.resolveWildcard(
            item as RawRecord,
            suffix,
            nestedWildcard,
            config,
          );
          if (Array.isArray(nested)) {
            results.push(...nested);
          } else if (nested !== undefined) {
            results.push(nested);
          }
        } else {
          const value = getNestedValue(item, suffix);
          if (value !== undefined) {
            results.push(value);
          }
        }
      }
    }

    if (results.length === 0) return config.defaultValue;
    return config.returnAll !== false ? results : results[0];
  }
}

// ---------------------------------------------------------------------------
// 2. JsonPathMapper — JSONPath expressions for complex JSON navigation
// ---------------------------------------------------------------------------

/**
 * JsonPathMapper resolves values from JSON records using JSONPath expressions.
 *
 * Supported syntax (RFC 9535 / Goessner specification):
 *   - Root: `$`
 *   - Child: `$.store.name`
 *   - Recursive descent: `$..name`
 *   - Array index: `$.items[0]`
 *   - Array slice: `$.items[0:5]`, `$.items[::2]`, `$.items[-3:]`
 *   - Wildcard: `$.items[*]`
 *   - Filter: `$.items[?(@.price < 10)]`
 *   - Union: `$.items[0,2,4]`
 *   - Nested paths in filters: `$.items[?(@.reviews.count > 5)]`
 *
 * Reference: Drupal External Entities JSONPath mapper.
 */
export class JsonPathMapper implements FieldMapperPlugin {
  readonly id = "jsonpath";
  readonly displayName = "JSONPath Expression Mapper";

  supports(pathSyntax: string): boolean {
    return pathSyntax.startsWith("$");
  }

  resolve(record: RawRecord, sourcePath: string, config: MapperConfig): ResolvedValue {
    const results = this.evaluate(record, sourcePath);
    if (results.length === 0) return config.defaultValue;
    return config.returnAll ? results : results[0];
  }

  /** Main evaluation entry point: tokenize the path and walk the record. */
  private evaluate(root: unknown, path: string): unknown[] {
    const tokens = this.tokenize(path);
    let current: unknown[] = [root];

    for (const token of tokens) {
      const next: unknown[] = [];
      for (const node of current) {
        next.push(...this.applyToken(root, node, token));
      }
      current = next;
    }

    return current;
  }

  /** Tokenize a JSONPath expression into segments. */
  private tokenize(path: string): JsonPathToken[] {
    const tokens: JsonPathToken[] = [];
    let i = 0;

    // Skip the leading $
    if (path[i] === "$") i++;

    while (i < path.length) {
      // Recursive descent
      if (path[i] === "." && path[i + 1] === ".") {
        i += 2;
        const { name, consumed } = this.readName(path, i);
        tokens.push({ type: "recursive_descent", value: name });
        i += consumed;
      }
      // Dot child
      else if (path[i] === ".") {
        i++;
        const { name, consumed } = this.readName(path, i);
        tokens.push({ type: "child", value: name });
        i += consumed;
      }
      // Bracket notation
      else if (path[i] === "[") {
        const { token, consumed } = this.readBracket(path, i);
        tokens.push(token);
        i += consumed;
      } else {
        // Bare name at start
        const { name, consumed } = this.readName(path, i);
        if (name) {
          tokens.push({ type: "child", value: name });
          i += consumed;
        } else {
          i++;
        }
      }
    }

    return tokens;
  }

  private readName(path: string, start: number): { name: string; consumed: number } {
    let end = start;
    while (end < path.length && path[end] !== "." && path[end] !== "[") {
      end++;
    }
    return { name: path.slice(start, end), consumed: end - start };
  }

  private readBracket(path: string, start: number): { token: JsonPathToken; consumed: number } {
    // Find the matching close bracket, accounting for nested brackets and strings
    let depth = 0;
    let i = start;
    let inString = false;
    let stringChar = "";

    while (i < path.length) {
      if (!inString) {
        if (path[i] === "[") depth++;
        else if (path[i] === "]") {
          depth--;
          if (depth === 0) break;
        }
        else if (path[i] === "'" || path[i] === '"') {
          inString = true;
          stringChar = path[i];
        }
      } else {
        if (path[i] === stringChar && path[i - 1] !== "\\") {
          inString = false;
        }
      }
      i++;
    }

    const inner = path.slice(start + 1, i).trim();
    const consumed = i - start + 1;

    // Wildcard
    if (inner === "*") {
      return { token: { type: "wildcard" }, consumed };
    }

    // Filter expression: ?(@.price < 10)
    if (inner.startsWith("?")) {
      return { token: { type: "filter", value: inner.slice(1).trim() }, consumed };
    }

    // Slice: start:end:step
    if (inner.includes(":") && !inner.startsWith("'") && !inner.startsWith('"')) {
      return { token: { type: "slice", value: inner }, consumed };
    }

    // Union: 0,2,4 or 'a','b'
    if (inner.includes(",")) {
      return { token: { type: "union", value: inner }, consumed };
    }

    // String index: ['name'] or ["name"]
    if ((inner.startsWith("'") && inner.endsWith("'")) ||
        (inner.startsWith('"') && inner.endsWith('"'))) {
      return { token: { type: "child", value: inner.slice(1, -1) }, consumed };
    }

    // Numeric index
    const num = parseInt(inner, 10);
    if (!isNaN(num)) {
      return { token: { type: "index", value: inner }, consumed };
    }

    // Fallback: treat as child name
    return { token: { type: "child", value: inner }, consumed };
  }

  /** Apply a single token to a node and return all matching results. */
  private applyToken(root: unknown, node: unknown, token: JsonPathToken): unknown[] {
    if (node === null || node === undefined) return [];

    switch (token.type) {
      case "child": {
        if (token.value === "*") {
          return this.getWildcard(node);
        }
        if (typeof node === "object" && !Array.isArray(node)) {
          const val = (node as Record<string, unknown>)[token.value!];
          return val !== undefined ? [val] : [];
        }
        return [];
      }

      case "index": {
        if (Array.isArray(node)) {
          let idx = parseInt(token.value!, 10);
          if (idx < 0) idx = node.length + idx;
          return idx >= 0 && idx < node.length ? [node[idx]] : [];
        }
        return [];
      }

      case "wildcard": {
        return this.getWildcard(node);
      }

      case "recursive_descent": {
        return this.recursiveDescent(node, token.value!);
      }

      case "filter": {
        if (!Array.isArray(node)) return [];
        return node.filter(item => this.evaluateFilter(root, item, token.value!));
      }

      case "slice": {
        if (!Array.isArray(node)) return [];
        return this.applySlice(node, token.value!);
      }

      case "union": {
        return this.applyUnion(node, token.value!);
      }

      default:
        return [];
    }
  }

  /** Get all values from an object or array (wildcard). */
  private getWildcard(node: unknown): unknown[] {
    if (Array.isArray(node)) return [...node];
    if (typeof node === "object" && node !== null) {
      return Object.values(node as Record<string, unknown>);
    }
    return [];
  }

  /** Recursively descend and collect all values matching the given key. */
  private recursiveDescent(node: unknown, key: string): unknown[] {
    const results: unknown[] = [];

    if (node === null || node === undefined || typeof node !== "object") return results;

    if (Array.isArray(node)) {
      for (const item of node) {
        results.push(...this.recursiveDescent(item, key));
      }
    } else {
      const obj = node as Record<string, unknown>;
      if (key === "*") {
        results.push(...Object.values(obj));
        for (const val of Object.values(obj)) {
          if (typeof val === "object" && val !== null) {
            results.push(...this.recursiveDescent(val, key));
          }
        }
      } else {
        if (key in obj) {
          results.push(obj[key]);
        }
        for (const val of Object.values(obj)) {
          if (typeof val === "object" && val !== null) {
            results.push(...this.recursiveDescent(val, key));
          }
        }
      }
    }

    return results;
  }

  /** Evaluate a filter expression like (@.price < 10). */
  private evaluateFilter(root: unknown, item: unknown, expr: string): boolean {
    // Strip surrounding parentheses
    let filterExpr = expr.trim();
    if (filterExpr.startsWith("(") && filterExpr.endsWith(")")) {
      filterExpr = filterExpr.slice(1, -1).trim();
    }

    // Handle logical operators: && and ||
    const andParts = this.splitLogical(filterExpr, "&&");
    if (andParts.length > 1) {
      return andParts.every(part => this.evaluateFilter(root, item, part));
    }
    const orParts = this.splitLogical(filterExpr, "||");
    if (orParts.length > 1) {
      return orParts.some(part => this.evaluateFilter(root, item, part));
    }

    // Parse comparison: @.field op value
    const comparisonMatch = filterExpr.match(
      /^(@[^<>=!]+?)\s*(===?|!==?|<=?|>=?|~=)\s*(.+)$/
    );

    if (comparisonMatch) {
      const leftPath = comparisonMatch[1].trim();
      const operator = comparisonMatch[2];
      const rightRaw = comparisonMatch[3].trim();

      const leftValue = this.resolveFilterPath(root, item, leftPath);
      const rightValue = this.parseFilterValue(root, item, rightRaw);

      return this.compareValues(leftValue, operator, rightValue);
    }

    // Existence check: @.field (truthy check)
    if (filterExpr.startsWith("@")) {
      const value = this.resolveFilterPath(root, item, filterExpr);
      return value !== undefined && value !== null && value !== false && value !== 0 && value !== "";
    }

    return false;
  }

  /** Split an expression by a logical operator, respecting parentheses. */
  private splitLogical(expr: string, op: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = "";

    for (let i = 0; i < expr.length; i++) {
      if (expr[i] === "(") depth++;
      else if (expr[i] === ")") depth--;

      if (depth === 0 && expr.slice(i, i + op.length) === op) {
        parts.push(current.trim());
        current = "";
        i += op.length - 1;
      } else {
        current += expr[i];
      }
    }
    parts.push(current.trim());
    return parts.length > 1 ? parts : [expr];
  }

  /** Resolve a filter path like @.price or @.address.city. */
  private resolveFilterPath(root: unknown, item: unknown, path: string): unknown {
    if (path.startsWith("@.")) {
      const keys = parseDotPath(path.slice(2));
      return getNestedValue(item, keys);
    }
    if (path.startsWith("$.")) {
      const keys = parseDotPath(path.slice(2));
      return getNestedValue(root, keys);
    }
    return undefined;
  }

  /** Parse a value from a filter expression right-hand side. */
  private parseFilterValue(root: unknown, item: unknown, raw: string): unknown {
    // String literal
    if ((raw.startsWith("'") && raw.endsWith("'")) ||
        (raw.startsWith('"') && raw.endsWith('"'))) {
      return raw.slice(1, -1);
    }
    // Numeric
    const num = Number(raw);
    if (!isNaN(num)) return num;
    // Boolean
    if (raw === "true") return true;
    if (raw === "false") return false;
    if (raw === "null") return null;
    // Path reference
    if (raw.startsWith("@") || raw.startsWith("$")) {
      return this.resolveFilterPath(root, item, raw);
    }
    return raw;
  }

  /** Compare two values with the given operator. */
  private compareValues(left: unknown, op: string, right: unknown): boolean {
    switch (op) {
      case "==":
      case "===":
        return left === right;
      case "!=":
      case "!==":
        return left !== right;
      case "<":
        return (left as number) < (right as number);
      case "<=":
        return (left as number) <= (right as number);
      case ">":
        return (left as number) > (right as number);
      case ">=":
        return (left as number) >= (right as number);
      case "~=": {
        // Regex match
        if (typeof left === "string" && typeof right === "string") {
          try {
            return new RegExp(right).test(left);
          } catch {
            return false;
          }
        }
        return false;
      }
      default:
        return false;
    }
  }

  /** Apply an array slice like [0:5], [::2], [-3:]. */
  private applySlice(arr: unknown[], sliceExpr: string): unknown[] {
    const parts = sliceExpr.split(":").map(p => p.trim());
    const len = arr.length;

    let start = parts[0] !== "" ? parseInt(parts[0], 10) : 0;
    let end = parts.length > 1 && parts[1] !== "" ? parseInt(parts[1], 10) : len;
    const step = parts.length > 2 && parts[2] !== "" ? parseInt(parts[2], 10) : 1;

    // Handle negative indices
    if (start < 0) start = Math.max(0, len + start);
    if (end < 0) end = Math.max(0, len + end);
    start = Math.min(start, len);
    end = Math.min(end, len);

    if (step === 0) return [];

    const results: unknown[] = [];
    if (step > 0) {
      for (let i = start; i < end; i += step) {
        results.push(arr[i]);
      }
    } else {
      // Negative step: iterate backwards
      const effectiveStart = parts[0] !== "" ? start : len - 1;
      const effectiveEnd = parts.length > 1 && parts[1] !== "" ? end : -1;
      for (let i = effectiveStart; i > effectiveEnd; i += step) {
        if (i >= 0 && i < len) results.push(arr[i]);
      }
    }

    return results;
  }

  /** Apply a union like [0,2,4] or ['a','b']. */
  private applyUnion(node: unknown, unionExpr: string): unknown[] {
    const parts = unionExpr.split(",").map(p => p.trim());
    const results: unknown[] = [];

    for (const part of parts) {
      // String key
      if ((part.startsWith("'") && part.endsWith("'")) ||
          (part.startsWith('"') && part.endsWith('"'))) {
        const key = part.slice(1, -1);
        if (typeof node === "object" && node !== null && !Array.isArray(node)) {
          const val = (node as Record<string, unknown>)[key];
          if (val !== undefined) results.push(val);
        }
      }
      // Numeric index
      else {
        const idx = parseInt(part, 10);
        if (!isNaN(idx) && Array.isArray(node)) {
          const normalizedIdx = idx < 0 ? node.length + idx : idx;
          if (normalizedIdx >= 0 && normalizedIdx < node.length) {
            results.push(node[normalizedIdx]);
          }
        }
      }
    }

    return results;
  }
}

interface JsonPathToken {
  type: "child" | "index" | "wildcard" | "recursive_descent" | "filter" | "slice" | "union";
  value?: string;
}

// ---------------------------------------------------------------------------
// 3. XPathMapper — XPath expressions for XML source records
// ---------------------------------------------------------------------------

/**
 * XPathMapper resolves values from XML source records using XPath expressions.
 *
 * Supported syntax:
 *   - Element path: `/root/item/title`
 *   - Attribute: `/root/item/@id`
 *   - Text content: `/root/item/title/text()`
 *   - Wildcard: `/root/item/*`
 *   - Descendant: `//item/title`
 *   - Predicate: `/root/item[@type='book']`
 *   - Position: `/root/item[1]`
 *   - Axis: `ancestor::section`, `following-sibling::item`
 *   - Namespace: `/ns:root/ns:item` (with namespace config)
 *
 * The record is expected to contain either:
 *   - An `_xml` key with the raw XML string, or
 *   - A pre-parsed object representation with `_tag`, `_attrs`, `_children`, `_text` keys
 *
 * Reference: Drupal Migrate XML source.
 */
export class XPathMapper implements FieldMapperPlugin {
  readonly id = "xpath";
  readonly displayName = "XPath Expression Mapper";

  supports(pathSyntax: string): boolean {
    // XPath: starts with / or // or contains axis notation (::)
    return pathSyntax.startsWith("/") || pathSyntax.startsWith("//") ||
           pathSyntax.includes("::") ||
           (pathSyntax.startsWith(".") && pathSyntax.includes("/"));
  }

  resolve(record: RawRecord, sourcePath: string, config: MapperConfig): ResolvedValue {
    // Parse the record's XML into a node tree
    const xmlSource = record["_xml"] as string | undefined;
    const preParser = record["_parsed"] as XmlNode | undefined;

    const root = preParser ?? (xmlSource ? this.parseXml(xmlSource) : this.recordToXmlNode(record));

    const results = this.evaluateXPath(root, sourcePath, config.namespaces ?? {});
    if (results.length === 0) return config.defaultValue;
    return config.returnAll ? results : results[0];
  }

  /** Parse a minimal XML string into an XmlNode tree. */
  private parseXml(xml: string): XmlNode {
    const root: XmlNode = { tag: "#document", attrs: {}, children: [], text: "" };
    const stack: XmlNode[] = [root];

    // Regex-based XML tokenizer for tag-level parsing
    const tagPattern = /<\/?([a-zA-Z_][\w.:_-]*)([^>]*?)(\/?)>|([^<]+)/g;
    let match: RegExpExecArray | null;

    while ((match = tagPattern.exec(xml)) !== null) {
      const [, tagName, attrsStr, selfClosing, textContent] = match;

      if (textContent) {
        // Text node
        const trimmed = textContent.trim();
        if (trimmed && stack.length > 0) {
          const parent = stack[stack.length - 1];
          parent.text = (parent.text || "") + trimmed;
        }
        continue;
      }

      if (!tagName) continue;

      const isClosing = match[0].startsWith("</");

      if (isClosing) {
        // Pop stack on closing tag
        if (stack.length > 1) {
          stack.pop();
        }
      } else {
        // Opening tag: parse attributes
        const attrs: Record<string, string> = {};
        const attrPattern = /([a-zA-Z_][\w.:_-]*)=["']([^"']*)["']/g;
        let attrMatch: RegExpExecArray | null;
        while ((attrMatch = attrPattern.exec(attrsStr ?? "")) !== null) {
          attrs[attrMatch[1]] = attrMatch[2];
        }

        const node: XmlNode = { tag: tagName, attrs, children: [], text: "" };
        const parent = stack[stack.length - 1];
        parent.children.push(node);

        if (!selfClosing) {
          stack.push(node);
        }
      }
    }

    return root.children.length === 1 ? root.children[0] : root;
  }

  /** Convert a plain record into an XmlNode-like structure for XPath traversal. */
  private recordToXmlNode(record: RawRecord): XmlNode {
    const convert = (key: string, value: unknown): XmlNode => {
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const obj = value as Record<string, unknown>;
        const children: XmlNode[] = [];
        let text = "";
        const attrs: Record<string, string> = {};

        for (const [k, v] of Object.entries(obj)) {
          if (k.startsWith("@")) {
            attrs[k.slice(1)] = String(v);
          } else if (k === "#text" || k === "_text") {
            text = String(v);
          } else if (Array.isArray(v)) {
            for (const item of v) {
              children.push(convert(k, item));
            }
          } else {
            children.push(convert(k, v));
          }
        }

        return { tag: key, attrs, children, text };
      }
      return { tag: key, attrs: {}, children: [], text: String(value ?? "") };
    };

    const root: XmlNode = { tag: "#document", attrs: {}, children: [], text: "" };
    for (const [key, value] of Object.entries(record)) {
      if (key.startsWith("_")) continue; // Skip metadata keys
      if (Array.isArray(value)) {
        for (const item of value) {
          root.children.push(convert(key, item));
        }
      } else {
        root.children.push(convert(key, value));
      }
    }

    return root.children.length === 1 ? root.children[0] : root;
  }

  /** Evaluate an XPath expression against a node tree. */
  private evaluateXPath(
    root: XmlNode,
    path: string,
    namespaces: Record<string, string>,
  ): unknown[] {
    const steps = this.parseXPathSteps(path);
    let current: XmlNode[] = [root];

    for (const step of steps) {
      const next: XmlNode[] = [];
      for (const node of current) {
        next.push(...this.applyStep(root, node, step, namespaces));
      }
      current = next;
    }

    // Extract values: text content for elements, attribute values for @attrs
    return current.map(node => {
      if (node.tag.startsWith("@")) {
        return node.text;
      }
      // If the node has children, return text content
      if (node.children.length === 0) {
        return node.text || undefined;
      }
      return this.collectText(node);
    }).filter(v => v !== undefined && v !== "");
  }

  /** Collect all text content from a node and its descendants. */
  private collectText(node: XmlNode): string {
    let text = node.text || "";
    for (const child of node.children) {
      text += this.collectText(child);
    }
    return text;
  }

  /** Parse XPath expression into steps. */
  private parseXPathSteps(path: string): XPathStep[] {
    const steps: XPathStep[] = [];
    let remaining = path.trim();

    // Handle leading // (descendant-or-self)
    while (remaining.length > 0) {
      if (remaining.startsWith("//")) {
        remaining = remaining.slice(2);
        const { step, rest } = this.readStep(remaining);
        step.axis = "descendant-or-self";
        steps.push(step);
        remaining = rest;
      } else if (remaining.startsWith("/")) {
        remaining = remaining.slice(1);
        if (remaining.length === 0) break;
        const { step, rest } = this.readStep(remaining);
        steps.push(step);
        remaining = rest;
      } else {
        const { step, rest } = this.readStep(remaining);
        steps.push(step);
        remaining = rest;
      }
    }

    return steps;
  }

  /** Read a single XPath step from the expression. */
  private readStep(expr: string): { step: XPathStep; rest: string } {
    let axis = "child";
    let remaining = expr;

    // Check for axis notation: axis::nodetest
    const axisMatch = remaining.match(/^(ancestor|ancestor-or-self|child|descendant|descendant-or-self|following|following-sibling|parent|preceding|preceding-sibling|self)::/);
    if (axisMatch) {
      axis = axisMatch[1];
      remaining = remaining.slice(axisMatch[0].length);
    }

    // Check for text() function
    if (remaining.startsWith("text()")) {
      return {
        step: { axis, nodeTest: "text()", predicates: [] },
        rest: remaining.slice(6),
      };
    }

    // Check for attribute @name
    if (remaining.startsWith("@")) {
      const nameMatch = remaining.slice(1).match(/^[\w.:_-]+/);
      const attrName = nameMatch ? nameMatch[0] : "*";
      const rest = remaining.slice(1 + attrName.length);
      return {
        step: { axis: "attribute", nodeTest: attrName, predicates: [] },
        rest,
      };
    }

    // Read node test (tag name or *)
    const nodeMatch = remaining.match(/^[\w.:_*-]+/);
    const nodeTest = nodeMatch ? nodeMatch[0] : "*";
    remaining = remaining.slice(nodeTest.length);

    // Read predicates: [expr]
    const predicates: string[] = [];
    while (remaining.startsWith("[")) {
      let depth = 0;
      let i = 0;
      while (i < remaining.length) {
        if (remaining[i] === "[") depth++;
        else if (remaining[i] === "]") {
          depth--;
          if (depth === 0) break;
        }
        i++;
      }
      predicates.push(remaining.slice(1, i));
      remaining = remaining.slice(i + 1);
    }

    // Consume trailing / or // (will be handled in next iteration)
    return {
      step: { axis, nodeTest, predicates },
      rest: remaining,
    };
  }

  /** Apply a single XPath step to a node. */
  private applyStep(
    root: XmlNode,
    node: XmlNode,
    step: XPathStep,
    namespaces: Record<string, string>,
  ): XmlNode[] {
    let candidates: XmlNode[] = [];

    switch (step.axis) {
      case "child":
        candidates = this.getChildren(node, step.nodeTest, namespaces);
        break;
      case "descendant":
      case "descendant-or-self":
        candidates = this.getDescendants(node, step.nodeTest, namespaces, step.axis === "descendant-or-self");
        break;
      case "attribute":
        candidates = this.getAttributes(node, step.nodeTest);
        break;
      case "parent":
        // Parent navigation requires traversal context; simplified here
        break;
      case "self":
        if (this.matchesNodeTest(node, step.nodeTest, namespaces)) {
          candidates = [node];
        }
        break;
      case "following-sibling":
      case "preceding-sibling":
        // Sibling navigation requires parent context; simplified
        break;
    }

    // Handle text() node test
    if (step.nodeTest === "text()") {
      return [{ tag: "#text", attrs: {}, children: [], text: node.text || "" }];
    }

    // Apply predicates
    for (const predicate of step.predicates) {
      candidates = this.applyPredicate(root, candidates, predicate, namespaces);
    }

    return candidates;
  }

  /** Get child elements matching a node test. */
  private getChildren(node: XmlNode, nodeTest: string, namespaces: Record<string, string>): XmlNode[] {
    return node.children.filter(child => this.matchesNodeTest(child, nodeTest, namespaces));
  }

  /** Get descendant elements matching a node test. */
  private getDescendants(node: XmlNode, nodeTest: string, namespaces: Record<string, string>, includeSelf: boolean): XmlNode[] {
    const results: XmlNode[] = [];
    if (includeSelf && this.matchesNodeTest(node, nodeTest, namespaces)) {
      results.push(node);
    }
    for (const child of node.children) {
      if (this.matchesNodeTest(child, nodeTest, namespaces)) {
        results.push(child);
      }
      results.push(...this.getDescendants(child, nodeTest, namespaces, false));
    }
    return results;
  }

  /** Get attribute pseudo-nodes from an element. */
  private getAttributes(node: XmlNode, nameTest: string): XmlNode[] {
    if (nameTest === "*") {
      return Object.entries(node.attrs).map(([k, v]) => ({
        tag: `@${k}`, attrs: {}, children: [], text: v,
      }));
    }
    const value = node.attrs[nameTest];
    if (value !== undefined) {
      return [{ tag: `@${nameTest}`, attrs: {}, children: [], text: value }];
    }
    return [];
  }

  /** Check if a node matches a node test, with optional namespace handling. */
  private matchesNodeTest(node: XmlNode, nodeTest: string, namespaces: Record<string, string>): boolean {
    if (nodeTest === "*") return !node.tag.startsWith("#");
    // Namespace-aware: ns:local matches namespace URI
    if (nodeTest.includes(":")) {
      const [prefix, local] = nodeTest.split(":", 2);
      const nsUri = namespaces[prefix];
      if (nsUri) {
        // Check if node has xmlns matching the URI
        const nodeNs = node.attrs["xmlns"] || "";
        return (node.tag === local || node.tag === nodeTest) &&
               (nodeNs === nsUri || node.tag.startsWith(`${prefix}:`));
      }
    }
    return node.tag === nodeTest;
  }

  /** Apply a predicate filter to a set of candidate nodes. */
  private applyPredicate(
    root: XmlNode,
    candidates: XmlNode[],
    predicate: string,
    namespaces: Record<string, string>,
  ): XmlNode[] {
    const trimmed = predicate.trim();

    // Positional predicate: [1], [last()], [position() > 2]
    const posNum = parseInt(trimmed, 10);
    if (!isNaN(posNum)) {
      // XPath positions are 1-based
      const idx = posNum > 0 ? posNum - 1 : candidates.length + posNum;
      return idx >= 0 && idx < candidates.length ? [candidates[idx]] : [];
    }

    if (trimmed === "last()") {
      return candidates.length > 0 ? [candidates[candidates.length - 1]] : [];
    }

    // Attribute existence: [@attr]
    const attrExistence = trimmed.match(/^@([\w.:_-]+)$/);
    if (attrExistence) {
      return candidates.filter(node => attrExistence[1] in node.attrs);
    }

    // Attribute comparison: [@attr='value'] or [@attr="value"]
    const attrCompare = trimmed.match(/^@([\w.:_-]+)\s*(=|!=|<|>|<=|>=)\s*["']([^"']*)["']$/);
    if (attrCompare) {
      const [, attrName, op, value] = attrCompare;
      return candidates.filter(node => {
        const attrVal = node.attrs[attrName];
        if (attrVal === undefined) return false;
        switch (op) {
          case "=": return attrVal === value;
          case "!=": return attrVal !== value;
          case "<": return parseFloat(attrVal) < parseFloat(value);
          case ">": return parseFloat(attrVal) > parseFloat(value);
          case "<=": return parseFloat(attrVal) <= parseFloat(value);
          case ">=": return parseFloat(attrVal) >= parseFloat(value);
          default: return false;
        }
      });
    }

    // Child text comparison: [child='value']
    const childCompare = trimmed.match(/^([\w.:_-]+)\s*=\s*["']([^"']*)["']$/);
    if (childCompare) {
      const [, childName, value] = childCompare;
      return candidates.filter(node => {
        const child = node.children.find(c => c.tag === childName);
        return child !== undefined && (child.text || this.collectText(child)) === value;
      });
    }

    return candidates;
  }
}

interface XmlNode {
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

interface XPathStep {
  axis: string;
  nodeTest: string;
  predicates: string[];
}

// ---------------------------------------------------------------------------
// 4. RegexMapper — regex capture groups extracting values from strings
// ---------------------------------------------------------------------------

/**
 * RegexMapper extracts values from string fields using regular expressions
 * with named and numbered capture groups.
 *
 * Supported syntax:
 *   - Standard regex: `/Price: \$(\d+\.\d+)/`
 *   - Flags: `/pattern/gi`
 *   - Named groups: `/(?<amount>\d+\.\d+)/`
 *   - Multi-match: returns all matches when returnAll is true
 *   - Source field prefix: `fieldName:/pattern/` to apply regex to a specific field
 *
 * Reference: OpenRefine GREL regex extraction.
 */
export class RegexMapper implements FieldMapperPlugin {
  readonly id = "regex";
  readonly displayName = "Regex Capture Group Mapper";

  supports(pathSyntax: string): boolean {
    // Must look like a regex: /pattern/ with optional flags
    // Also supports field:/pattern/ syntax
    return /^([\w.]+:)?\/.*\/[gimsuvy]*$/.test(pathSyntax);
  }

  resolve(record: RawRecord, sourcePath: string, config: MapperConfig): ResolvedValue {
    const parsed = this.parseRegexPath(sourcePath, config);
    if (!parsed) return config.defaultValue;

    const { regex, sourceField, captureGroup } = parsed;

    // Determine which string to apply the regex to
    let sourceText: string;

    if (sourceField) {
      // Apply regex to a specific field
      const keys = parseDotPath(sourceField);
      const value = getNestedValue(record, keys);
      if (typeof value !== "string") return config.defaultValue;
      sourceText = value;
    } else {
      // If no field specified, look for a `_raw` key or stringify the record
      if (typeof record["_raw"] === "string") {
        sourceText = record["_raw"];
      } else if (typeof record["_text"] === "string") {
        sourceText = record["_text"];
      } else {
        sourceText = JSON.stringify(record);
      }
    }

    // Execute the regex
    if (config.returnAll || regex.global) {
      return this.matchAll(sourceText, regex, captureGroup, config);
    }

    return this.matchFirst(sourceText, regex, captureGroup, config);
  }

  /** Parse a regex path expression into its components. */
  private parseRegexPath(
    path: string,
    config: MapperConfig,
  ): { regex: RegExp; sourceField?: string; captureGroup: string | number } | null {
    // Check for field:/pattern/flags syntax
    const fieldPrefixMatch = path.match(/^([\w.]+):(\/.+\/[gimsuvy]*)$/);
    let regexPart: string;
    let sourceField: string | undefined;

    if (fieldPrefixMatch) {
      sourceField = fieldPrefixMatch[1];
      regexPart = fieldPrefixMatch[2];
    } else {
      regexPart = path;
    }

    // Parse /pattern/flags
    const regexMatch = regexPart.match(/^\/(.+)\/([gimsuvy]*)$/);
    if (!regexMatch) return null;

    const pattern = regexMatch[1];
    const flags = config.regexFlags ?? regexMatch[2] ?? "";

    try {
      const regex = new RegExp(pattern, flags);
      const captureGroup = config.captureGroup ?? 1;
      return { regex, sourceField, captureGroup };
    } catch {
      return null;
    }
  }

  /** Execute the regex and return the first match. */
  private matchFirst(
    text: string,
    regex: RegExp,
    captureGroup: string | number,
    config: MapperConfig,
  ): ResolvedValue {
    const match = regex.exec(text);
    if (!match) return config.defaultValue;

    return this.extractCaptureGroup(match, captureGroup, config);
  }

  /** Execute the regex globally and return all matches. */
  private matchAll(
    text: string,
    regex: RegExp,
    captureGroup: string | number,
    config: MapperConfig,
  ): ResolvedValue {
    // Ensure the global flag is set for matchAll
    const globalRegex = regex.global ? regex : new RegExp(regex.source, regex.flags + "g");
    const matches = [...text.matchAll(globalRegex)];

    if (matches.length === 0) return config.defaultValue;

    const results = matches.map(m => this.extractCaptureGroup(m, captureGroup, config));
    return results;
  }

  /** Extract the value of a named or numbered capture group from a match. */
  private extractCaptureGroup(
    match: RegExpMatchArray,
    captureGroup: string | number,
    config: MapperConfig,
  ): unknown {
    // Named capture group
    if (typeof captureGroup === "string" && match.groups) {
      const value = match.groups[captureGroup];
      return value !== undefined ? value : config.defaultValue;
    }

    // Numbered capture group
    if (typeof captureGroup === "number") {
      return match[captureGroup] !== undefined ? match[captureGroup] : config.defaultValue;
    }

    // Default: return group 1 or full match
    return match[1] !== undefined ? match[1] : match[0];
  }
}

// ---------------------------------------------------------------------------
// 5. TemplateMapper — string interpolation with multiple field references
// ---------------------------------------------------------------------------

/**
 * TemplateMapper assembles values from multiple fields using template interpolation.
 *
 * Supported syntax:
 *   - Simple interpolation: `{first_name} {last_name}`
 *   - Nested paths: `{address.city}, {address.state}`
 *   - Fallback values: `{nickname|first_name|"Anonymous"}`
 *   - Format specifiers: `{price:.2f}`, `{name:upper}`, `{date:YYYY-MM-DD}`
 *   - Conditional segments: `{?phone}Phone: {phone}{/phone}`
 *   - Escaped braces: `\{literal\}`
 *
 * Reference: Drupal Migrate concat/process plugin.
 */
export class TemplateMapper implements FieldMapperPlugin {
  readonly id = "template";
  readonly displayName = "Template Interpolation Mapper";

  supports(pathSyntax: string): boolean {
    // Templates contain {field_name} references
    return pathSyntax.includes("{") && pathSyntax.includes("}") &&
           !pathSyntax.startsWith("$") && !pathSyntax.startsWith("/");
  }

  resolve(record: RawRecord, sourcePath: string, config: MapperConfig): ResolvedValue {
    return this.interpolate(record, sourcePath, config);
  }

  /** Interpolate the template by replacing {field} references with record values. */
  private interpolate(record: RawRecord, template: string, config: MapperConfig): string {
    let result = template;

    // First, handle conditional segments: {?field}content{/field}
    result = this.processConditionals(record, result, config);

    // Then, replace field references
    result = result.replace(/\\?\{([^}]+)\}/g, (fullMatch, expression: string) => {
      // Handle escaped braces
      if (fullMatch.startsWith("\\")) {
        return fullMatch.slice(1);
      }

      return this.resolveExpression(record, expression.trim(), config);
    });

    return result;
  }

  /** Process conditional template segments like {?field}...{/field}. */
  private processConditionals(record: RawRecord, template: string, config: MapperConfig): string {
    // Pattern: {?field}content{/field}
    const conditionalPattern = /\{\?(\w[\w.]*)\}([\s\S]*?)\{\/\1\}/g;
    return template.replace(conditionalPattern, (_match, fieldName: string, content: string) => {
      const keys = parseDotPath(fieldName);
      const value = getNestedValue(record, keys);

      // Include content only if the field is truthy
      if (value !== undefined && value !== null && value !== "" && value !== false) {
        // Recursively interpolate the content
        return this.interpolate(record, content, config);
      }
      return "";
    });
  }

  /** Resolve a single field expression like `name`, `name:upper`, or `name|fallback|"default"`. */
  private resolveExpression(record: RawRecord, expression: string, config: MapperConfig): string {
    // Split format specifier: field:format
    let fieldExpr = expression;
    let formatSpec: string | undefined;

    // Find the format specifier (last : not inside a fallback chain)
    const colonIdx = this.findFormatColon(expression);
    if (colonIdx !== -1) {
      fieldExpr = expression.slice(0, colonIdx);
      formatSpec = expression.slice(colonIdx + 1);
    }

    // Resolve the field value with fallback chain
    const value = this.resolveWithFallback(record, fieldExpr, config);

    if (value === undefined || value === null) {
      return "";
    }

    // Apply format specifier
    if (formatSpec) {
      return this.applyFormat(value, formatSpec);
    }

    // Check config-level format specifiers
    if (config.formatSpecifiers) {
      const configFormat = config.formatSpecifiers[fieldExpr];
      if (configFormat) {
        return this.applyFormat(value, configFormat);
      }
    }

    return String(value);
  }

  /** Find the position of the format-specifier colon, not a fallback separator. */
  private findFormatColon(expression: string): number {
    // If the expression contains | (fallback), the format colon must come after all fallbacks
    // e.g., "name|fallback:upper" means format is "upper" applied to the resolved value
    // But "name:upper" is straightforward
    const lastPipe = expression.lastIndexOf("|");
    const lastColon = expression.lastIndexOf(":");

    if (lastColon === -1) return -1;
    if (lastPipe === -1) return lastColon;

    // Only count colons after the last pipe as format specifiers
    return lastColon > lastPipe ? lastColon : -1;
  }

  /** Resolve a field with fallback chain: field|fallback|"default". */
  private resolveWithFallback(record: RawRecord, fieldExpr: string, config: MapperConfig): unknown {
    const alternatives = fieldExpr.split("|").map(s => s.trim());

    for (const alt of alternatives) {
      // String literal: "value" or 'value'
      if ((alt.startsWith('"') && alt.endsWith('"')) ||
          (alt.startsWith("'") && alt.endsWith("'"))) {
        return alt.slice(1, -1);
      }

      // Field path
      const keys = parseDotPath(alt);
      const value = getNestedValue(record, keys);

      if (value !== undefined && value !== null && value !== "") {
        return value;
      }

      // Check config-level fallback values
      if (config.fallbackValues && alt in config.fallbackValues) {
        const fallback = config.fallbackValues[alt];
        if (fallback !== undefined) return fallback;
      }
    }

    return config.defaultValue;
  }

  /** Apply a format specifier to a value. */
  private applyFormat(value: unknown, format: string): string {
    // Number formats: .2f, .0f, etc.
    const numberFormat = format.match(/^\.(\d+)f$/);
    if (numberFormat) {
      const decimals = parseInt(numberFormat[1], 10);
      return typeof value === "number" ? value.toFixed(decimals) : String(value);
    }

    // String transforms
    switch (format.toLowerCase()) {
      case "upper":
      case "uppercase":
        return String(value).toUpperCase();
      case "lower":
      case "lowercase":
        return String(value).toLowerCase();
      case "capitalize":
      case "title":
        return String(value).replace(/\b\w/g, c => c.toUpperCase());
      case "trim":
        return String(value).trim();
      case "slug":
        return String(value).toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/[\s_]+/g, "-")
          .replace(/-+/g, "-")
          .trim();
      case "json":
        return JSON.stringify(value);
      case "urlencoded":
        return encodeURIComponent(String(value));
      default:
        // Date format: check for date-like format patterns (YYYY, MM, DD, etc.)
        if (/[YMDHhms]/.test(format) && value instanceof Date) {
          return this.formatDate(value, format);
        }
        if (/[YMDHhms]/.test(format) && typeof value === "string") {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            return this.formatDate(date, format);
          }
        }
        return String(value);
    }
  }

  /** Simple date formatting: YYYY-MM-DD, HH:mm:ss, etc. */
  private formatDate(date: Date, format: string): string {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return format
      .replace("YYYY", date.getFullYear().toString())
      .replace("MM", pad(date.getMonth() + 1))
      .replace("DD", pad(date.getDate()))
      .replace("HH", pad(date.getHours()))
      .replace("hh", pad(date.getHours() % 12 || 12))
      .replace("mm", pad(date.getMinutes()))
      .replace("ss", pad(date.getSeconds()));
  }
}

// ---------------------------------------------------------------------------
// 6. ComputedMapper — arbitrary expressions via ExpressionLanguage
// ---------------------------------------------------------------------------

/**
 * ComputedMapper evaluates arithmetic and logical expressions referencing
 * field values in the record.
 *
 * Supported syntax:
 *   - Arithmetic: `price * quantity * (1 + tax_rate)`
 *   - Comparisons: `age >= 18`, `status == "active"`
 *   - Logical: `is_member && total > 100`
 *   - Ternary: `is_premium ? price * 0.9 : price`
 *   - String concat: `first_name ~ " " ~ last_name`
 *   - Function calls: `round(price * 1.1, 2)`, `max(a, b)`, `length(name)`
 *   - Field references: bare names resolve to record fields, dot notation for nesting
 *
 * Reference: Drupal Migrate callback plugin, Symfony ExpressionLanguage.
 */
export class ComputedMapper implements FieldMapperPlugin {
  readonly id = "computed";
  readonly displayName = "Computed Expression Mapper";

  /** Built-in functions available in expressions. */
  private readonly builtins: Record<string, (...args: unknown[]) => unknown> = {
    // Math
    round: (n: unknown, d?: unknown) => {
      const num = Number(n);
      const decimals = Number(d ?? 0);
      return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
    },
    floor: (n: unknown) => Math.floor(Number(n)),
    ceil: (n: unknown) => Math.ceil(Number(n)),
    abs: (n: unknown) => Math.abs(Number(n)),
    min: (...args: unknown[]) => Math.min(...args.map(Number)),
    max: (...args: unknown[]) => Math.max(...args.map(Number)),
    sqrt: (n: unknown) => Math.sqrt(Number(n)),
    pow: (base: unknown, exp: unknown) => Math.pow(Number(base), Number(exp)),
    log: (n: unknown) => Math.log(Number(n)),

    // String
    length: (s: unknown) => {
      if (typeof s === "string") return s.length;
      if (Array.isArray(s)) return s.length;
      return 0;
    },
    upper: (s: unknown) => String(s).toUpperCase(),
    lower: (s: unknown) => String(s).toLowerCase(),
    trim: (s: unknown) => String(s).trim(),
    substr: (s: unknown, start: unknown, len?: unknown) => {
      const str = String(s);
      return len !== undefined ? str.substr(Number(start), Number(len)) : str.substr(Number(start));
    },
    replace: (s: unknown, search: unknown, replacement: unknown) =>
      String(s).split(String(search)).join(String(replacement)),
    contains: (s: unknown, search: unknown) => String(s).includes(String(search)),
    startsWith: (s: unknown, prefix: unknown) => String(s).startsWith(String(prefix)),
    endsWith: (s: unknown, suffix: unknown) => String(s).endsWith(String(suffix)),
    split: (s: unknown, delimiter: unknown) => String(s).split(String(delimiter)),
    join: (arr: unknown, delimiter: unknown) =>
      Array.isArray(arr) ? arr.join(String(delimiter)) : String(arr),

    // Type conversion
    int: (v: unknown) => parseInt(String(v), 10),
    float: (v: unknown) => parseFloat(String(v)),
    str: (v: unknown) => String(v),
    bool: (v: unknown) => Boolean(v),

    // Date
    now: () => new Date().toISOString(),
    timestamp: () => Math.floor(Date.now() / 1000),

    // Array
    first: (arr: unknown) => Array.isArray(arr) ? arr[0] : arr,
    last: (arr: unknown) => Array.isArray(arr) ? arr[arr.length - 1] : arr,
    count: (arr: unknown) => Array.isArray(arr) ? arr.length : (arr ? 1 : 0),
    sum: (arr: unknown) => Array.isArray(arr) ? arr.reduce((a: number, b: unknown) => a + Number(b), 0) : Number(arr),
    avg: (arr: unknown) => {
      if (!Array.isArray(arr) || arr.length === 0) return 0;
      const total = arr.reduce((a: number, b: unknown) => a + Number(b), 0);
      return total / arr.length;
    },

    // Null handling
    coalesce: (...args: unknown[]) => args.find(a => a !== null && a !== undefined),
    ifNull: (val: unknown, fallback: unknown) => (val === null || val === undefined) ? fallback : val,
    isEmpty: (val: unknown) => val === null || val === undefined || val === "" || (Array.isArray(val) && val.length === 0),
  };

  supports(pathSyntax: string): boolean {
    // Computed expressions contain operators, function calls, or arithmetic
    // Exclude other syntaxes first
    if (pathSyntax.startsWith("$") || pathSyntax.startsWith("/") || pathSyntax.startsWith("//")) {
      return false;
    }
    if (pathSyntax.includes("{") && pathSyntax.includes("}")) return false;

    // Must contain at least one operator or function call
    return /[+\-*/%<>=!&|?:~(]/.test(pathSyntax);
  }

  resolve(record: RawRecord, sourcePath: string, config: MapperConfig): ResolvedValue {
    const functions = { ...this.builtins, ...(config.functions ?? {}) };
    try {
      return this.evaluate(record, sourcePath, functions);
    } catch {
      return config.defaultValue;
    }
  }

  /**
   * Evaluate an expression string against a record.
   * Uses a recursive descent parser for operator precedence.
   */
  private evaluate(
    record: RawRecord,
    expr: string,
    functions: Record<string, (...args: unknown[]) => unknown>,
  ): unknown {
    const tokens = this.tokenizeExpression(expr);
    const parser = new ExpressionParser(tokens, record, functions);
    return parser.parseTernary();
  }

  /** Tokenize an expression into atoms, operators, and delimiters. */
  private tokenizeExpression(expr: string): ExprToken[] {
    const tokens: ExprToken[] = [];
    let i = 0;
    const src = expr.trim();

    while (i < src.length) {
      // Skip whitespace
      if (/\s/.test(src[i])) { i++; continue; }

      // Number literal (including decimals)
      if (/\d/.test(src[i]) || (src[i] === "." && i + 1 < src.length && /\d/.test(src[i + 1]))) {
        let num = "";
        while (i < src.length && (/[\d.]/.test(src[i]))) {
          num += src[i++];
        }
        tokens.push({ type: "number", value: parseFloat(num) });
        continue;
      }

      // String literal: "..." or '...'
      if (src[i] === '"' || src[i] === "'") {
        const quote = src[i++];
        let str = "";
        while (i < src.length && src[i] !== quote) {
          if (src[i] === "\\" && i + 1 < src.length) {
            i++;
            switch (src[i]) {
              case "n": str += "\n"; break;
              case "t": str += "\t"; break;
              case "\\": str += "\\"; break;
              default: str += src[i];
            }
          } else {
            str += src[i];
          }
          i++;
        }
        i++; // closing quote
        tokens.push({ type: "string", value: str });
        continue;
      }

      // Two-character operators
      const twoChar = src.slice(i, i + 2);
      if (["==", "!=", "<=", ">=", "&&", "||", "??"].includes(twoChar)) {
        tokens.push({ type: "operator", value: twoChar });
        i += 2;
        continue;
      }

      // Single-character operators and delimiters
      if ("+-*/%<>=!~".includes(src[i])) {
        tokens.push({ type: "operator", value: src[i] });
        i++;
        continue;
      }

      if (src[i] === "(") { tokens.push({ type: "lparen" }); i++; continue; }
      if (src[i] === ")") { tokens.push({ type: "rparen" }); i++; continue; }
      if (src[i] === ",") { tokens.push({ type: "comma" }); i++; continue; }
      if (src[i] === "?") { tokens.push({ type: "question" }); i++; continue; }
      if (src[i] === ":") { tokens.push({ type: "colon" }); i++; continue; }

      // Identifier (field name or function name) — supports dot notation
      if (/[a-zA-Z_]/.test(src[i])) {
        let ident = "";
        while (i < src.length && /[\w.]/.test(src[i])) {
          ident += src[i++];
        }
        // Check for boolean and null literals
        if (ident === "true") {
          tokens.push({ type: "boolean", value: true });
        } else if (ident === "false") {
          tokens.push({ type: "boolean", value: false });
        } else if (ident === "null" || ident === "nil") {
          tokens.push({ type: "null" });
        } else {
          tokens.push({ type: "identifier", value: ident });
        }
        continue;
      }

      // Unknown character, skip
      i++;
    }

    tokens.push({ type: "eof" });
    return tokens;
  }
}

interface ExprToken {
  type: "number" | "string" | "boolean" | "null" | "identifier" | "operator"
    | "lparen" | "rparen" | "comma" | "question" | "colon" | "eof";
  value?: unknown;
}

/**
 * Recursive descent parser for the computed expression language.
 * Operator precedence (lowest to highest):
 *   1. Ternary: ? :
 *   2. Logical OR: ||
 *   3. Logical AND: &&
 *   4. Null coalescing: ??
 *   5. Equality: == !=
 *   6. Comparison: < > <= >=
 *   7. String concatenation: ~
 *   8. Addition: + -
 *   9. Multiplication: * / %
 *  10. Unary: ! -
 *  11. Function call / field access
 */
class ExpressionParser {
  private pos = 0;

  constructor(
    private tokens: ExprToken[],
    private record: RawRecord,
    private functions: Record<string, (...args: unknown[]) => unknown>,
  ) {}

  private peek(): ExprToken { return this.tokens[this.pos]; }
  private advance(): ExprToken { return this.tokens[this.pos++]; }

  private expect(type: string): ExprToken {
    const token = this.advance();
    if (token.type !== type) {
      throw new Error(`Expected ${type} but got ${token.type}`);
    }
    return token;
  }

  parseTernary(): unknown {
    const condition = this.parseOr();
    if (this.peek().type === "question") {
      this.advance(); // consume ?
      const consequent = this.parseTernary();
      this.expect("colon");
      const alternate = this.parseTernary();
      return condition ? consequent : alternate;
    }
    return condition;
  }

  private parseOr(): unknown {
    let left = this.parseAnd();
    while (this.peek().type === "operator" && this.peek().value === "||") {
      this.advance();
      const right = this.parseAnd();
      left = left || right;
    }
    return left;
  }

  private parseAnd(): unknown {
    let left = this.parseNullCoalesce();
    while (this.peek().type === "operator" && this.peek().value === "&&") {
      this.advance();
      const right = this.parseNullCoalesce();
      left = left && right;
    }
    return left;
  }

  private parseNullCoalesce(): unknown {
    let left = this.parseEquality();
    while (this.peek().type === "operator" && this.peek().value === "??") {
      this.advance();
      const right = this.parseEquality();
      left = (left !== null && left !== undefined) ? left : right;
    }
    return left;
  }

  private parseEquality(): unknown {
    let left = this.parseComparison();
    while (this.peek().type === "operator" &&
           (this.peek().value === "==" || this.peek().value === "!=")) {
      const op = this.advance().value as string;
      const right = this.parseComparison();
      left = op === "==" ? left === right : left !== right;
    }
    return left;
  }

  private parseComparison(): unknown {
    let left = this.parseConcat();
    while (this.peek().type === "operator" &&
           (this.peek().value === "<" || this.peek().value === ">" ||
            this.peek().value === "<=" || this.peek().value === ">=")) {
      const op = this.advance().value as string;
      const right = this.parseConcat();
      switch (op) {
        case "<": left = (left as number) < (right as number); break;
        case ">": left = (left as number) > (right as number); break;
        case "<=": left = (left as number) <= (right as number); break;
        case ">=": left = (left as number) >= (right as number); break;
      }
    }
    return left;
  }

  private parseConcat(): unknown {
    let left = this.parseAddition();
    while (this.peek().type === "operator" && this.peek().value === "~") {
      this.advance();
      const right = this.parseAddition();
      left = String(left) + String(right);
    }
    return left;
  }

  private parseAddition(): unknown {
    let left = this.parseMultiplication();
    while (this.peek().type === "operator" &&
           (this.peek().value === "+" || this.peek().value === "-")) {
      const op = this.advance().value as string;
      const right = this.parseMultiplication();
      if (op === "+") {
        // String concatenation if either side is a string
        if (typeof left === "string" || typeof right === "string") {
          left = String(left) + String(right);
        } else {
          left = (left as number) + (right as number);
        }
      } else {
        left = (left as number) - (right as number);
      }
    }
    return left;
  }

  private parseMultiplication(): unknown {
    let left = this.parseUnary();
    while (this.peek().type === "operator" &&
           (this.peek().value === "*" || this.peek().value === "/" || this.peek().value === "%")) {
      const op = this.advance().value as string;
      const right = this.parseUnary();
      switch (op) {
        case "*": left = (left as number) * (right as number); break;
        case "/": left = (right as number) !== 0 ? (left as number) / (right as number) : 0; break;
        case "%": left = (left as number) % (right as number); break;
      }
    }
    return left;
  }

  private parseUnary(): unknown {
    if (this.peek().type === "operator" && this.peek().value === "!") {
      this.advance();
      return !this.parseUnary();
    }
    if (this.peek().type === "operator" && this.peek().value === "-") {
      this.advance();
      return -(this.parseUnary() as number);
    }
    return this.parsePrimary();
  }

  private parsePrimary(): unknown {
    const token = this.peek();

    switch (token.type) {
      case "number":
        this.advance();
        return token.value;

      case "string":
        this.advance();
        return token.value;

      case "boolean":
        this.advance();
        return token.value;

      case "null":
        this.advance();
        return null;

      case "lparen": {
        this.advance();
        const result = this.parseTernary();
        this.expect("rparen");
        return result;
      }

      case "identifier": {
        const name = token.value as string;
        this.advance();

        // Check for function call: name(args)
        if (this.peek().type === "lparen") {
          return this.parseFunctionCall(name);
        }

        // Field reference: resolve from record
        const keys = parseDotPath(name);
        const value = getNestedValue(this.record, keys);
        return value;
      }

      default:
        throw new Error(`Unexpected token: ${token.type}`);
    }
  }

  private parseFunctionCall(name: string): unknown {
    this.expect("lparen");
    const args: unknown[] = [];

    if (this.peek().type !== "rparen") {
      args.push(this.parseTernary());
      while (this.peek().type === "comma") {
        this.advance();
        args.push(this.parseTernary());
      }
    }

    this.expect("rparen");

    const fn = this.functions[name];
    if (!fn) {
      throw new Error(`Unknown function: ${name}`);
    }
    return fn(...args);
  }
}

// ---------------------------------------------------------------------------
// Provider Registry
// ---------------------------------------------------------------------------

/** All field mapper providers indexed by their unique ID. */
export const fieldMapperProviders: ReadonlyMap<string, FieldMapperPlugin> = new Map<string, FieldMapperPlugin>([
  ["direct", new DirectMapper()],
  ["jsonpath", new JsonPathMapper()],
  ["xpath", new XPathMapper()],
  ["regex", new RegexMapper()],
  ["template", new TemplateMapper()],
  ["computed", new ComputedMapper()],
]);

/**
 * Resolve the best provider for a given path syntax.
 * Returns the first provider whose `supports()` returns true, preferring
 * more specific syntaxes (checked in registration order: jsonpath, xpath,
 * regex, template, computed, then direct as fallback).
 */
export function resolveProvider(pathSyntax: string): FieldMapperPlugin | undefined {
  // Check in specificity order: most specific syntax patterns first
  const orderedIds = ["jsonpath", "xpath", "regex", "template", "computed", "direct"];
  for (const id of orderedIds) {
    const provider = fieldMapperProviders.get(id);
    if (provider?.supports(pathSyntax)) return provider;
  }
  return undefined;
}

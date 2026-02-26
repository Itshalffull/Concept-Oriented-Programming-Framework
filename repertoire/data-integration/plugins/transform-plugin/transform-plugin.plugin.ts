// Transform Plugin — value transformation implementations for the Data Integration Kit
// Provides pluggable data value transformations: type casting, string manipulation,
// format conversion, lookup resolution, and expression evaluation.
// See Data Integration Kit transform.concept for the parent Transform concept definition.

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/** Describes the expected input or output type of a transform. */
export interface TypeSpec {
  /** Primary type identifier: "string", "number", "boolean", "date", "array", "object", "any". */
  type: string;
  /** For array types, the element type. */
  elementType?: string;
  /** Whether the value may be null/undefined. */
  nullable?: boolean;
  /** For string types, an optional format hint (e.g., "iso-8601", "url", "email"). */
  format?: string;
}

/** Provider-specific configuration for a transform operation. */
export interface TransformConfig {
  /** The specific provider to use. */
  providerId: string;
  /** Provider-specific options. */
  options?: Record<string, unknown>;
}

/** Interface every transform-plugin provider must implement. */
export interface TransformPlugin {
  readonly id: string;
  readonly displayName: string;

  /** Transform a single value according to config. */
  transform(value: unknown, config: TransformConfig): unknown;

  /** Describe the expected input type. */
  inputType(): TypeSpec;

  /** Describe the produced output type. */
  outputType(): TypeSpec;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNullish(v: unknown): v is null | undefined {
  return v === null || v === undefined;
}

function toString(v: unknown): string {
  if (isNullish(v)) return "";
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// ---------------------------------------------------------------------------
// 1. TypeCastTransform — cast between types
// ---------------------------------------------------------------------------

export class TypeCastTransform implements TransformPlugin {
  readonly id = "type_cast";
  readonly displayName = "Type Cast";

  inputType(): TypeSpec { return { type: "any", nullable: true }; }
  outputType(): TypeSpec { return { type: "any", nullable: true }; }

  transform(value: unknown, config: TransformConfig): unknown {
    const targetType = (config.options?.["targetType"] as string) ?? "string";
    const strict = (config.options?.["strict"] as boolean) ?? false;

    if (isNullish(value)) {
      if (strict) throw new Error("TypeCastTransform: cannot cast null/undefined in strict mode");
      return this.defaultForType(targetType);
    }

    switch (targetType) {
      case "string":
        return this.castToString(value);
      case "number":
      case "int":
      case "float":
        return this.castToNumber(value, targetType, strict);
      case "boolean":
        return this.castToBoolean(value);
      case "date":
        return this.castToDate(value, strict);
      case "timestamp":
        return this.castToTimestamp(value, strict);
      case "array":
        return this.castToArray(value);
      case "json":
        return this.castToJson(value, strict);
      default:
        throw new Error(`TypeCastTransform: unknown target type "${targetType}"`);
    }
  }

  private castToString(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "object" && value !== null) return JSON.stringify(value);
    return String(value);
  }

  private castToNumber(value: unknown, subType: string, strict: boolean): number {
    if (typeof value === "number") {
      return subType === "int" ? Math.trunc(value) : value;
    }
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "string") {
      // Strip currency symbols, commas, whitespace for numeric parsing
      const cleaned = value.replace(/[$\u20AC\u00A3\u00A5,\s]/g, "").trim();
      const parsed = subType === "int" ? parseInt(cleaned, 10) : parseFloat(cleaned);
      if (isNaN(parsed)) {
        if (strict) throw new Error(`TypeCastTransform: cannot cast "${value}" to ${subType}`);
        return 0;
      }
      return parsed;
    }
    if (value instanceof Date) return value.getTime();
    if (strict) throw new Error(`TypeCastTransform: cannot cast ${typeof value} to ${subType}`);
    return 0;
  }

  private castToBoolean(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const lower = value.toLowerCase().trim();
      if (["true", "yes", "1", "on", "t", "y"].includes(lower)) return true;
      if (["false", "no", "0", "off", "f", "n", ""].includes(lower)) return false;
      return lower.length > 0;
    }
    return Boolean(value);
  }

  private castToDate(value: unknown, strict: boolean): Date {
    if (value instanceof Date) return value;
    if (typeof value === "number") return new Date(value);
    if (typeof value === "string") {
      // Attempt multiple date format parses
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) return parsed;

      // Try MM/DD/YYYY format
      const usMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (usMatch) {
        const d = new Date(parseInt(usMatch[3]), parseInt(usMatch[1]) - 1, parseInt(usMatch[2]));
        if (!isNaN(d.getTime())) return d;
      }

      // Try DD.MM.YYYY or DD-MM-YYYY (European)
      const euMatch = value.match(/^(\d{1,2})[.\-](\d{1,2})[.\-](\d{4})$/);
      if (euMatch) {
        const d = new Date(parseInt(euMatch[3]), parseInt(euMatch[2]) - 1, parseInt(euMatch[1]));
        if (!isNaN(d.getTime())) return d;
      }

      // Try Unix timestamp string
      const num = Number(value);
      if (!isNaN(num)) {
        // If < 1e12, assume seconds; otherwise milliseconds
        return new Date(num < 1e12 ? num * 1000 : num);
      }

      if (strict) throw new Error(`TypeCastTransform: cannot parse date from "${value}"`);
      return new Date(NaN);
    }
    if (strict) throw new Error(`TypeCastTransform: cannot cast ${typeof value} to date`);
    return new Date(NaN);
  }

  private castToTimestamp(value: unknown, strict: boolean): number {
    const d = this.castToDate(value, strict);
    return d.getTime();
  }

  private castToArray(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      // Try JSON parse
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch { /* fall through */ }
      // Split by comma
      return value.split(",").map((s) => s.trim());
    }
    return [value];
  }

  private castToJson(value: unknown, strict: boolean): unknown {
    if (typeof value === "string") {
      try { return JSON.parse(value); } catch (e) {
        if (strict) throw new Error(`TypeCastTransform: invalid JSON string: ${e}`);
        return value;
      }
    }
    return value;
  }

  private defaultForType(type: string): unknown {
    switch (type) {
      case "string": return "";
      case "number": case "int": case "float": return 0;
      case "boolean": return false;
      case "date": return null;
      case "timestamp": return 0;
      case "array": return [];
      case "json": return null;
      default: return null;
    }
  }
}

// ---------------------------------------------------------------------------
// 2. DefaultValueTransform — provide fallback when source is null/empty
// ---------------------------------------------------------------------------

export class DefaultValueTransform implements TransformPlugin {
  readonly id = "default_value";
  readonly displayName = "Default Value";

  inputType(): TypeSpec { return { type: "any", nullable: true }; }
  outputType(): TypeSpec { return { type: "any", nullable: false }; }

  transform(value: unknown, config: TransformConfig): unknown {
    const defaultVal = config.options?.["default"];
    const treatEmptyStringAsNull = (config.options?.["treatEmptyStringAsNull"] as boolean) ?? true;
    const treatZeroAsNull = (config.options?.["treatZeroAsNull"] as boolean) ?? false;
    const treatEmptyArrayAsNull = (config.options?.["treatEmptyArrayAsNull"] as boolean) ?? false;

    if (isNullish(value)) return defaultVal;
    if (treatEmptyStringAsNull && typeof value === "string" && value.trim() === "") return defaultVal;
    if (treatZeroAsNull && value === 0) return defaultVal;
    if (treatEmptyArrayAsNull && Array.isArray(value) && value.length === 0) return defaultVal;

    return value;
  }
}

// ---------------------------------------------------------------------------
// 3. LookupTransform — map values via lookup table
// ---------------------------------------------------------------------------

export class LookupTransform implements TransformPlugin {
  readonly id = "lookup";
  readonly displayName = "Lookup Table";

  inputType(): TypeSpec { return { type: "string" }; }
  outputType(): TypeSpec { return { type: "any" }; }

  transform(value: unknown, config: TransformConfig): unknown {
    const table = (config.options?.["table"] as Record<string, unknown>) ?? {};
    const caseSensitive = (config.options?.["caseSensitive"] as boolean) ?? false;
    const fallback = config.options?.["fallback"];
    const errorOnMissing = (config.options?.["errorOnMissing"] as boolean) ?? false;

    const key = toString(value);
    const lookupKey = caseSensitive ? key : key.toLowerCase();

    if (caseSensitive) {
      if (key in table) return table[key];
    } else {
      // Case-insensitive lookup: normalize keys
      for (const [k, v] of Object.entries(table)) {
        if (k.toLowerCase() === lookupKey) return v;
      }
    }

    if (errorOnMissing) {
      throw new Error(`LookupTransform: value "${key}" not found in lookup table`);
    }

    return fallback !== undefined ? fallback : value;
  }
}

// ---------------------------------------------------------------------------
// 4. MigrationLookupTransform — resolve IDs from a previous import's Provenance map
// ---------------------------------------------------------------------------

export class MigrationLookupTransform implements TransformPlugin {
  readonly id = "migration_lookup";
  readonly displayName = "Migration Lookup (Provenance)";

  inputType(): TypeSpec { return { type: "string", format: "id" }; }
  outputType(): TypeSpec { return { type: "string", format: "uuid" }; }

  transform(value: unknown, config: TransformConfig): unknown {
    const provenanceMap = (config.options?.["provenanceMap"] as Record<string, string>) ?? {};
    const entityType = (config.options?.["entityType"] as string) ?? "";
    const errorOnMissing = (config.options?.["errorOnMissing"] as boolean) ?? true;
    const fallbackPrefix = (config.options?.["fallbackPrefix"] as string) ?? "";

    const oldId = toString(value);
    if (oldId === "") return null;

    // Build composite key: entityType + ":" + oldId (if entityType provided)
    const compositeKey = entityType ? `${entityType}:${oldId}` : oldId;

    // Try composite key first, then raw old ID
    const resolved = provenanceMap[compositeKey] ?? provenanceMap[oldId];

    if (resolved !== undefined) return resolved;

    if (errorOnMissing) {
      throw new Error(
        `MigrationLookupTransform: old ID "${oldId}" (entity: "${entityType}") not found in provenance map`
      );
    }

    // If a fallback prefix is provided, generate a deterministic placeholder
    if (fallbackPrefix) {
      return `${fallbackPrefix}${oldId}`;
    }

    return null;
  }
}

// ---------------------------------------------------------------------------
// 5. ConcatTransform — merge multiple values into one string
// ---------------------------------------------------------------------------

export class ConcatTransform implements TransformPlugin {
  readonly id = "concat";
  readonly displayName = "Concatenate";

  inputType(): TypeSpec { return { type: "array", elementType: "any" }; }
  outputType(): TypeSpec { return { type: "string" }; }

  transform(value: unknown, config: TransformConfig): unknown {
    const separator = (config.options?.["separator"] as string) ?? " ";
    const skipNulls = (config.options?.["skipNulls"] as boolean) ?? true;
    const skipEmpty = (config.options?.["skipEmpty"] as boolean) ?? true;
    const template = config.options?.["template"] as string | undefined;

    // If a template is provided, use it for named interpolation
    if (template && typeof value === "object" && value !== null && !Array.isArray(value)) {
      return this.interpolateTemplate(template, value as Record<string, unknown>);
    }

    // Ensure value is array-like
    const values = Array.isArray(value) ? value : [value];

    // Also append any additional values from config
    const additionalValues = (config.options?.["additionalValues"] as unknown[]) ?? [];
    const allValues = [...values, ...additionalValues];

    const parts: string[] = [];
    for (const v of allValues) {
      if (skipNulls && isNullish(v)) continue;
      const str = toString(v);
      if (skipEmpty && str.trim() === "") continue;
      parts.push(str);
    }

    return parts.join(separator);
  }

  private interpolateTemplate(template: string, values: Record<string, unknown>): string {
    return template.replace(/\{(\w+)\}/g, (_match, key) => {
      const val = values[key];
      return isNullish(val) ? "" : toString(val);
    });
  }
}

// ---------------------------------------------------------------------------
// 6. SplitTransform — split string into array
// ---------------------------------------------------------------------------

export class SplitTransform implements TransformPlugin {
  readonly id = "split";
  readonly displayName = "Split String";

  inputType(): TypeSpec { return { type: "string" }; }
  outputType(): TypeSpec { return { type: "array", elementType: "string" }; }

  transform(value: unknown, config: TransformConfig): unknown {
    const delimiter = (config.options?.["delimiter"] as string) ?? ",";
    const isRegex = (config.options?.["regex"] as boolean) ?? false;
    const limit = config.options?.["limit"] as number | undefined;
    const trim = (config.options?.["trim"] as boolean) ?? true;
    const removeEmpty = (config.options?.["removeEmpty"] as boolean) ?? true;

    const str = toString(value);
    if (str === "") return [];

    let parts: string[];
    if (isRegex) {
      const re = new RegExp(delimiter);
      parts = limit !== undefined ? str.split(re, limit) : str.split(re);
    } else {
      parts = limit !== undefined ? str.split(delimiter, limit) : str.split(delimiter);
    }

    if (trim) parts = parts.map((p) => p.trim());
    if (removeEmpty) parts = parts.filter((p) => p.length > 0);

    return parts;
  }
}

// ---------------------------------------------------------------------------
// 7. FormatTransform — string formatting/interpolation
// ---------------------------------------------------------------------------

export class FormatTransform implements TransformPlugin {
  readonly id = "format";
  readonly displayName = "String Format";

  inputType(): TypeSpec { return { type: "any" }; }
  outputType(): TypeSpec { return { type: "string" }; }

  transform(value: unknown, config: TransformConfig): unknown {
    const template = (config.options?.["template"] as string) ?? "{value}";
    const locale = config.options?.["locale"] as string | undefined;
    const numberFormat = config.options?.["numberFormat"] as string | undefined;

    // Simple {key} interpolation if value is object
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      return template.replace(/\{(\w+)(?::([^}]+))?\}/g, (_match, key, format) => {
        const val = obj[key];
        if (isNullish(val)) return "";
        return format ? this.applyFormat(val, format, locale) : toString(val);
      });
    }

    // For scalar values, replace {value}, {0}, and apply number formatting
    let result = template;
    const displayVal = numberFormat
      ? this.formatNumber(value, numberFormat, locale)
      : toString(value);

    result = result.replace(/\{value\}/g, displayVal);
    result = result.replace(/\{0\}/g, displayVal);

    // If value is array, support {0}, {1}, {2}...
    if (Array.isArray(value)) {
      value.forEach((item, idx) => {
        result = result.replace(new RegExp(`\\{${idx}\\}`, "g"), toString(item));
      });
    }

    return result;
  }

  private formatNumber(value: unknown, format: string, locale?: string): string {
    const num = typeof value === "number" ? value : Number(value);
    if (isNaN(num)) return toString(value);

    switch (format) {
      case "currency":
        return new Intl.NumberFormat(locale ?? "en-US", {
          style: "currency", currency: "USD"
        }).format(num);
      case "percent":
        return new Intl.NumberFormat(locale ?? "en-US", {
          style: "percent", minimumFractionDigits: 1
        }).format(num);
      case "decimal":
        return new Intl.NumberFormat(locale ?? "en-US", {
          style: "decimal", minimumFractionDigits: 2
        }).format(num);
      default: {
        // Try to parse as fixed decimal places: "2f" -> 2 decimal places
        const fixedMatch = format.match(/^(\d+)f$/);
        if (fixedMatch) return num.toFixed(parseInt(fixedMatch[1]));
        return num.toLocaleString(locale ?? "en-US");
      }
    }
  }

  private applyFormat(value: unknown, format: string, locale?: string): string {
    if (typeof value === "number") return this.formatNumber(value, format, locale);
    if (value instanceof Date) {
      // Delegate to DateFormatTransform-style logic
      return value.toLocaleDateString(locale ?? "en-US");
    }
    const str = toString(value);
    switch (format) {
      case "upper": return str.toUpperCase();
      case "lower": return str.toLowerCase();
      case "title": return str.replace(/\b\w/g, (c) => c.toUpperCase());
      default: return str;
    }
  }
}

// ---------------------------------------------------------------------------
// 8. SlugifyTransform — generate URL-safe slug from text
// ---------------------------------------------------------------------------

export class SlugifyTransform implements TransformPlugin {
  readonly id = "slugify";
  readonly displayName = "Slugify";

  inputType(): TypeSpec { return { type: "string" }; }
  outputType(): TypeSpec { return { type: "string", format: "slug" }; }

  transform(value: unknown, config: TransformConfig): unknown {
    const separator = (config.options?.["separator"] as string) ?? "-";
    const maxLength = (config.options?.["maxLength"] as number) ?? 200;
    const lowercase = (config.options?.["lowercase"] as boolean) ?? true;

    let slug = toString(value);

    // 1. Unicode normalization — decompose combined characters (NFD)
    slug = slug.normalize("NFD");

    // 2. Remove diacritical marks (combining characters in Unicode block 0300-036F)
    slug = slug.replace(/[\u0300-\u036f]/g, "");

    // 3. Transliterate common special characters
    const charMap: Record<string, string> = {
      "\u00E6": "ae", "\u00C6": "AE", "\u00F8": "o", "\u00D8": "O",
      "\u00DF": "ss", "\u00F0": "d", "\u00D0": "D", "\u00FE": "th",
      "\u00DE": "TH", "\u0142": "l", "\u0141": "L",
      "\u00E0": "a", "\u00E1": "a", "\u00E2": "a", "\u00E3": "a", "\u00E4": "a",
      "\u00E8": "e", "\u00E9": "e", "\u00EA": "e", "\u00EB": "e",
      "\u00EC": "i", "\u00ED": "i", "\u00EE": "i", "\u00EF": "i",
      "\u00F2": "o", "\u00F3": "o", "\u00F4": "o", "\u00F5": "o", "\u00F6": "o",
      "\u00F9": "u", "\u00FA": "u", "\u00FB": "u", "\u00FC": "u",
      "\u00F1": "n", "\u00D1": "N", "\u00E7": "c", "\u00C7": "C",
      "&": "and", "@": "at", "#": "number",
    };
    for (const [char, replacement] of Object.entries(charMap)) {
      slug = slug.split(char).join(replacement);
    }

    // 4. Case conversion
    if (lowercase) slug = slug.toLowerCase();

    // 5. Replace non-alphanumeric characters with separator
    slug = slug.replace(/[^a-zA-Z0-9]+/g, separator);

    // 6. Collapse consecutive separators
    const escapedSep = separator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    slug = slug.replace(new RegExp(`${escapedSep}{2,}`, "g"), separator);

    // 7. Trim separators from start and end
    slug = slug.replace(new RegExp(`^${escapedSep}|${escapedSep}$`, "g"), "");

    // 8. Enforce max length — break at word boundary if possible
    if (slug.length > maxLength) {
      slug = slug.substring(0, maxLength);
      const lastSep = slug.lastIndexOf(separator);
      if (lastSep > maxLength * 0.7) {
        slug = slug.substring(0, lastSep);
      }
    }

    return slug;
  }
}

// ---------------------------------------------------------------------------
// 9. HtmlToMarkdownTransform — convert HTML to Markdown
// ---------------------------------------------------------------------------

export class HtmlToMarkdownTransform implements TransformPlugin {
  readonly id = "html_to_markdown";
  readonly displayName = "HTML to Markdown";

  inputType(): TypeSpec { return { type: "string", format: "html" }; }
  outputType(): TypeSpec { return { type: "string", format: "markdown" }; }

  transform(value: unknown, config: TransformConfig): unknown {
    const headingStyle = (config.options?.["headingStyle"] as string) ?? "atx";
    const codeBlockStyle = (config.options?.["codeBlockStyle"] as string) ?? "fenced";
    const bulletMarker = (config.options?.["bulletMarker"] as string) ?? "-";

    let html = toString(value);

    // Pre-processing: normalize whitespace within tags
    html = html.replace(/\r\n/g, "\n");

    // --- Block-level conversions (order matters) ---

    // Code blocks: <pre><code class="language-X">...</code></pre>
    html = html.replace(
      /<pre[^>]*>\s*<code[^>]*(?:class=["'][^"']*language-(\w+)[^"']*["'])?[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
      (_match, lang, code) => {
        const decoded = this.decodeEntities(code);
        if (codeBlockStyle === "fenced") {
          return `\n\n\`\`\`${lang ?? ""}\n${decoded}\n\`\`\`\n\n`;
        }
        return "\n\n" + decoded.split("\n").map((l: string) => "    " + l).join("\n") + "\n\n";
      }
    );

    // Headings h1-h6
    for (let level = 1; level <= 6; level++) {
      const re = new RegExp(`<h${level}[^>]*>([\\s\\S]*?)<\\/h${level}>`, "gi");
      html = html.replace(re, (_match, content) => {
        const text = this.stripInlineTags(content).trim();
        if (headingStyle === "setext" && level <= 2) {
          const underline = level === 1 ? "=" : "-";
          return `\n\n${text}\n${underline.repeat(text.length)}\n\n`;
        }
        return `\n\n${"#".repeat(level)} ${text}\n\n`;
      });
    }

    // Blockquotes
    html = html.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_match, content) => {
      const text = this.stripBlockTags(content).trim();
      return "\n\n" + text.split("\n").map((line: string) => "> " + line.trim()).join("\n") + "\n\n";
    });

    // Tables: <table>...<tr>...<th>/<td>...</tr>...</table>
    html = html.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_match, tableContent) => {
      return this.convertTable(tableContent);
    });

    // Ordered lists: <ol>...<li>...</li>...</ol>
    html = html.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_match, content) => {
      let counter = 0;
      return "\n\n" + content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, text: string) => {
        counter++;
        return `${counter}. ${this.stripBlockTags(text).trim()}\n`;
      }) + "\n";
    });

    // Unordered lists: <ul>...<li>...</li>...</ul>
    html = html.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_match, content) => {
      return "\n\n" + content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, text: string) => {
        return `${bulletMarker} ${this.stripBlockTags(text).trim()}\n`;
      }) + "\n";
    });

    // Paragraphs
    html = html.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n\n$1\n\n");

    // Horizontal rules
    html = html.replace(/<hr\s*\/?>/gi, "\n\n---\n\n");

    // Line breaks
    html = html.replace(/<br\s*\/?>/gi, "  \n");

    // --- Inline conversions ---

    // Images: <img src="url" alt="text" title="title">
    html = html.replace(
      /<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*?)["'](?:[^>]*title=["']([^"']*?)["'])?[^>]*\/?>/gi,
      (_match, src, alt, title) => {
        return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
      }
    );
    // Images without alt before src
    html = html.replace(
      /<img[^>]+alt=["']([^"']*?)["'][^>]*src=["']([^"']+)["'][^>]*\/?>/gi,
      (_match, alt, src) => `![${alt}](${src})`
    );

    // Links: <a href="url" title="title">text</a>
    html = html.replace(
      /<a[^>]+href=["']([^"']+)["'](?:[^>]*title=["']([^"']*?)["'])?[^>]*>([\s\S]*?)<\/a>/gi,
      (_match, href, title, text) => {
        const linkText = this.stripInlineTags(text).trim();
        return title ? `[${linkText}](${href} "${title}")` : `[${linkText}](${href})`;
      }
    );

    // Bold: <strong>, <b>
    html = html.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, "**$1**");

    // Italic: <em>, <i>
    html = html.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, "_$1_");

    // Strikethrough: <del>, <s>, <strike>
    html = html.replace(/<(?:del|s|strike)[^>]*>([\s\S]*?)<\/(?:del|s|strike)>/gi, "~~$1~~");

    // Inline code: <code>
    html = html.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");

    // Strip remaining tags
    html = html.replace(/<[^>]+>/g, "");

    // Decode HTML entities
    html = this.decodeEntities(html);

    // Collapse excessive whitespace
    html = html.replace(/\n{3,}/g, "\n\n");

    return html.trim();
  }

  private stripInlineTags(html: string): string {
    return html.replace(/<[^>]+>/g, "");
  }

  private stripBlockTags(html: string): string {
    // Strip block-level tags but keep their text content
    let result = html;
    result = result.replace(/<\/?(p|div|span|br)[^>]*>/gi, " ");
    result = result.replace(/<[^>]+>/g, "");
    return result;
  }

  private convertTable(tableContent: string): string {
    const rows: string[][] = [];
    const rowMatches = tableContent.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];

    for (const row of rowMatches) {
      const cells: string[] = [];
      const cellMatches = row.match(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi) ?? [];
      for (const cell of cellMatches) {
        const text = cell.replace(/<\/?(?:th|td)[^>]*>/gi, "").trim();
        cells.push(this.stripInlineTags(text).trim());
      }
      if (cells.length > 0) rows.push(cells);
    }

    if (rows.length === 0) return "";

    // Calculate column widths
    const colCount = Math.max(...rows.map((r) => r.length));
    const colWidths = Array.from({ length: colCount }, (_, i) =>
      Math.max(3, ...rows.map((r) => (r[i] ?? "").length))
    );

    // Build markdown table
    const lines: string[] = ["\n\n"];

    // Header row
    const headerRow = rows[0];
    lines.push("| " + colWidths.map((w, i) => (headerRow[i] ?? "").padEnd(w)).join(" | ") + " |");

    // Separator row
    lines.push("| " + colWidths.map((w) => "-".repeat(w)).join(" | ") + " |");

    // Data rows
    for (let r = 1; r < rows.length; r++) {
      lines.push("| " + colWidths.map((w, i) => (rows[r][i] ?? "").padEnd(w)).join(" | ") + " |");
    }

    lines.push("\n");
    return lines.join("\n");
  }

  private decodeEntities(html: string): string {
    return html
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x([0-9A-Fa-f]+);/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(parseInt(dec)));
  }
}

// ---------------------------------------------------------------------------
// 10. MarkdownToHtmlTransform — convert Markdown to HTML
// ---------------------------------------------------------------------------

export class MarkdownToHtmlTransform implements TransformPlugin {
  readonly id = "markdown_to_html";
  readonly displayName = "Markdown to HTML";

  inputType(): TypeSpec { return { type: "string", format: "markdown" }; }
  outputType(): TypeSpec { return { type: "string", format: "html" }; }

  transform(value: unknown, config: TransformConfig): unknown {
    const wrapInDocument = (config.options?.["wrapInDocument"] as boolean) ?? false;
    const sanitize = (config.options?.["sanitize"] as boolean) ?? true;

    let md = toString(value);

    // --- Block-level parsing ---

    // Fenced code blocks: ```lang\n...\n```
    md = md.replace(/```(\w*)\n([\s\S]*?)\n```/g, (_match, lang, code) => {
      const escaped = this.escapeHtml(code);
      const langAttr = lang ? ` class="language-${lang}"` : "";
      return `<pre><code${langAttr}>${escaped}</code></pre>`;
    });

    // Indented code blocks (4 spaces or 1 tab at start of consecutive lines)
    md = md.replace(/(?:^(?:    |\t).+\n?)+/gm, (block) => {
      const code = block.replace(/^(?:    |\t)/gm, "");
      return `<pre><code>${this.escapeHtml(code.trimEnd())}</code></pre>\n`;
    });

    // ATX headings: # ... ######
    md = md.replace(/^(#{1,6})\s+(.+?)(?:\s+#+)?$/gm, (_match, hashes, text) => {
      const level = hashes.length;
      return `<h${level}>${text.trim()}</h${level}>`;
    });

    // Setext headings: text\n===  or text\n---
    md = md.replace(/^(.+)\n={2,}$/gm, "<h1>$1</h1>");
    md = md.replace(/^(.+)\n-{2,}$/gm, "<h2>$1</h2>");

    // Horizontal rules: --- or *** or ___
    md = md.replace(/^(?:[-*_]\s*){3,}$/gm, "<hr />");

    // Blockquotes: > text
    md = md.replace(/(?:^>\s?.+\n?)+/gm, (block) => {
      const text = block.replace(/^>\s?/gm, "").trim();
      return `<blockquote><p>${text}</p></blockquote>`;
    });

    // Unordered lists: - item, * item, + item
    md = md.replace(/(?:^[*+\-]\s+.+\n?)+/gm, (block) => {
      const items = block.trim().split("\n").map((line) => {
        const text = line.replace(/^[*+\-]\s+/, "");
        return `<li>${text}</li>`;
      });
      return `<ul>\n${items.join("\n")}\n</ul>`;
    });

    // Ordered lists: 1. item
    md = md.replace(/(?:^\d+\.\s+.+\n?)+/gm, (block) => {
      const items = block.trim().split("\n").map((line) => {
        const text = line.replace(/^\d+\.\s+/, "");
        return `<li>${text}</li>`;
      });
      return `<ol>\n${items.join("\n")}\n</ol>`;
    });

    // Paragraphs: wrap remaining text blocks
    md = md.replace(/^(?!<[a-z])[^\n]+(\n(?!<[a-z])[^\n]+)*/gm, (block) => {
      const trimmed = block.trim();
      if (trimmed === "" || trimmed.startsWith("<")) return trimmed;
      return `<p>${trimmed}</p>`;
    });

    // --- Inline parsing ---

    // Images: ![alt](url "title")
    md = md.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_match, alt, src, title) => {
      const titleAttr = title ? ` title="${title}"` : "";
      return `<img src="${src}" alt="${alt}"${titleAttr} />`;
    });

    // Links: [text](url "title")
    md = md.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_match, text, href, title) => {
      const titleAttr = title ? ` title="${title}"` : "";
      return `<a href="${href}"${titleAttr}>${text}</a>`;
    });

    // Bold + italic: ***text*** or ___text___
    md = md.replace(/(\*\*\*|___)(?=\S)(.+?)(?<=\S)\1/g, "<strong><em>$2</em></strong>");

    // Bold: **text** or __text__
    md = md.replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, "<strong>$2</strong>");

    // Italic: *text* or _text_
    md = md.replace(/(\*|_)(?=\S)(.+?)(?<=\S)\1/g, "<em>$2</em>");

    // Strikethrough: ~~text~~
    md = md.replace(/~~(.+?)~~/g, "<del>$1</del>");

    // Inline code: `code`
    md = md.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Line breaks: two trailing spaces
    md = md.replace(/ {2,}\n/g, "<br />\n");

    if (sanitize) {
      // Remove script tags for safety
      md = md.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
      md = md.replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");
    }

    if (wrapInDocument) {
      md = `<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"></head>\n<body>\n${md}\n</body>\n</html>`;
    }

    return md;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

// ---------------------------------------------------------------------------
// 11. StripTagsTransform — remove HTML tags with allowlist support
// ---------------------------------------------------------------------------

export class StripTagsTransform implements TransformPlugin {
  readonly id = "strip_tags";
  readonly displayName = "Strip HTML Tags";

  inputType(): TypeSpec { return { type: "string", format: "html" }; }
  outputType(): TypeSpec { return { type: "string" }; }

  transform(value: unknown, config: TransformConfig): unknown {
    const allowedTags = (config.options?.["allowedTags"] as string[]) ?? [];
    const allowedAttributes = (config.options?.["allowedAttributes"] as string[]) ?? [];
    const decodeEntities = (config.options?.["decodeEntities"] as boolean) ?? true;
    const collapseWhitespace = (config.options?.["collapseWhitespace"] as boolean) ?? true;

    let html = toString(value);

    if (allowedTags.length === 0) {
      // Remove all tags
      // First, handle self-closing tags
      html = html.replace(/<[^>]+\/>/g, "");
      // Remove opening and closing tags
      html = html.replace(/<\/[^>]+>/g, "");
      html = html.replace(/<[^>]+>/g, "");
    } else {
      // Remove only tags NOT in the allowlist
      const allowedSet = new Set(allowedTags.map((t) => t.toLowerCase()));
      const allowedAttrSet = new Set(allowedAttributes.map((a) => a.toLowerCase()));

      // Process closing tags
      html = html.replace(/<\/([a-zA-Z][a-zA-Z0-9]*)\s*>/g, (match, tag) => {
        return allowedSet.has(tag.toLowerCase()) ? match : "";
      });

      // Process opening and self-closing tags
      html = html.replace(/<([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*?)?\s*\/?>/g, (match, tag, attrs) => {
        if (!allowedSet.has(tag.toLowerCase())) return "";

        // Strip disallowed attributes from allowed tags
        if (attrs && allowedAttrSet.size > 0) {
          const filteredAttrs = (attrs.match(/\s+[a-zA-Z][\w-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g) ?? [])
            .filter((attr: string) => {
              const name = attr.trim().split(/[\s=]/)[0].toLowerCase();
              return allowedAttrSet.has(name);
            })
            .join("");
          return `<${tag}${filteredAttrs}>`;
        }

        if (allowedAttrSet.size > 0) {
          // Remove all attributes if no allowed attrs match
          return `<${tag}>`;
        }

        return match;
      });
    }

    if (decodeEntities) {
      html = html
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x([0-9A-Fa-f]+);/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(parseInt(dec)));
    }

    if (collapseWhitespace) {
      html = html.replace(/\s+/g, " ").trim();
    }

    return html;
  }
}

// ---------------------------------------------------------------------------
// 12. TruncateTransform — limit string length with ellipsis
// ---------------------------------------------------------------------------

export class TruncateTransform implements TransformPlugin {
  readonly id = "truncate";
  readonly displayName = "Truncate";

  inputType(): TypeSpec { return { type: "string" }; }
  outputType(): TypeSpec { return { type: "string" }; }

  transform(value: unknown, config: TransformConfig): unknown {
    const maxLength = (config.options?.["maxLength"] as number) ?? 100;
    const ellipsis = (config.options?.["ellipsis"] as string) ?? "...";
    const position = (config.options?.["position"] as string) ?? "end"; // "end", "middle", "start"
    const wordBoundary = (config.options?.["wordBoundary"] as boolean) ?? false;

    const str = toString(value);
    if (str.length <= maxLength) return str;

    const truncLen = maxLength - ellipsis.length;
    if (truncLen <= 0) return ellipsis.substring(0, maxLength);

    switch (position) {
      case "start": {
        const start = str.length - truncLen;
        return ellipsis + str.substring(start);
      }

      case "middle": {
        const halfLen = Math.floor(truncLen / 2);
        const firstHalf = str.substring(0, halfLen);
        const secondHalf = str.substring(str.length - (truncLen - halfLen));
        return firstHalf + ellipsis + secondHalf;
      }

      case "end":
      default: {
        let truncated = str.substring(0, truncLen);
        if (wordBoundary) {
          // Find last space/punctuation within the truncated portion
          const lastSpace = truncated.lastIndexOf(" ");
          const lastPunct = Math.max(
            truncated.lastIndexOf("."),
            truncated.lastIndexOf(","),
            truncated.lastIndexOf(";"),
            truncated.lastIndexOf("!")
          );
          const breakPoint = Math.max(lastSpace, lastPunct);
          if (breakPoint > truncLen * 0.5) {
            truncated = truncated.substring(0, breakPoint);
          }
        }
        return truncated + ellipsis;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 13. RegexReplaceTransform — pattern-based string replacement
// ---------------------------------------------------------------------------

export class RegexReplaceTransform implements TransformPlugin {
  readonly id = "regex_replace";
  readonly displayName = "Regex Replace";

  inputType(): TypeSpec { return { type: "string" }; }
  outputType(): TypeSpec { return { type: "string" }; }

  transform(value: unknown, config: TransformConfig): unknown {
    const pattern = (config.options?.["pattern"] as string) ?? "";
    const replacement = (config.options?.["replacement"] as string) ?? "";
    const flags = (config.options?.["flags"] as string) ?? "g";
    const global = (config.options?.["global"] as boolean) ?? true;

    if (!pattern) return value;

    const str = toString(value);

    try {
      // Ensure 'g' flag is present if global is requested
      let effectiveFlags = flags;
      if (global && !effectiveFlags.includes("g")) {
        effectiveFlags += "g";
      }

      const re = new RegExp(pattern, effectiveFlags);

      // Support backreferences in replacement: $1, $2, etc. and named groups $<name>
      return str.replace(re, replacement);
    } catch (e) {
      throw new Error(`RegexReplaceTransform: invalid pattern "${pattern}": ${e}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 14. DateFormatTransform — parse and reformat dates between formats
// ---------------------------------------------------------------------------

export class DateFormatTransform implements TransformPlugin {
  readonly id = "date_format";
  readonly displayName = "Date Format";

  inputType(): TypeSpec { return { type: "string", format: "date" }; }
  outputType(): TypeSpec { return { type: "string" }; }

  /** Common format tokens similar to moment.js/date-fns */
  private static readonly MONTH_NAMES_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  private static readonly MONTH_NAMES_LONG = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  private static readonly DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  private static readonly DAY_NAMES_LONG = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
  ];

  transform(value: unknown, config: TransformConfig): unknown {
    const inputFormat = config.options?.["inputFormat"] as string | undefined;
    const outputFormat = (config.options?.["outputFormat"] as string) ?? "YYYY-MM-DD";
    const locale = config.options?.["locale"] as string | undefined;
    const timezone = config.options?.["timezone"] as string | undefined;

    // 1. Parse the input date
    const date = this.parseDate(value, inputFormat);
    if (!date || isNaN(date.getTime())) {
      throw new Error(`DateFormatTransform: cannot parse date from "${toString(value)}"`);
    }

    // 2. Apply timezone offset if specified
    const effectiveDate = timezone ? this.applyTimezone(date, timezone) : date;

    // 3. Format the output
    if (locale) {
      // Use Intl.DateTimeFormat for locale-aware formatting
      return this.formatWithIntl(effectiveDate, outputFormat, locale);
    }

    return this.formatDate(effectiveDate, outputFormat);
  }

  private parseDate(value: unknown, inputFormat?: string): Date | null {
    if (value instanceof Date) return value;

    if (typeof value === "number") {
      // Unix timestamp: seconds if < 1e12, milliseconds otherwise
      return new Date(value < 1e12 ? value * 1000 : value);
    }

    if (typeof value !== "string") return null;
    const str = (value as string).trim();
    if (str === "") return null;

    // Try parsing relative dates first
    const relative = this.parseRelativeDate(str);
    if (relative) return relative;

    // ISO 8601: 2026-02-23T10:30:00Z or 2026-02-23
    const isoDate = new Date(str);
    if (!isNaN(isoDate.getTime())) return isoDate;

    // US format: MM/DD/YYYY or M/D/YYYY
    const usMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (usMatch) {
      const year = usMatch[3].length === 2 ? 2000 + parseInt(usMatch[3]) : parseInt(usMatch[3]);
      return new Date(year, parseInt(usMatch[1]) - 1, parseInt(usMatch[2]));
    }

    // European format: DD.MM.YYYY or DD-MM-YYYY
    const euMatch = str.match(/^(\d{1,2})[.\-](\d{1,2})[.\-](\d{2,4})$/);
    if (euMatch) {
      const year = euMatch[3].length === 2 ? 2000 + parseInt(euMatch[3]) : parseInt(euMatch[3]);
      return new Date(year, parseInt(euMatch[2]) - 1, parseInt(euMatch[1]));
    }

    // Month name formats: "Feb 23, 2026" or "23 Feb 2026" or "February 23, 2026"
    const namedMonth1 = str.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
    if (namedMonth1) {
      const month = this.parseMonthName(namedMonth1[1]);
      if (month >= 0) return new Date(parseInt(namedMonth1[3]), month, parseInt(namedMonth1[2]));
    }

    const namedMonth2 = str.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (namedMonth2) {
      const month = this.parseMonthName(namedMonth2[2]);
      if (month >= 0) return new Date(parseInt(namedMonth2[3]), month, parseInt(namedMonth2[1]));
    }

    // Unix timestamp as string
    const num = Number(str);
    if (!isNaN(num)) {
      return new Date(num < 1e12 ? num * 1000 : num);
    }

    return null;
  }

  private parseRelativeDate(str: string): Date | null {
    const lower = str.toLowerCase().trim();
    const now = new Date();

    if (lower === "now" || lower === "today") return now;
    if (lower === "yesterday") return new Date(now.getTime() - 86400000);
    if (lower === "tomorrow") return new Date(now.getTime() + 86400000);

    // "N days/weeks/months/years ago" or "in N days/weeks/months/years"
    const agoMatch = lower.match(/^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/);
    if (agoMatch) {
      const amount = parseInt(agoMatch[1]);
      return this.offsetDate(now, -amount, agoMatch[2]);
    }

    const inMatch = lower.match(/^in\s+(\d+)\s+(second|minute|hour|day|week|month|year)s?$/);
    if (inMatch) {
      const amount = parseInt(inMatch[1]);
      return this.offsetDate(now, amount, inMatch[2]);
    }

    return null;
  }

  private offsetDate(date: Date, amount: number, unit: string): Date {
    const result = new Date(date);
    switch (unit) {
      case "second": result.setSeconds(result.getSeconds() + amount); break;
      case "minute": result.setMinutes(result.getMinutes() + amount); break;
      case "hour": result.setHours(result.getHours() + amount); break;
      case "day": result.setDate(result.getDate() + amount); break;
      case "week": result.setDate(result.getDate() + amount * 7); break;
      case "month": result.setMonth(result.getMonth() + amount); break;
      case "year": result.setFullYear(result.getFullYear() + amount); break;
    }
    return result;
  }

  private parseMonthName(name: string): number {
    const lower = name.toLowerCase();
    const shortNames = DateFormatTransform.MONTH_NAMES_SHORT.map((n) => n.toLowerCase());
    const longNames = DateFormatTransform.MONTH_NAMES_LONG.map((n) => n.toLowerCase());

    let idx = shortNames.indexOf(lower);
    if (idx >= 0) return idx;
    idx = longNames.indexOf(lower);
    if (idx >= 0) return idx;

    // Try prefix match
    for (let i = 0; i < longNames.length; i++) {
      if (longNames[i].startsWith(lower)) return i;
    }
    return -1;
  }

  private applyTimezone(date: Date, timezone: string): Date {
    // Use Intl to compute the offset for a given timezone
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false,
      });
      const parts = formatter.formatToParts(date);
      const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? "0");
      return new Date(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    } catch {
      return date;
    }
  }

  private formatDate(date: Date, format: string): string {
    const pad = (n: number, digits: number = 2) => String(n).padStart(digits, "0");

    const year = date.getFullYear();
    const month = date.getMonth(); // 0-based
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const ms = date.getMilliseconds();
    const dayOfWeek = date.getDay();

    return format
      .replace(/YYYY/g, String(year))
      .replace(/YY/g, String(year).slice(-2))
      .replace(/MMMM/g, DateFormatTransform.MONTH_NAMES_LONG[month])
      .replace(/MMM/g, DateFormatTransform.MONTH_NAMES_SHORT[month])
      .replace(/MM/g, pad(month + 1))
      .replace(/M(?![a-zA-Z])/g, String(month + 1))
      .replace(/dddd/g, DateFormatTransform.DAY_NAMES_LONG[dayOfWeek])
      .replace(/ddd/g, DateFormatTransform.DAY_NAMES_SHORT[dayOfWeek])
      .replace(/DD/g, pad(day))
      .replace(/D(?![a-zA-Z])/g, String(day))
      .replace(/HH/g, pad(hours))
      .replace(/H(?![a-zA-Z])/g, String(hours))
      .replace(/hh/g, pad(hours > 12 ? hours - 12 : hours === 0 ? 12 : hours))
      .replace(/h(?![a-zA-Z])/g, String(hours > 12 ? hours - 12 : hours === 0 ? 12 : hours))
      .replace(/mm/g, pad(minutes))
      .replace(/ss/g, pad(seconds))
      .replace(/SSS/g, pad(ms, 3))
      .replace(/A/g, hours >= 12 ? "PM" : "AM")
      .replace(/a/g, hours >= 12 ? "pm" : "am")
      .replace(/Z/g, this.formatTimezoneOffset(date));
  }

  private formatTimezoneOffset(date: Date): string {
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const absOffset = Math.abs(offset);
    const hours = Math.floor(absOffset / 60);
    const minutes = absOffset % 60;
    return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  private formatWithIntl(date: Date, format: string, locale: string): string {
    // Map common format strings to Intl options
    const presets: Record<string, Intl.DateTimeFormatOptions> = {
      "short": { dateStyle: "short" },
      "medium": { dateStyle: "medium" },
      "long": { dateStyle: "long" },
      "full": { dateStyle: "full" },
      "short-time": { dateStyle: "short", timeStyle: "short" },
      "long-time": { dateStyle: "long", timeStyle: "long" },
    };

    const preset = presets[format.toLowerCase()];
    if (preset) {
      return new Intl.DateTimeFormat(locale, preset).format(date);
    }

    // Fall back to token-based formatting
    return this.formatDate(date, format);
  }
}

// ---------------------------------------------------------------------------
// 15. JsonExtractTransform — extract value from JSON string at path
// ---------------------------------------------------------------------------

export class JsonExtractTransform implements TransformPlugin {
  readonly id = "json_extract";
  readonly displayName = "JSON Extract";

  inputType(): TypeSpec { return { type: "string", format: "json" }; }
  outputType(): TypeSpec { return { type: "any" }; }

  transform(value: unknown, config: TransformConfig): unknown {
    const path = (config.options?.["path"] as string) ?? "$";
    const defaultValue = config.options?.["default"];
    const parseInput = (config.options?.["parseInput"] as boolean) ?? true;

    // Parse JSON if input is a string
    let data: unknown;
    if (typeof value === "string" && parseInput) {
      try {
        data = JSON.parse(value);
      } catch (e) {
        throw new Error(`JsonExtractTransform: invalid JSON input: ${e}`);
      }
    } else {
      data = value;
    }

    // Evaluate JSONPath-like expression
    try {
      const result = this.evaluatePath(data, path);
      return result !== undefined ? result : (defaultValue ?? null);
    } catch {
      return defaultValue ?? null;
    }
  }

  /** Simple JSONPath evaluator supporting: $, .key, [index], [*], ..key (recursive descent) */
  private evaluatePath(data: unknown, path: string): unknown {
    if (path === "$" || path === "") return data;

    // Normalize path: $.foo.bar[0] -> ["foo", "bar", "0"]
    let normalizedPath = path;
    if (normalizedPath.startsWith("$.")) normalizedPath = normalizedPath.substring(2);
    else if (normalizedPath.startsWith("$")) normalizedPath = normalizedPath.substring(1);

    // Handle recursive descent: ..key
    if (normalizedPath.startsWith("..")) {
      const key = normalizedPath.substring(2).split(/[.\[]/)[0];
      return this.recursiveDescend(data, key);
    }

    // Split path into segments
    const segments = this.parsePath(normalizedPath);
    let current: unknown = data;

    for (const segment of segments) {
      if (isNullish(current)) return undefined;

      if (segment === "*") {
        // Wildcard: return array of all values
        if (Array.isArray(current)) return current;
        if (typeof current === "object" && current !== null) {
          return Object.values(current);
        }
        return undefined;
      }

      if (Array.isArray(current)) {
        const idx = parseInt(segment);
        if (!isNaN(idx)) {
          current = current[idx < 0 ? current.length + idx : idx];
        } else {
          // Try to map over array elements
          current = current.map((item) => {
            if (typeof item === "object" && item !== null) {
              return (item as Record<string, unknown>)[segment];
            }
            return undefined;
          });
        }
      } else if (typeof current === "object" && current !== null) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private parsePath(path: string): string[] {
    const segments: string[] = [];
    // Match: .key, ["key"], [0], [*]
    const re = /\.?([^.\[\]]+)|\[(\d+|"[^"]+"|'[^']+'|\*)\]/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(path)) !== null) {
      const segment = match[1] ?? match[2];
      // Remove quotes from bracketed strings
      const cleaned = segment.replace(/^["']|["']$/g, "");
      segments.push(cleaned);
    }
    return segments;
  }

  private recursiveDescend(data: unknown, key: string): unknown[] {
    const results: unknown[] = [];

    const search = (obj: unknown) => {
      if (isNullish(obj) || typeof obj !== "object") return;

      if (Array.isArray(obj)) {
        for (const item of obj) search(item);
      } else {
        const record = obj as Record<string, unknown>;
        if (key in record) results.push(record[key]);
        for (const val of Object.values(record)) search(val);
      }
    };

    search(data);
    return results.length === 1 ? results[0] as unknown[] : results;
  }
}

// ---------------------------------------------------------------------------
// 16. ExpressionTransform — arbitrary expression via ExpressionLanguage
// ---------------------------------------------------------------------------

export class ExpressionTransform implements TransformPlugin {
  readonly id = "expression";
  readonly displayName = "Expression";

  inputType(): TypeSpec { return { type: "any" }; }
  outputType(): TypeSpec { return { type: "any" }; }

  transform(value: unknown, config: TransformConfig): unknown {
    const expression = (config.options?.["expression"] as string) ?? "";
    const variables = (config.options?.["variables"] as Record<string, unknown>) ?? {};

    if (!expression) {
      throw new Error("ExpressionTransform: expression is required");
    }

    // Build evaluation context with the input value and additional variables
    const context: Record<string, unknown> = {
      value,
      ...variables,
    };

    // If value is an object, spread its properties into the context
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(context, value);
    }

    return this.evaluate(expression, context);
  }

  /**
   * Simple expression evaluator supporting:
   * - Arithmetic: +, -, *, /, %, **
   * - Comparison: ==, !=, <, >, <=, >=
   * - Logical: &&, ||, !
   * - Ternary: condition ? trueVal : falseVal
   * - String concatenation with +
   * - Property access: obj.key
   * - Function calls: upper(x), lower(x), abs(x), round(x), floor(x), ceil(x),
   *                   min(a,b), max(a,b), len(x), trim(x), substr(x,start,len),
   *                   contains(str, substr), startsWith(str, prefix), endsWith(str, suffix),
   *                   replace(str, from, to), parseInt(x), parseFloat(x), toString(x)
   */
  private evaluate(expression: string, context: Record<string, unknown>): unknown {
    // Build a sandboxed function with known context variables
    const contextKeys = Object.keys(context);
    const contextValues = Object.values(context);

    // Built-in functions available in expressions
    const builtins: Record<string, Function> = {
      upper: (s: unknown) => toString(s).toUpperCase(),
      lower: (s: unknown) => toString(s).toLowerCase(),
      trim: (s: unknown) => toString(s).trim(),
      len: (s: unknown) => Array.isArray(s) ? s.length : toString(s).length,
      abs: (n: unknown) => Math.abs(Number(n)),
      round: (n: unknown, d?: number) => {
        const factor = Math.pow(10, d ?? 0);
        return Math.round(Number(n) * factor) / factor;
      },
      floor: (n: unknown) => Math.floor(Number(n)),
      ceil: (n: unknown) => Math.ceil(Number(n)),
      min: (...args: unknown[]) => Math.min(...args.map(Number)),
      max: (...args: unknown[]) => Math.max(...args.map(Number)),
      substr: (s: unknown, start: number, length?: number) =>
        length !== undefined ? toString(s).substring(start, start + length) : toString(s).substring(start),
      contains: (s: unknown, sub: unknown) => toString(s).includes(toString(sub)),
      startsWith: (s: unknown, prefix: unknown) => toString(s).startsWith(toString(prefix)),
      endsWith: (s: unknown, suffix: unknown) => toString(s).endsWith(toString(suffix)),
      replace: (s: unknown, from: unknown, to: unknown) => toString(s).split(toString(from)).join(toString(to)),
      parseInt: (s: unknown, radix?: number) => parseInt(toString(s), radix ?? 10),
      parseFloat: (s: unknown) => parseFloat(toString(s)),
      toString: (s: unknown) => toString(s),
      coalesce: (...args: unknown[]) => args.find((a) => !isNullish(a) && a !== "") ?? null,
      ifNull: (val: unknown, fallback: unknown) => isNullish(val) ? fallback : val,
      now: () => new Date().toISOString(),
    };

    const builtinKeys = Object.keys(builtins);
    const builtinValues = Object.values(builtins);

    try {
      // Construct a safe function that evaluates the expression
      // Using Function constructor with explicit scope variables prevents prototype access
      const fn = new Function(
        ...contextKeys,
        ...builtinKeys,
        `"use strict"; return (${expression});`
      );
      return fn(...contextValues, ...builtinValues);
    } catch (e) {
      throw new Error(`ExpressionTransform: evaluation error for "${expression}": ${e}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Provider Registry
// ---------------------------------------------------------------------------

/** All transform plugin providers indexed by their unique ID. */
export const transformPluginProviders: ReadonlyMap<string, TransformPlugin> = new Map<string, TransformPlugin>([
  ["type_cast", new TypeCastTransform()],
  ["default_value", new DefaultValueTransform()],
  ["lookup", new LookupTransform()],
  ["migration_lookup", new MigrationLookupTransform()],
  ["concat", new ConcatTransform()],
  ["split", new SplitTransform()],
  ["format", new FormatTransform()],
  ["slugify", new SlugifyTransform()],
  ["html_to_markdown", new HtmlToMarkdownTransform()],
  ["markdown_to_html", new MarkdownToHtmlTransform()],
  ["strip_tags", new StripTagsTransform()],
  ["truncate", new TruncateTransform()],
  ["regex_replace", new RegexReplaceTransform()],
  ["date_format", new DateFormatTransform()],
  ["json_extract", new JsonExtractTransform()],
  ["expression", new ExpressionTransform()],
]);

/**
 * Resolve a transform provider by its ID.
 * Returns the provider instance or undefined if not found.
 */
export function resolveTransformProvider(providerId: string): TransformPlugin | undefined {
  return transformPluginProviders.get(providerId);
}

/**
 * Execute a transform by provider ID, value, and config.
 * Convenience function that resolves the provider and invokes it.
 */
export function executeTransform(value: unknown, config: TransformConfig): unknown {
  const provider = resolveTransformProvider(config.providerId);
  if (!provider) {
    throw new Error(`Transform provider "${config.providerId}" not found`);
  }
  return provider.transform(value, config);
}

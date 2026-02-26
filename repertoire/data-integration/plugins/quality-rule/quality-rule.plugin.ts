// Quality Rule Plugin — data quality validation and enforcement for the Data Integration Kit.
// Provides pluggable quality rules across six dimensions: completeness, uniqueness,
// validity, consistency, timeliness, and accuracy.
// See Data Integration Kit quality.concept for the parent Quality concept definition.

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/** The six standard data quality dimensions. */
export enum QualityDimension {
  Completeness = "completeness",
  Uniqueness = "uniqueness",
  Validity = "validity",
  Consistency = "consistency",
  Timeliness = "timeliness",
  Accuracy = "accuracy",
}

/** Severity level for rule violations. */
export enum Severity {
  Error = "error",
  Warning = "warning",
  Info = "info",
}

/** Describes a field's schema within a record. */
export interface FieldDef {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "array" | "object";
  required?: boolean;
  nullable?: boolean;
  /** Parent entity this field belongs to (for scoped uniqueness). */
  parentEntity?: string;
  /** Optional metadata for the field. */
  metadata?: Record<string, unknown>;
}

/** Provider-specific configuration for a quality rule. */
export interface RuleConfig {
  /** Whether the rule is enabled. */
  enabled?: boolean;
  /** Override severity (defaults to the rule's default). */
  severity?: Severity;
  /** Custom error message template. Supports {field}, {value}, {expected} placeholders. */
  messageTemplate?: string;
  /** Provider-specific options. */
  options?: Record<string, unknown>;
}

/** Result of a single rule validation. */
export interface RuleResult {
  valid: boolean;
  message?: string;
  severity?: Severity;
  /** Extra diagnostic data (e.g., similarity score, matched value). */
  diagnostics?: Record<string, unknown>;
}

/** A record is a map of field names to values. */
export type Record = { [field: string]: unknown };

/** Storage adapter interface for rules that need to query existing records. */
export interface StorageAdapter {
  /** Check whether an entity with the given key exists. */
  entityExists(entityType: string, key: string | number): Promise<boolean>;
  /** Batch check existence for multiple keys. */
  entitiesBatchExist(entityType: string, keys: (string | number)[]): Promise<Map<string | number, boolean>>;
  /** Query records matching a filter. */
  queryRecords(entityType: string, filter: Record): Promise<Record[]>;
}

/** External knowledge base adapter for reconciliation rules. */
export interface KnowledgeBaseAdapter {
  /** Look up a value and return matches with confidence scores. */
  lookup(value: string, entityType?: string): Promise<Array<{ match: string; confidence: number; source: string }>>;
}

/** Interface every quality-rule provider must implement. */
export interface QualityRulePlugin {
  readonly id: string;
  readonly displayName: string;
  readonly defaultSeverity: Severity;

  /** Validate a value against this rule. */
  validate(value: unknown, field: FieldDef, record: Record, config: RuleConfig): Promise<RuleResult>;

  /** Check whether this rule applies to a given field definition. */
  appliesTo(field: FieldDef): boolean;

  /** Return the quality dimension this rule measures. */
  dimension(): QualityDimension;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMessage(template: string, vars: { field?: string; value?: unknown; expected?: unknown }): string {
  return template
    .replace("{field}", vars.field ?? "")
    .replace("{value}", String(vars.value ?? ""))
    .replace("{expected}", String(vars.expected ?? ""));
}

function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

function isEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length === 0;
}

// ---------------------------------------------------------------------------
// 1. RequiredRule — completeness: field must not be null/empty
// ---------------------------------------------------------------------------

export class RequiredRule implements QualityRulePlugin {
  readonly id = "required";
  readonly displayName = "Required Field";
  readonly defaultSeverity = Severity.Error;

  dimension(): QualityDimension {
    return QualityDimension.Completeness;
  }

  appliesTo(field: FieldDef): boolean {
    return field.required === true;
  }

  async validate(value: unknown, field: FieldDef, _record: Record, config: RuleConfig): Promise<RuleResult> {
    const severity = config.severity ?? this.defaultSeverity;
    const allowWhitespace = (config.options?.["allowWhitespace"] as boolean) ?? false;

    // Null / undefined check
    if (isNullOrUndefined(value)) {
      return {
        valid: false,
        message: formatMessage(
          config.messageTemplate ?? "Field '{field}' is required but was null/undefined",
          { field: field.name, value }
        ),
        severity,
      };
    }

    // Empty string check (with optional whitespace-only detection)
    if (typeof value === "string") {
      const empty = allowWhitespace ? value.length === 0 : value.trim().length === 0;
      if (empty) {
        return {
          valid: false,
          message: formatMessage(
            config.messageTemplate ?? "Field '{field}' is required but was empty",
            { field: field.name, value }
          ),
          severity,
        };
      }
    }

    // Empty array check
    if (Array.isArray(value) && value.length === 0) {
      return {
        valid: false,
        message: formatMessage(
          config.messageTemplate ?? "Field '{field}' is required but was an empty array",
          { field: field.name, value }
        ),
        severity,
      };
    }

    // Empty object check
    if (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) {
      return {
        valid: false,
        message: formatMessage(
          config.messageTemplate ?? "Field '{field}' is required but was an empty object",
          { field: field.name, value }
        ),
        severity,
      };
    }

    return { valid: true };
  }
}

// ---------------------------------------------------------------------------
// 2. UniqueRule — uniqueness: value must be unique across all records
// ---------------------------------------------------------------------------

export class UniqueRule implements QualityRulePlugin {
  readonly id = "unique";
  readonly displayName = "Unique Value";
  readonly defaultSeverity = Severity.Error;

  /**
   * In-memory value tracking. In production, this would be backed by a database
   * index or bloom filter for scalability.
   * Structure: scope => fieldName => Set<serialized-value>
   */
  private seenValues = new Map<string, Map<string, Set<string>>>();

  dimension(): QualityDimension {
    return QualityDimension.Uniqueness;
  }

  appliesTo(_field: FieldDef): boolean {
    // Uniqueness can apply to any field type
    return true;
  }

  async validate(value: unknown, field: FieldDef, _record: Record, config: RuleConfig): Promise<RuleResult> {
    const severity = config.severity ?? this.defaultSeverity;
    const scope = (config.options?.["scope"] as string) ?? "global";
    const caseSensitive = (config.options?.["caseSensitive"] as boolean) ?? true;

    if (isNullOrUndefined(value)) {
      // Null values are not checked for uniqueness (handled by RequiredRule)
      return { valid: true };
    }

    // Determine the scope key: "global" or per-parent entity
    const scopeKey = scope === "global"
      ? "__global__"
      : `parent:${field.parentEntity ?? "__none__"}`;

    // Get or create the scope map
    if (!this.seenValues.has(scopeKey)) {
      this.seenValues.set(scopeKey, new Map());
    }
    const scopeMap = this.seenValues.get(scopeKey)!;

    if (!scopeMap.has(field.name)) {
      scopeMap.set(field.name, new Set());
    }
    const fieldSet = scopeMap.get(field.name)!;

    // Serialize the value for comparison
    let serialized = typeof value === "object" ? JSON.stringify(value) : String(value);
    if (!caseSensitive && typeof serialized === "string") {
      serialized = serialized.toLowerCase();
    }

    if (fieldSet.has(serialized)) {
      return {
        valid: false,
        message: formatMessage(
          config.messageTemplate ?? "Field '{field}' value '{value}' is not unique (scope: {expected})",
          { field: field.name, value, expected: scope }
        ),
        severity,
        diagnostics: { scope, duplicateValue: value },
      };
    }

    fieldSet.add(serialized);
    return { valid: true };
  }

  /** Reset tracked values (e.g., between batch runs). */
  reset(scope?: string): void {
    if (scope) {
      this.seenValues.delete(scope);
    } else {
      this.seenValues.clear();
    }
  }

  /** Batch check uniqueness for an array of values. Returns indices of duplicates. */
  batchCheck(values: unknown[], field: FieldDef, config: RuleConfig): number[] {
    const caseSensitive = (config.options?.["caseSensitive"] as boolean) ?? true;
    const seen = new Set<string>();
    const duplicateIndices: number[] = [];

    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      if (isNullOrUndefined(val)) continue;

      let serialized = typeof val === "object" ? JSON.stringify(val) : String(val);
      if (!caseSensitive) serialized = serialized.toLowerCase();

      if (seen.has(serialized)) {
        duplicateIndices.push(i);
      } else {
        seen.add(serialized);
      }
    }

    return duplicateIndices;
  }
}

// ---------------------------------------------------------------------------
// 3. TypeCheckRule — validity: value must match declared type
// ---------------------------------------------------------------------------

export class TypeCheckRule implements QualityRulePlugin {
  readonly id = "type_check";
  readonly displayName = "Type Check";
  readonly defaultSeverity = Severity.Error;

  dimension(): QualityDimension {
    return QualityDimension.Validity;
  }

  appliesTo(_field: FieldDef): boolean {
    // Type checking applies to all fields with a declared type
    return true;
  }

  async validate(value: unknown, field: FieldDef, _record: Record, config: RuleConfig): Promise<RuleResult> {
    const severity = config.severity ?? this.defaultSeverity;
    const allowCoercion = (config.options?.["allowCoercion"] as boolean) ?? false;
    const strictDates = (config.options?.["strictDates"] as boolean) ?? true;

    if (isNullOrUndefined(value)) {
      // Null check is handled by RequiredRule; type check passes for nulls on nullable fields
      if (field.nullable) return { valid: true };
      return { valid: true }; // Leave to required rule
    }

    const result = this.checkType(value, field.type, allowCoercion, strictDates);
    if (!result.matches) {
      return {
        valid: false,
        message: formatMessage(
          config.messageTemplate ?? "Field '{field}' expected type '{expected}' but got '{value}'",
          { field: field.name, value: result.actualType, expected: field.type }
        ),
        severity,
        diagnostics: {
          expectedType: field.type,
          actualType: result.actualType,
          coercible: result.coercible,
        },
      };
    }

    return { valid: true };
  }

  private checkType(
    value: unknown,
    expectedType: FieldDef["type"],
    allowCoercion: boolean,
    strictDates: boolean
  ): { matches: boolean; actualType: string; coercible: boolean } {
    const actualType = Array.isArray(value) ? "array" : typeof value;

    switch (expectedType) {
      case "string":
        if (typeof value === "string") return { matches: true, actualType, coercible: false };
        if (allowCoercion && (typeof value === "number" || typeof value === "boolean")) {
          return { matches: true, actualType, coercible: true };
        }
        return { matches: false, actualType, coercible: typeof value === "number" || typeof value === "boolean" };

      case "number":
        if (typeof value === "number" && !isNaN(value)) return { matches: true, actualType, coercible: false };
        if (allowCoercion && typeof value === "string") {
          const parsed = Number(value);
          if (!isNaN(parsed)) return { matches: true, actualType, coercible: true };
        }
        return {
          matches: false,
          actualType: typeof value === "number" && isNaN(value) ? "NaN" : actualType,
          coercible: typeof value === "string" && !isNaN(Number(value)),
        };

      case "boolean":
        if (typeof value === "boolean") return { matches: true, actualType, coercible: false };
        if (allowCoercion) {
          if (typeof value === "string" && ["true", "false", "1", "0", "yes", "no"].includes(value.toLowerCase())) {
            return { matches: true, actualType, coercible: true };
          }
          if (typeof value === "number" && (value === 0 || value === 1)) {
            return { matches: true, actualType, coercible: true };
          }
        }
        return { matches: false, actualType, coercible: false };

      case "date":
        if (value instanceof Date) {
          return { matches: !isNaN(value.getTime()), actualType: "Date", coercible: false };
        }
        if (typeof value === "string") {
          if (strictDates) {
            // ISO 8601 format check
            const isoPattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
            if (isoPattern.test(value)) {
              const d = new Date(value);
              return { matches: !isNaN(d.getTime()), actualType: "string(ISO)", coercible: true };
            }
            return { matches: false, actualType, coercible: false };
          }
          // Lenient: any parseable date string
          const d = new Date(value);
          if (!isNaN(d.getTime())) return { matches: allowCoercion, actualType, coercible: true };
        }
        if (typeof value === "number" && allowCoercion) {
          // Unix timestamp
          const d = new Date(value);
          return { matches: !isNaN(d.getTime()), actualType: "number(timestamp)", coercible: true };
        }
        return { matches: false, actualType, coercible: false };

      case "array":
        if (Array.isArray(value)) return { matches: true, actualType: "array", coercible: false };
        if (allowCoercion && typeof value === "string") {
          try {
            const parsed = JSON.parse(value);
            return { matches: Array.isArray(parsed), actualType, coercible: Array.isArray(parsed) };
          } catch {
            return { matches: false, actualType, coercible: false };
          }
        }
        return { matches: false, actualType, coercible: false };

      case "object":
        if (typeof value === "object" && !Array.isArray(value) && value !== null) {
          return { matches: true, actualType: "object", coercible: false };
        }
        if (allowCoercion && typeof value === "string") {
          try {
            const parsed = JSON.parse(value);
            return {
              matches: typeof parsed === "object" && !Array.isArray(parsed),
              actualType,
              coercible: typeof parsed === "object" && !Array.isArray(parsed),
            };
          } catch {
            return { matches: false, actualType, coercible: false };
          }
        }
        return { matches: false, actualType, coercible: false };

      default:
        return { matches: false, actualType, coercible: false };
    }
  }
}

// ---------------------------------------------------------------------------
// 4. RangeRule — validity: numeric value within min/max bounds
// ---------------------------------------------------------------------------

export class RangeRule implements QualityRulePlugin {
  readonly id = "range";
  readonly displayName = "Range Check";
  readonly defaultSeverity = Severity.Error;

  dimension(): QualityDimension {
    return QualityDimension.Validity;
  }

  appliesTo(field: FieldDef): boolean {
    return field.type === "number" || field.type === "date" || field.type === "string";
  }

  async validate(value: unknown, field: FieldDef, _record: Record, config: RuleConfig): Promise<RuleResult> {
    const severity = config.severity ?? this.defaultSeverity;
    const min = config.options?.["min"] as number | string | undefined;
    const max = config.options?.["max"] as number | string | undefined;
    const minInclusive = (config.options?.["minInclusive"] as boolean) ?? true;
    const maxInclusive = (config.options?.["maxInclusive"] as boolean) ?? true;
    const checkLength = (config.options?.["checkLength"] as boolean) ?? false;

    if (isNullOrUndefined(value)) return { valid: true };

    // Determine the comparable value
    let comparable: number;
    let displayValue: string;

    if (checkLength && typeof value === "string") {
      // String length mode
      comparable = value.length;
      displayValue = `length(${comparable})`;
    } else if (field.type === "date") {
      // Date comparison
      const dateValue = value instanceof Date ? value : new Date(value as string | number);
      if (isNaN(dateValue.getTime())) {
        return {
          valid: false,
          message: `Field '${field.name}' has an unparseable date value for range check`,
          severity,
        };
      }
      comparable = dateValue.getTime();
      displayValue = dateValue.toISOString();

      // Parse min/max as dates too
      const minDate = min !== undefined ? new Date(min).getTime() : undefined;
      const maxDate = max !== undefined ? new Date(max).getTime() : undefined;

      return this.checkRange(comparable, minDate, maxDate, minInclusive, maxInclusive, field, displayValue, config, severity);
    } else if (typeof value === "number") {
      comparable = value;
      displayValue = String(value);
    } else if (typeof value === "string" && !checkLength) {
      const parsed = Number(value);
      if (isNaN(parsed)) {
        return {
          valid: false,
          message: `Field '${field.name}' value '${value}' is not numeric for range check`,
          severity,
        };
      }
      comparable = parsed;
      displayValue = String(parsed);
    } else {
      return { valid: true }; // Non-applicable type
    }

    const numMin = min !== undefined ? Number(min) : undefined;
    const numMax = max !== undefined ? Number(max) : undefined;

    return this.checkRange(comparable, numMin, numMax, minInclusive, maxInclusive, field, displayValue, config, severity);
  }

  private checkRange(
    value: number,
    min: number | undefined,
    max: number | undefined,
    minInclusive: boolean,
    maxInclusive: boolean,
    field: FieldDef,
    displayValue: string,
    config: RuleConfig,
    severity: Severity
  ): RuleResult {
    if (min !== undefined) {
      const belowMin = minInclusive ? value < min : value <= min;
      if (belowMin) {
        const op = minInclusive ? ">=" : ">";
        return {
          valid: false,
          message: formatMessage(
            config.messageTemplate ?? `Field '{field}' value ${displayValue} must be ${op} {expected}`,
            { field: field.name, value: displayValue, expected: min }
          ),
          severity,
          diagnostics: { constraint: "min", bound: min, inclusive: minInclusive, actualValue: value },
        };
      }
    }

    if (max !== undefined) {
      const aboveMax = maxInclusive ? value > max : value >= max;
      if (aboveMax) {
        const op = maxInclusive ? "<=" : "<";
        return {
          valid: false,
          message: formatMessage(
            config.messageTemplate ?? `Field '{field}' value ${displayValue} must be ${op} {expected}`,
            { field: field.name, value: displayValue, expected: max }
          ),
          severity,
          diagnostics: { constraint: "max", bound: max, inclusive: maxInclusive, actualValue: value },
        };
      }
    }

    return { valid: true };
  }
}

// ---------------------------------------------------------------------------
// 5. PatternRule — validity: string matches regex pattern
// ---------------------------------------------------------------------------

/** Preset patterns for common validation scenarios. */
const PRESET_PATTERNS: { [name: string]: { pattern: RegExp; description: string } } = {
  email: {
    pattern: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
    description: "RFC 5322 simplified email address",
  },
  url: {
    pattern: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
    description: "HTTP/HTTPS URL",
  },
  phone: {
    pattern: /^\+?[1-9]\d{1,14}$/,
    description: "E.164 international phone number",
  },
  uuid: {
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    description: "RFC 4122 UUID",
  },
  iso_date: {
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    description: "ISO 8601 date (YYYY-MM-DD)",
  },
  iso_datetime: {
    pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/,
    description: "ISO 8601 date-time",
  },
  ipv4: {
    pattern: /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
    description: "IPv4 address",
  },
  ipv6: {
    pattern: /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,
    description: "IPv6 address (full form)",
  },
  hex_color: {
    pattern: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
    description: "Hex color code",
  },
  slug: {
    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    description: "URL slug (lowercase alphanumeric with hyphens)",
  },
};

export class PatternRule implements QualityRulePlugin {
  readonly id = "pattern";
  readonly displayName = "Pattern Match";
  readonly defaultSeverity = Severity.Error;

  dimension(): QualityDimension {
    return QualityDimension.Validity;
  }

  appliesTo(field: FieldDef): boolean {
    return field.type === "string";
  }

  async validate(value: unknown, field: FieldDef, _record: Record, config: RuleConfig): Promise<RuleResult> {
    const severity = config.severity ?? this.defaultSeverity;

    if (isNullOrUndefined(value)) return { valid: true };
    if (typeof value !== "string") {
      return {
        valid: false,
        message: `Field '${field.name}' must be a string for pattern validation`,
        severity,
      };
    }

    // Determine pattern: preset name or custom regex string
    const presetName = config.options?.["preset"] as string | undefined;
    const customPattern = config.options?.["pattern"] as string | undefined;
    const flags = (config.options?.["flags"] as string) ?? "";
    const invert = (config.options?.["invert"] as boolean) ?? false;

    let regex: RegExp;
    let patternDescription: string;

    if (presetName && PRESET_PATTERNS[presetName]) {
      regex = PRESET_PATTERNS[presetName].pattern;
      patternDescription = PRESET_PATTERNS[presetName].description;
    } else if (customPattern) {
      try {
        regex = new RegExp(customPattern, flags);
        patternDescription = customPattern;
      } catch (e) {
        return {
          valid: false,
          message: `Field '${field.name}' has invalid pattern configuration: ${(e as Error).message}`,
          severity: Severity.Error,
        };
      }
    } else {
      return { valid: true }; // No pattern configured
    }

    const matches = regex.test(value);
    const valid = invert ? !matches : matches;

    if (!valid) {
      return {
        valid: false,
        message: formatMessage(
          config.messageTemplate ?? `Field '{field}' value '{value}' does not match ${invert ? "exclusion " : ""}pattern: ${patternDescription}`,
          { field: field.name, value, expected: patternDescription }
        ),
        severity,
        diagnostics: {
          pattern: regex.source,
          flags: regex.flags,
          preset: presetName,
          invert,
          testedValue: value.length > 100 ? value.substring(0, 100) + "..." : value,
        },
      };
    }

    return { valid: true };
  }

  /** Get list of available preset pattern names. */
  static presets(): string[] {
    return Object.keys(PRESET_PATTERNS);
  }
}

// ---------------------------------------------------------------------------
// 6. EnumRule — validity: value must be in allowed set
// ---------------------------------------------------------------------------

export class EnumRule implements QualityRulePlugin {
  readonly id = "enum";
  readonly displayName = "Enum Check";
  readonly defaultSeverity = Severity.Error;

  dimension(): QualityDimension {
    return QualityDimension.Validity;
  }

  appliesTo(_field: FieldDef): boolean {
    return true; // Enums can apply to any type
  }

  async validate(value: unknown, field: FieldDef, _record: Record, config: RuleConfig): Promise<RuleResult> {
    const severity = config.severity ?? this.defaultSeverity;
    const allowedValues = config.options?.["values"] as unknown[] | undefined;
    const caseSensitive = (config.options?.["caseSensitive"] as boolean) ?? true;
    const allowSubset = (config.options?.["allowSubset"] as boolean) ?? false;

    if (isNullOrUndefined(value) || !allowedValues || allowedValues.length === 0) {
      return { valid: true };
    }

    // For array values, check that all elements are in the allowed set (subset validation)
    if (Array.isArray(value) && allowSubset) {
      const invalidElements: unknown[] = [];
      for (const elem of value) {
        if (!this.isInSet(elem, allowedValues, caseSensitive)) {
          invalidElements.push(elem);
        }
      }
      if (invalidElements.length > 0) {
        return {
          valid: false,
          message: formatMessage(
            config.messageTemplate ?? `Field '{field}' contains values not in allowed set: ${JSON.stringify(invalidElements)}`,
            { field: field.name, value: invalidElements, expected: allowedValues }
          ),
          severity,
          diagnostics: {
            invalidElements,
            allowedValues,
            totalChecked: value.length,
            invalidCount: invalidElements.length,
          },
        };
      }
      return { valid: true };
    }

    // Single value check
    if (!this.isInSet(value, allowedValues, caseSensitive)) {
      const truncatedAllowed = allowedValues.length > 10
        ? [...allowedValues.slice(0, 10), `... (${allowedValues.length} total)`]
        : allowedValues;

      return {
        valid: false,
        message: formatMessage(
          config.messageTemplate ?? `Field '{field}' value '{value}' is not in allowed set: [${truncatedAllowed.join(", ")}]`,
          { field: field.name, value, expected: truncatedAllowed.join(", ") }
        ),
        severity,
        diagnostics: {
          allowedValues,
          receivedValue: value,
          closestMatch: this.findClosestMatch(value, allowedValues),
        },
      };
    }

    return { valid: true };
  }

  private isInSet(value: unknown, allowed: unknown[], caseSensitive: boolean): boolean {
    if (caseSensitive) {
      return allowed.includes(value);
    }
    // Case-insensitive comparison for strings
    const lowerValue = typeof value === "string" ? value.toLowerCase() : value;
    return allowed.some((a) => {
      const lowerAllowed = typeof a === "string" ? a.toLowerCase() : a;
      return lowerValue === lowerAllowed;
    });
  }

  /** Find the closest matching allowed value using Levenshtein distance. */
  private findClosestMatch(value: unknown, allowed: unknown[]): unknown | undefined {
    if (typeof value !== "string") return undefined;
    let closest: unknown | undefined;
    let minDistance = Infinity;
    for (const a of allowed) {
      if (typeof a !== "string") continue;
      const dist = this.levenshteinDistance(value.toLowerCase(), a.toLowerCase());
      if (dist < minDistance) {
        minDistance = dist;
        closest = a;
      }
    }
    return minDistance <= Math.max(value.length, 3) ? closest : undefined;
  }

  private levenshteinDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  }
}

// ---------------------------------------------------------------------------
// 7. ForeignKeyRule — consistency: referenced entity must exist
// ---------------------------------------------------------------------------

export class ForeignKeyRule implements QualityRulePlugin {
  readonly id = "foreign_key";
  readonly displayName = "Foreign Key Check";
  readonly defaultSeverity = Severity.Error;

  private storage: StorageAdapter | undefined;
  /** Prefetch cache: entityType => Set<key> that are known to exist. */
  private existenceCache = new Map<string, Set<string>>();

  constructor(storage?: StorageAdapter) {
    this.storage = storage;
  }

  dimension(): QualityDimension {
    return QualityDimension.Consistency;
  }

  appliesTo(field: FieldDef): boolean {
    // Typically applies to fields with a metadata reference
    return field.metadata?.["referencedEntity"] !== undefined;
  }

  async validate(value: unknown, field: FieldDef, _record: Record, config: RuleConfig): Promise<RuleResult> {
    const severity = config.severity ?? this.defaultSeverity;
    const referencedEntity = (config.options?.["referencedEntity"] as string)
      ?? (field.metadata?.["referencedEntity"] as string);
    const referencedField = (config.options?.["referencedField"] as string) ?? "id";
    const softEnforcement = (config.options?.["soft"] as boolean) ?? false;

    if (isNullOrUndefined(value) || !referencedEntity) {
      return { valid: true };
    }

    if (!this.storage) {
      // Without a storage adapter, we can only report the constraint exists
      return {
        valid: true,
        diagnostics: {
          warning: "No storage adapter configured; foreign key not verified",
          referencedEntity,
          referencedField,
        },
      };
    }

    // Check cache first
    const cacheKey = `${referencedEntity}:${referencedField}`;
    const cached = this.existenceCache.get(cacheKey);
    const key = String(value);

    if (cached?.has(key)) {
      return { valid: true };
    }

    // Query storage
    const exists = await this.storage.entityExists(referencedEntity, key);

    if (exists) {
      // Cache the positive result
      if (!this.existenceCache.has(cacheKey)) {
        this.existenceCache.set(cacheKey, new Set());
      }
      this.existenceCache.get(cacheKey)!.add(key);
      return { valid: true };
    }

    // Entity does not exist
    const effectiveSeverity = softEnforcement ? Severity.Warning : severity;
    return {
      valid: false,
      message: formatMessage(
        config.messageTemplate ?? `Field '{field}' references non-existent ${referencedEntity}.${referencedField} = '{value}'`,
        { field: field.name, value, expected: `${referencedEntity}.${referencedField}` }
      ),
      severity: effectiveSeverity,
      diagnostics: {
        referencedEntity,
        referencedField,
        missingKey: value,
        softEnforcement,
      },
    };
  }

  /** Batch prefetch referenced entities for performance. */
  async prefetch(entityType: string, keys: (string | number)[]): Promise<void> {
    if (!this.storage) return;

    const results = await this.storage.entitiesBatchExist(entityType, keys);
    const cacheKey = `${entityType}:id`;

    if (!this.existenceCache.has(cacheKey)) {
      this.existenceCache.set(cacheKey, new Set());
    }
    const cache = this.existenceCache.get(cacheKey)!;

    for (const [key, exists] of results) {
      if (exists) cache.add(String(key));
    }
  }

  /** Clear the existence cache. */
  clearCache(): void {
    this.existenceCache.clear();
  }
}

// ---------------------------------------------------------------------------
// 8. CrossFieldRule — consistency: multi-field rules
// ---------------------------------------------------------------------------

/** Supported comparison operators for cross-field rules. */
type ComparisonOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "not_contains";

export class CrossFieldRule implements QualityRulePlugin {
  readonly id = "cross_field";
  readonly displayName = "Cross-Field Validation";
  readonly defaultSeverity = Severity.Error;

  dimension(): QualityDimension {
    return QualityDimension.Consistency;
  }

  appliesTo(_field: FieldDef): boolean {
    // Cross-field rules are configured externally and can apply to any field
    return true;
  }

  async validate(value: unknown, field: FieldDef, record: Record, config: RuleConfig): Promise<RuleResult> {
    const severity = config.severity ?? this.defaultSeverity;
    const rules = config.options?.["rules"] as Array<{
      leftField: string;
      operator: ComparisonOp;
      rightField?: string;
      rightValue?: unknown;
      condition?: { field: string; operator: ComparisonOp; value: unknown };
    }> | undefined;

    if (!rules || rules.length === 0) return { valid: true };

    const violations: string[] = [];

    for (const rule of rules) {
      // Check conditional — only evaluate if condition is met
      if (rule.condition) {
        const condVal = record[rule.condition.field];
        if (!this.compare(condVal, rule.condition.operator, rule.condition.value)) {
          continue; // Condition not met, skip this rule
        }
      }

      const leftVal = record[rule.leftField];
      const rightVal = rule.rightField ? record[rule.rightField] : rule.rightValue;

      if (isNullOrUndefined(leftVal) || isNullOrUndefined(rightVal)) {
        continue; // Skip null comparisons
      }

      if (!this.compare(leftVal, rule.operator, rightVal)) {
        const rightDesc = rule.rightField ?? JSON.stringify(rule.rightValue);
        violations.push(
          `${rule.leftField} (${this.formatVal(leftVal)}) must be ${rule.operator} ${rightDesc} (${this.formatVal(rightVal)})`
        );
      }
    }

    if (violations.length > 0) {
      return {
        valid: false,
        message: formatMessage(
          config.messageTemplate ?? `Cross-field validation failed for '{field}': ${violations.join("; ")}`,
          { field: field.name, value }
        ),
        severity,
        diagnostics: { violations, ruleCount: rules.length, failedCount: violations.length },
      };
    }

    return { valid: true };
  }

  private compare(left: unknown, op: ComparisonOp, right: unknown): boolean {
    // Attempt date-aware comparison
    const leftNum = this.toComparable(left);
    const rightNum = this.toComparable(right);

    switch (op) {
      case "eq":
        return leftNum !== undefined && rightNum !== undefined ? leftNum === rightNum : left === right;
      case "neq":
        return leftNum !== undefined && rightNum !== undefined ? leftNum !== rightNum : left !== right;
      case "gt":
        return leftNum !== undefined && rightNum !== undefined ? leftNum > rightNum : String(left) > String(right);
      case "gte":
        return leftNum !== undefined && rightNum !== undefined ? leftNum >= rightNum : String(left) >= String(right);
      case "lt":
        return leftNum !== undefined && rightNum !== undefined ? leftNum < rightNum : String(left) < String(right);
      case "lte":
        return leftNum !== undefined && rightNum !== undefined ? leftNum <= rightNum : String(left) <= String(right);
      case "contains":
        return String(left).includes(String(right));
      case "not_contains":
        return !String(left).includes(String(right));
      default:
        return false;
    }
  }

  private toComparable(value: unknown): number | undefined {
    if (typeof value === "number") return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "string") {
      // Try parsing as date first
      const d = new Date(value);
      if (!isNaN(d.getTime()) && /^\d{4}-\d{2}/.test(value)) return d.getTime();
      // Try parsing as number
      const n = Number(value);
      if (!isNaN(n)) return n;
    }
    return undefined;
  }

  private formatVal(v: unknown): string {
    if (v instanceof Date) return v.toISOString();
    return String(v);
  }
}

// ---------------------------------------------------------------------------
// 9. FreshnessRule — timeliness: data must be newer than threshold
// ---------------------------------------------------------------------------

export class FreshnessRule implements QualityRulePlugin {
  readonly id = "freshness";
  readonly displayName = "Data Freshness";
  readonly defaultSeverity = Severity.Warning;

  dimension(): QualityDimension {
    return QualityDimension.Timeliness;
  }

  appliesTo(field: FieldDef): boolean {
    return field.type === "date";
  }

  async validate(value: unknown, field: FieldDef, _record: Record, config: RuleConfig): Promise<RuleResult> {
    const severity = config.severity ?? this.defaultSeverity;

    if (isNullOrUndefined(value)) return { valid: true };

    // Parse the timestamp value
    let timestamp: Date;
    if (value instanceof Date) {
      timestamp = value;
    } else if (typeof value === "string") {
      timestamp = new Date(value);
    } else if (typeof value === "number") {
      timestamp = new Date(value);
    } else {
      return {
        valid: false,
        message: `Field '${field.name}' has an unparseable date for freshness check`,
        severity,
      };
    }

    if (isNaN(timestamp.getTime())) {
      return {
        valid: false,
        message: `Field '${field.name}' has an invalid date for freshness check`,
        severity,
      };
    }

    // Determine threshold: either a duration string or an absolute timestamp
    const maxAgeDuration = config.options?.["maxAge"] as string | undefined; // e.g., "24h", "7d", "30m"
    const absoluteThreshold = config.options?.["notBefore"] as string | number | undefined;
    const timezone = (config.options?.["timezone"] as string) ?? "UTC";

    const referenceTime = this.getReferenceTime(timezone);

    let thresholdMs: number;

    if (maxAgeDuration) {
      const durationMs = this.parseDuration(maxAgeDuration);
      if (durationMs === undefined) {
        return {
          valid: false,
          message: `Invalid maxAge duration format: '${maxAgeDuration}'. Use formats like '24h', '7d', '30m', '1y'`,
          severity: Severity.Error,
        };
      }
      thresholdMs = referenceTime.getTime() - durationMs;
    } else if (absoluteThreshold !== undefined) {
      const abs = new Date(absoluteThreshold);
      if (isNaN(abs.getTime())) {
        return {
          valid: false,
          message: `Invalid absolute threshold: '${absoluteThreshold}'`,
          severity: Severity.Error,
        };
      }
      thresholdMs = abs.getTime();
    } else {
      return { valid: true }; // No threshold configured
    }

    const ageMs = referenceTime.getTime() - timestamp.getTime();
    const ageHuman = this.formatAge(ageMs);

    if (timestamp.getTime() < thresholdMs) {
      return {
        valid: false,
        message: formatMessage(
          config.messageTemplate ?? `Field '{field}' data is stale (age: ${ageHuman}, max allowed: ${maxAgeDuration ?? absoluteThreshold})`,
          { field: field.name, value: timestamp.toISOString(), expected: maxAgeDuration ?? absoluteThreshold }
        ),
        severity,
        diagnostics: {
          timestamp: timestamp.toISOString(),
          ageMs,
          ageHuman,
          thresholdMs,
          maxAge: maxAgeDuration,
          absoluteThreshold,
          referenceTime: referenceTime.toISOString(),
        },
      };
    }

    // Also check for future timestamps
    const allowFuture = (config.options?.["allowFuture"] as boolean) ?? false;
    if (!allowFuture && timestamp.getTime() > referenceTime.getTime() + 60_000) { // 1 minute tolerance
      return {
        valid: false,
        message: `Field '${field.name}' has a future timestamp: ${timestamp.toISOString()}`,
        severity: Severity.Warning,
        diagnostics: {
          timestamp: timestamp.toISOString(),
          referenceTime: referenceTime.toISOString(),
          aheadByMs: timestamp.getTime() - referenceTime.getTime(),
        },
      };
    }

    return { valid: true, diagnostics: { ageMs, ageHuman } };
  }

  private getReferenceTime(timezone: string): Date {
    // In a full implementation, this would adjust for timezone offset
    // For UTC, simply return current time
    if (timezone === "UTC") return new Date();

    // Basic timezone support: parse offset-based zones like "UTC+5", "UTC-8"
    const offsetMatch = timezone.match(/^UTC([+-])(\d{1,2})(?::(\d{2}))?$/);
    if (offsetMatch) {
      const sign = offsetMatch[1] === "+" ? 1 : -1;
      const hours = parseInt(offsetMatch[2], 10);
      const minutes = parseInt(offsetMatch[3] ?? "0", 10);
      const offsetMs = sign * (hours * 60 + minutes) * 60_000;
      return new Date(Date.now() + offsetMs);
    }

    return new Date(); // Fallback to system time
  }

  /** Parse duration strings like "24h", "7d", "30m", "1y", "2w" to milliseconds. */
  private parseDuration(duration: string): number | undefined {
    const match = duration.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w|M|y)$/);
    if (!match) return undefined;

    const amount = parseFloat(match[1]);
    const unit = match[2];

    const unitMs: { [key: string]: number } = {
      ms: 1,
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
      w: 604_800_000,
      M: 2_592_000_000, // 30 days
      y: 31_536_000_000, // 365 days
    };

    return amount * (unitMs[unit] ?? 0);
  }

  private formatAge(ms: number): string {
    const abs = Math.abs(ms);
    if (abs < 60_000) return `${Math.round(abs / 1000)}s`;
    if (abs < 3_600_000) return `${Math.round(abs / 60_000)}m`;
    if (abs < 86_400_000) return `${(abs / 3_600_000).toFixed(1)}h`;
    if (abs < 604_800_000) return `${(abs / 86_400_000).toFixed(1)}d`;
    return `${(abs / 604_800_000).toFixed(1)}w`;
  }
}

// ---------------------------------------------------------------------------
// 10. NoDuplicatesRule — uniqueness: record-level dedup via configurable fields
// ---------------------------------------------------------------------------

export class NoDuplicatesRule implements QualityRulePlugin {
  readonly id = "no_duplicates";
  readonly displayName = "No Duplicate Records";
  readonly defaultSeverity = Severity.Warning;

  /** Track seen record signatures for dedup. */
  private seenSignatures = new Map<string, { index: number; record: Record }>();
  private recordIndex = 0;

  dimension(): QualityDimension {
    return QualityDimension.Uniqueness;
  }

  appliesTo(_field: FieldDef): boolean {
    return true; // Operates at record level
  }

  async validate(_value: unknown, field: FieldDef, record: Record, config: RuleConfig): Promise<RuleResult> {
    const severity = config.severity ?? this.defaultSeverity;
    const compareFields = config.options?.["compareFields"] as string[] | undefined;
    const matchMode = (config.options?.["matchMode"] as "exact" | "fuzzy" | "normalized") ?? "exact";
    const similarityThreshold = (config.options?.["similarityThreshold"] as number) ?? 0.9;

    if (!compareFields || compareFields.length === 0) {
      return { valid: true }; // No fields to compare
    }

    const currentIndex = this.recordIndex++;

    if (matchMode === "exact") {
      // Exact match: hash the comparison fields
      const signature = this.computeExactSignature(record, compareFields);
      const existing = this.seenSignatures.get(signature);

      if (existing) {
        return {
          valid: false,
          message: formatMessage(
            config.messageTemplate ?? `Duplicate record detected for '{field}' (matches record at index ${existing.index})`,
            { field: field.name }
          ),
          severity,
          diagnostics: {
            matchMode: "exact",
            matchedIndex: existing.index,
            compareFields,
          },
        };
      }

      this.seenSignatures.set(signature, { index: currentIndex, record });
    } else if (matchMode === "normalized") {
      // Normalized: lowercase, trim whitespace, remove punctuation
      const signature = this.computeNormalizedSignature(record, compareFields);
      const existing = this.seenSignatures.get(signature);

      if (existing) {
        return {
          valid: false,
          message: formatMessage(
            config.messageTemplate ?? `Duplicate record detected (normalized match at index ${existing.index})`,
            { field: field.name }
          ),
          severity,
          diagnostics: {
            matchMode: "normalized",
            matchedIndex: existing.index,
            compareFields,
          },
        };
      }

      this.seenSignatures.set(signature, { index: currentIndex, record });
    } else if (matchMode === "fuzzy") {
      // Fuzzy: compare using Jaccard similarity on field values
      for (const [sig, existing] of this.seenSignatures) {
        const similarity = this.computeJaccardSimilarity(record, existing.record, compareFields);
        if (similarity >= similarityThreshold) {
          return {
            valid: false,
            message: formatMessage(
              config.messageTemplate ?? `Probable duplicate record detected (similarity: ${(similarity * 100).toFixed(1)}%, threshold: ${(similarityThreshold * 100).toFixed(1)}%)`,
              { field: field.name, value: similarity }
            ),
            severity,
            diagnostics: {
              matchMode: "fuzzy",
              similarity,
              threshold: similarityThreshold,
              matchedIndex: existing.index,
              compareFields,
            },
          };
        }
      }
      const signature = this.computeExactSignature(record, compareFields);
      this.seenSignatures.set(signature, { index: currentIndex, record });
    }

    return { valid: true };
  }

  private computeExactSignature(record: Record, fields: string[]): string {
    return fields.map((f) => `${f}:${JSON.stringify(record[f])}`).join("|");
  }

  private computeNormalizedSignature(record: Record, fields: string[]): string {
    return fields.map((f) => {
      const val = record[f];
      if (typeof val === "string") {
        return `${f}:${val.toLowerCase().trim().replace(/[^\w\s]/g, "").replace(/\s+/g, " ")}`;
      }
      return `${f}:${JSON.stringify(val)}`;
    }).join("|");
  }

  /** Jaccard similarity: |intersection| / |union| of character bigrams across all compared fields. */
  private computeJaccardSimilarity(recordA: Record, recordB: Record, fields: string[]): number {
    let totalIntersection = 0;
    let totalUnion = 0;

    for (const f of fields) {
      const a = String(recordA[f] ?? "").toLowerCase();
      const b = String(recordB[f] ?? "").toLowerCase();

      const bigramsA = this.bigrams(a);
      const bigramsB = this.bigrams(b);

      const setA = new Set(bigramsA);
      const setB = new Set(bigramsB);

      let intersection = 0;
      for (const bg of setA) {
        if (setB.has(bg)) intersection++;
      }

      const union = setA.size + setB.size - intersection;
      totalIntersection += intersection;
      totalUnion += union;
    }

    return totalUnion === 0 ? 1 : totalIntersection / totalUnion;
  }

  private bigrams(s: string): string[] {
    const result: string[] = [];
    for (let i = 0; i < s.length - 1; i++) {
      result.push(s.substring(i, i + 2));
    }
    return result;
  }

  /** Reset deduplication state between batch runs. */
  reset(): void {
    this.seenSignatures.clear();
    this.recordIndex = 0;
  }
}

// ---------------------------------------------------------------------------
// 11. ReconciliationRule — accuracy: value matches external knowledge base
// ---------------------------------------------------------------------------

export class ReconciliationRule implements QualityRulePlugin {
  readonly id = "reconciliation";
  readonly displayName = "External Reconciliation";
  readonly defaultSeverity = Severity.Warning;

  private knowledgeBase: KnowledgeBaseAdapter | undefined;

  /** Cache of reconciliation results: value => best match. */
  private reconciliationCache = new Map<string, { match: string; confidence: number; source: string }>();

  constructor(knowledgeBase?: KnowledgeBaseAdapter) {
    this.knowledgeBase = knowledgeBase;
  }

  dimension(): QualityDimension {
    return QualityDimension.Accuracy;
  }

  appliesTo(field: FieldDef): boolean {
    return field.type === "string";
  }

  async validate(value: unknown, field: FieldDef, _record: Record, config: RuleConfig): Promise<RuleResult> {
    const severity = config.severity ?? this.defaultSeverity;
    const confidenceThreshold = (config.options?.["confidenceThreshold"] as number) ?? 0.8;
    const entityType = (config.options?.["entityType"] as string) ?? undefined;
    const useFuzzyMatching = (config.options?.["fuzzyMatching"] as boolean) ?? true;
    const source = (config.options?.["source"] as string) ?? "default";

    if (isNullOrUndefined(value) || typeof value !== "string" || value.trim().length === 0) {
      return { valid: true };
    }

    if (!this.knowledgeBase) {
      return {
        valid: true,
        diagnostics: {
          warning: "No knowledge base adapter configured; reconciliation skipped",
          source,
          entityType,
        },
      };
    }

    // Check cache first
    const cacheKey = `${source}:${entityType ?? "*"}:${value}`;
    const cached = this.reconciliationCache.get(cacheKey);

    if (cached) {
      if (cached.confidence >= confidenceThreshold) {
        return {
          valid: true,
          diagnostics: {
            matchedValue: cached.match,
            confidence: cached.confidence,
            source: cached.source,
            fromCache: true,
          },
        };
      }
      return this.buildReconciliationFailure(value, field, cached, confidenceThreshold, severity, config);
    }

    // Query knowledge base
    const matches = await this.knowledgeBase.lookup(value, entityType);

    if (matches.length === 0) {
      return {
        valid: false,
        message: formatMessage(
          config.messageTemplate ?? `Field '{field}' value '{value}' not found in knowledge base (source: ${source})`,
          { field: field.name, value, expected: `${source} KB` }
        ),
        severity,
        diagnostics: { source, entityType, matchCount: 0, confidenceThreshold },
      };
    }

    // Sort by confidence and take the best match
    matches.sort((a, b) => b.confidence - a.confidence);
    const best = matches[0];

    // Cache the result
    this.reconciliationCache.set(cacheKey, best);

    // Apply fuzzy matching: if the best match is above threshold, accept
    if (best.confidence >= confidenceThreshold) {
      return {
        valid: true,
        diagnostics: {
          matchedValue: best.match,
          confidence: best.confidence,
          source: best.source,
          isExactMatch: best.confidence === 1.0,
          alternativeMatches: matches.slice(1, 4).map((m) => ({
            value: m.match,
            confidence: m.confidence,
          })),
        },
      };
    }

    // Best match is below threshold
    if (!useFuzzyMatching) {
      // Strict mode: only exact matches (confidence = 1.0)
      if (best.confidence < 1.0) {
        return {
          valid: false,
          message: formatMessage(
            config.messageTemplate ?? `Field '{field}' value '{value}' does not exactly match any entry in ${source}`,
            { field: field.name, value, expected: best.match }
          ),
          severity,
          diagnostics: {
            closestMatch: best.match,
            confidence: best.confidence,
            source: best.source,
            threshold: confidenceThreshold,
          },
        };
      }
    }

    return this.buildReconciliationFailure(value, field, best, confidenceThreshold, severity, config);
  }

  private buildReconciliationFailure(
    value: string,
    field: FieldDef,
    best: { match: string; confidence: number; source: string },
    threshold: number,
    severity: Severity,
    config: RuleConfig
  ): RuleResult {
    return {
      valid: false,
      message: formatMessage(
        config.messageTemplate ?? `Field '{field}' value '{value}' has low confidence match (${(best.confidence * 100).toFixed(1)}% < ${(threshold * 100).toFixed(1)}% threshold). Best match: '${best.match}'`,
        { field: field.name, value, expected: best.match }
      ),
      severity,
      diagnostics: {
        closestMatch: best.match,
        confidence: best.confidence,
        source: best.source,
        threshold,
        suggestedCorrection: best.match,
      },
    };
  }

  /** Clear the reconciliation cache. */
  clearCache(): void {
    this.reconciliationCache.clear();
  }
}

// ---------------------------------------------------------------------------
// Provider Registry
// ---------------------------------------------------------------------------

/** All quality rule providers indexed by their unique ID. */
export const qualityRuleProviders: ReadonlyMap<string, QualityRulePlugin> = new Map<string, QualityRulePlugin>([
  ["required", new RequiredRule()],
  ["unique", new UniqueRule()],
  ["type_check", new TypeCheckRule()],
  ["range", new RangeRule()],
  ["pattern", new PatternRule()],
  ["enum", new EnumRule()],
  ["foreign_key", new ForeignKeyRule()],
  ["cross_field", new CrossFieldRule()],
  ["freshness", new FreshnessRule()],
  ["no_duplicates", new NoDuplicatesRule()],
  ["reconciliation", new ReconciliationRule()],
]);

/**
 * Resolve all applicable quality rules for a given field definition.
 * Returns providers whose `appliesTo()` returns true for the field.
 */
export function resolveRulesForField(field: FieldDef): QualityRulePlugin[] {
  const applicable: QualityRulePlugin[] = [];
  for (const [, provider] of qualityRuleProviders) {
    if (provider.appliesTo(field)) {
      applicable.push(provider);
    }
  }
  return applicable;
}

/**
 * Validate a record against all applicable quality rules.
 * Returns results grouped by field and dimension.
 */
export async function validateRecord(
  record: Record,
  fields: FieldDef[],
  ruleConfigs: { [ruleId: string]: RuleConfig } = {}
): Promise<Map<string, RuleResult[]>> {
  const results = new Map<string, RuleResult[]>();

  for (const field of fields) {
    const fieldResults: RuleResult[] = [];
    const value = record[field.name];

    for (const [ruleId, provider] of qualityRuleProviders) {
      const config = ruleConfigs[ruleId] ?? {};
      if (config.enabled === false) continue;
      if (!provider.appliesTo(field)) continue;

      const result = await provider.validate(value, field, record, config);
      if (!result.valid) {
        fieldResults.push(result);
      }
    }

    if (fieldResults.length > 0) {
      results.set(field.name, fieldResults);
    }
  }

  return results;
}

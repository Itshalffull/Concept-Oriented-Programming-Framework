// Quality Rule Provider: Freshness Validation
// Ensures data timestamps are within an acceptable recency window.
// Dimension: timeliness

export const PROVIDER_ID = 'freshness';
export const PLUGIN_TYPE = 'quality_rule';

export interface FieldDef {
  name: string;
  type: string;
  required?: boolean;
  constraints?: Record<string, unknown>;
}

export interface RuleConfig {
  options?: Record<string, unknown>;
  threshold?: number;
}

export interface RuleResult {
  valid: boolean;
  message?: string;
  severity: 'error' | 'warning' | 'info';
}

export type QualityDimension = 'completeness' | 'uniqueness' | 'validity' | 'consistency' | 'timeliness' | 'accuracy';

export class FreshnessQualityProvider {
  validate(
    value: unknown,
    field: FieldDef,
    record: Record<string, unknown>,
    config: RuleConfig
  ): RuleResult {
    const timestampField = (config.options?.timestampField as string) ?? field.name;
    const rawTimestamp = timestampField === field.name ? value : record[timestampField];

    if (rawTimestamp === null || rawTimestamp === undefined) {
      return {
        valid: false,
        message: `Freshness check for '${field.name}': timestamp field '${timestampField}' is missing.`,
        severity: 'warning',
      };
    }

    const timestamp = this.parseTimestamp(rawTimestamp);
    if (timestamp === null) {
      return {
        valid: false,
        message: `Freshness check for '${field.name}': cannot parse timestamp value '${rawTimestamp}'.`,
        severity: 'error',
      };
    }

    const maxAge = this.parseMaxAge(config.options?.maxAge);
    if (maxAge === null) {
      return {
        valid: false,
        message: `Freshness rule for '${field.name}' is misconfigured: invalid or missing maxAge.`,
        severity: 'warning',
      };
    }

    const now = Date.now();
    const ageMs = now - timestamp;

    if (ageMs > maxAge) {
      const ageHours = Math.round(ageMs / 3600000 * 10) / 10;
      const maxAgeHours = Math.round(maxAge / 3600000 * 10) / 10;
      return {
        valid: false,
        message: `Field '${field.name}' data is stale: age is ${ageHours}h, maximum allowed is ${maxAgeHours}h.`,
        severity: 'error',
      };
    }

    return { valid: true, severity: 'info' };
  }

  private parseTimestamp(value: unknown): number | null {
    if (typeof value === 'number') return value;
    if (value instanceof Date) {
      const ts = value.getTime();
      return isNaN(ts) ? null : ts;
    }
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  private parseMaxAge(maxAge: unknown): number | null {
    if (typeof maxAge === 'number') return maxAge * 1000;

    if (typeof maxAge === 'string') {
      const match = maxAge.match(/^(\d+(?:\.\d+)?)\s*(s|sec|seconds?|m|min|minutes?|h|hours?|d|days?)$/i);
      if (!match) return null;
      const amount = parseFloat(match[1]);
      const unit = match[2].toLowerCase();

      if (unit.startsWith('s')) return amount * 1000;
      if (unit.startsWith('mi') || unit === 'm') return amount * 60 * 1000;
      if (unit.startsWith('h')) return amount * 3600 * 1000;
      if (unit.startsWith('d')) return amount * 86400 * 1000;
    }

    return null;
  }

  appliesTo(field: FieldDef): boolean {
    const dateTypes = ['date', 'datetime', 'timestamp'];
    return dateTypes.includes(field.type.toLowerCase());
  }

  dimension(): QualityDimension {
    return 'timeliness';
  }
}

export default FreshnessQualityProvider;

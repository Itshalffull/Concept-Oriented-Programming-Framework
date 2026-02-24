// Transform Plugin Provider: date_format
// Parse and reformat dates with timezone support and auto-detection.
// See Architecture doc for transform plugin interface contract.

export const PROVIDER_ID = 'date_format';
export const PLUGIN_TYPE = 'transform_plugin';

export interface TransformConfig {
  options?: Record<string, unknown>;
}

export interface TypeSpec {
  type: string;
  nullable?: boolean;
}

export class DateFormatTransformProvider {
  transform(value: unknown, config: TransformConfig): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    const outputFormat = (config.options?.outputFormat as string) ?? 'iso8601';
    const inputFormat = config.options?.inputFormat as string | undefined;
    const timezone = config.options?.timezone as string | undefined;

    const date = this.parseDate(value, inputFormat);
    if (!date || isNaN(date.getTime())) {
      throw new Error(`Cannot parse date from value: "${value}"`);
    }

    return this.formatDate(date, outputFormat, timezone);
  }

  private parseDate(value: unknown, inputFormat?: string): Date | null {
    // Unix timestamp (number)
    if (typeof value === 'number') {
      // Detect seconds vs milliseconds
      if (value < 1e12) {
        return new Date(value * 1000);
      }
      return new Date(value);
    }

    const str = String(value).trim();
    if (!str) return null;

    // Explicit input format parsing
    if (inputFormat) {
      return this.parseWithFormat(str, inputFormat);
    }

    // Auto-detection: Unix timestamp as string
    if (/^\d{10}$/.test(str)) {
      return new Date(parseInt(str, 10) * 1000);
    }
    if (/^\d{13}$/.test(str)) {
      return new Date(parseInt(str, 10));
    }

    // ISO 8601
    if (/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2})?/.test(str)) {
      return new Date(str);
    }

    // Common patterns: MM/DD/YYYY, DD/MM/YYYY
    const usDate = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (usDate) {
      const [, month, day, year] = usDate;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // DD-Mon-YYYY (e.g., 15-Jan-2024)
    const monDate = str.match(/^(\d{1,2})-(\w{3})-(\d{4})$/);
    if (monDate) {
      const months: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
      };
      const [, day, mon, year] = monDate;
      const monthIdx = months[mon.toLowerCase()];
      if (monthIdx !== undefined) {
        return new Date(parseInt(year), monthIdx, parseInt(day));
      }
    }

    // Fallback to native parsing (handles RFC 2822 and others)
    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  private parseWithFormat(str: string, format: string): Date | null {
    const tokens: Record<string, string> = {
      'YYYY': '(\\d{4})',
      'MM': '(\\d{2})',
      'DD': '(\\d{2})',
      'HH': '(\\d{2})',
      'mm': '(\\d{2})',
      'ss': '(\\d{2})',
    };

    let regexStr = format.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tokenOrder: string[] = [];

    for (const [token, re] of Object.entries(tokens)) {
      if (regexStr.includes(token)) {
        tokenOrder.push(token);
        regexStr = regexStr.replace(token, re);
      }
    }

    const match = str.match(new RegExp(`^${regexStr}$`));
    if (!match) return null;

    const parts: Record<string, number> = {
      YYYY: 2000, MM: 1, DD: 1, HH: 0, mm: 0, ss: 0,
    };

    tokenOrder.forEach((token, i) => {
      parts[token] = parseInt(match[i + 1], 10);
    });

    return new Date(parts.YYYY, parts.MM - 1, parts.DD, parts.HH, parts.mm, parts.ss);
  }

  private formatDate(date: Date, format: string, timezone?: string): string {
    // Apply timezone offset if specified
    let d = date;
    if (timezone) {
      try {
        const localeStr = d.toLocaleString('en-US', { timeZone: timezone });
        d = new Date(localeStr);
      } catch {
        // Fallback: try numeric UTC offset (e.g., "+05:30")
        const offsetMatch = timezone.match(/^([+-])(\d{2}):?(\d{2})$/);
        if (offsetMatch) {
          const sign = offsetMatch[1] === '+' ? 1 : -1;
          const hours = parseInt(offsetMatch[2], 10);
          const minutes = parseInt(offsetMatch[3], 10);
          const offsetMs = sign * (hours * 60 + minutes) * 60000;
          d = new Date(date.getTime() + offsetMs + date.getTimezoneOffset() * 60000);
        }
      }
    }

    switch (format) {
      case 'iso8601':
        return d.toISOString();
      case 'unix':
        return String(Math.floor(d.getTime() / 1000));
      case 'unix_ms':
        return String(d.getTime());
      case 'date':
        return this.pad(d.getFullYear(), 4) + '-' + this.pad(d.getMonth() + 1) + '-' + this.pad(d.getDate());
      case 'time':
        return this.pad(d.getHours()) + ':' + this.pad(d.getMinutes()) + ':' + this.pad(d.getSeconds());
      default:
        return this.applyFormatString(d, format);
    }
  }

  private applyFormatString(d: Date, format: string): string {
    const replacements: Record<string, string> = {
      'YYYY': this.pad(d.getFullYear(), 4),
      'MM': this.pad(d.getMonth() + 1),
      'DD': this.pad(d.getDate()),
      'HH': this.pad(d.getHours()),
      'mm': this.pad(d.getMinutes()),
      'ss': this.pad(d.getSeconds()),
    };
    let result = format;
    for (const [token, val] of Object.entries(replacements)) {
      result = result.split(token).join(val);
    }
    return result;
  }

  private pad(n: number, width: number = 2): string {
    return String(n).padStart(width, '0');
  }

  inputType(): TypeSpec {
    return { type: 'any', nullable: true };
  }

  outputType(): TypeSpec {
    return { type: 'string', nullable: true };
  }
}

export default DateFormatTransformProvider;

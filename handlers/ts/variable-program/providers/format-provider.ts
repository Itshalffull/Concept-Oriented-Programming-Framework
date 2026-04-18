/**
 * FormatTransformProvider — formats values using Intl APIs.
 *
 * Registered with PluginRegistry under namespace "variable-transform", kind "format".
 *
 * Text syntax: |format('MMM d, yyyy')  |format('#,##0.00')  |format('$#,##0')
 *
 * Dispatch rules (evaluated in order):
 *   1. Value is a Date, or a string that parses as an ISO date, AND pattern
 *      looks like a date format (contains 'd', 'M', or 'y') → Intl.DateTimeFormat
 *   2. Value is a number AND pattern starts with '$', '£', or '€'           → Intl.NumberFormat currency
 *   3. Value is a number AND pattern looks like a number format ('#', '0', ',') → Intl.NumberFormat decimal
 *   4. Otherwise → String(value)
 *
 * apply() never throws — returns String(value) on any error.
 */

import type { VariableTransformProvider, ArgSpec } from './transform-provider.interface.js';

const DATE_FORMAT_CHARS = /[dMy]/;
const NUMBER_FORMAT_CHARS = /[#0,]/;
const CURRENCY_PREFIX = /^[$£€]/;

const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  '$': 'USD',
  '£': 'GBP',
  '€': 'EUR',
};

/**
 * Attempt to parse a value as a Date.
 * Returns a Date when the value is already a Date or a string that parses
 * to a valid date. Returns null for all other values.
 */
function tryParseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Derive Intl.DateTimeFormatOptions from a simple date format pattern.
 *
 * Supported tokens (subset — enough for common UI dates):
 *   yyyy / yy  → year: 'numeric' / '2-digit'
 *   MMMM       → month: 'long'
 *   MMM        → month: 'short'
 *   MM / M     → month: '2-digit' / 'numeric'
 *   dd / d     → day: '2-digit' / 'numeric'
 *   HH / H     → hour: '2-digit' / 'numeric' (24-hour)
 *   hh / h     → hour: '2-digit' / 'numeric' (12-hour)
 *   mm / m     → minute: '2-digit' / 'numeric'
 *   ss / s     → second: '2-digit' / 'numeric'
 */
function dateFormatOptions(pattern: string): Intl.DateTimeFormatOptions {
  const opts: Intl.DateTimeFormatOptions = {};

  if (/yyyy/.test(pattern)) opts.year = 'numeric';
  else if (/yy/.test(pattern)) opts.year = '2-digit';

  if (/MMMM/.test(pattern)) opts.month = 'long';
  else if (/MMM/.test(pattern)) opts.month = 'short';
  else if (/MM/.test(pattern)) opts.month = '2-digit';
  else if (/M/.test(pattern)) opts.month = 'numeric';

  if (/dd/.test(pattern)) opts.day = '2-digit';
  else if (/d/.test(pattern)) opts.day = 'numeric';

  if (/HH/.test(pattern)) { opts.hour = '2-digit'; opts.hour12 = false; }
  else if (/H/.test(pattern)) { opts.hour = 'numeric'; opts.hour12 = false; }
  else if (/hh/.test(pattern)) { opts.hour = '2-digit'; opts.hour12 = true; }
  else if (/h/.test(pattern)) { opts.hour = 'numeric'; opts.hour12 = true; }

  if (/mm/.test(pattern) || /m/.test(pattern)) opts.minute = '2-digit';
  if (/ss/.test(pattern) || /s/.test(pattern)) opts.second = '2-digit';

  return opts;
}

/**
 * Derive Intl.NumberFormatOptions from a number format pattern.
 * Reads fraction digits from the pattern (digits after the decimal point).
 */
function numberFormatOptions(pattern: string): Intl.NumberFormatOptions {
  const dotIdx = pattern.indexOf('.');
  if (dotIdx === -1) {
    return { minimumFractionDigits: 0, maximumFractionDigits: 0 };
  }
  const fractional = pattern.slice(dotIdx + 1).replace(/[^#0]/g, '');
  const digits = fractional.length;
  return { minimumFractionDigits: digits, maximumFractionDigits: digits };
}

function applyFormat(value: unknown, pattern: string): unknown {
  // ---- Date formatting ----
  if (DATE_FORMAT_CHARS.test(pattern)) {
    const d = tryParseDate(value);
    if (d !== null) {
      try {
        const opts = dateFormatOptions(pattern);
        return new Intl.DateTimeFormat(undefined, opts).format(d);
      } catch {
        return String(value);
      }
    }
  }

  // ---- Number formatting ----
  if (typeof value === 'number' || (typeof value === 'string' && !Number.isNaN(Number(value)))) {
    const num = typeof value === 'number' ? value : Number(value);

    // Currency
    if (CURRENCY_PREFIX.test(pattern)) {
      const symbol = pattern[0];
      const currency = CURRENCY_SYMBOL_MAP[symbol] ?? 'USD';
      try {
        return new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency,
          ...numberFormatOptions(pattern.slice(1)),
        }).format(num);
      } catch {
        return String(value);
      }
    }

    // Decimal / grouped number
    if (NUMBER_FORMAT_CHARS.test(pattern)) {
      try {
        const useGrouping = pattern.includes(',');
        return new Intl.NumberFormat(undefined, {
          useGrouping,
          ...numberFormatOptions(pattern),
        }).format(num);
      } catch {
        return String(value);
      }
    }
  }

  return String(value);
}

const argSpec: ArgSpec[] = [
  { name: 'pattern', type: 'string', required: true },
];

export const formatProvider: VariableTransformProvider = {
  kind: 'format',
  argSpec,
  apply(value: unknown, args: Record<string, string>): unknown {
    const pattern = args.pattern;
    if (!pattern) return String(value);
    try {
      return applyFormat(value, pattern);
    } catch {
      return String(value);
    }
  },
};

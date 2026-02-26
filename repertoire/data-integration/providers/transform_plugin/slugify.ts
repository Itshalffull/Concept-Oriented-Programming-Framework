// Transform Plugin Provider: slugify
// Generate URL-safe slug from input string with Unicode transliteration.
// See Architecture doc for transform plugin interface contract.

export const PROVIDER_ID = 'slugify';
export const PLUGIN_TYPE = 'transform_plugin';

export interface TransformConfig {
  options?: Record<string, unknown>;
}

export interface TypeSpec {
  type: string;
  nullable?: boolean;
}

// Basic Unicode to ASCII transliteration map
const TRANSLITERATIONS: Record<string, string> = {
  'a': 'a', 'e': 'e', 'i': 'i', 'o': 'o', 'u': 'u',
  'n': 'n', 'c': 'c', 'ss': 'ss',
  '\u00e0': 'a', '\u00e1': 'a', '\u00e2': 'a', '\u00e3': 'a', '\u00e4': 'ae', '\u00e5': 'a',
  '\u00e6': 'ae', '\u00e7': 'c', '\u00e8': 'e', '\u00e9': 'e', '\u00ea': 'e', '\u00eb': 'e',
  '\u00ec': 'i', '\u00ed': 'i', '\u00ee': 'i', '\u00ef': 'i', '\u00f0': 'd', '\u00f1': 'n',
  '\u00f2': 'o', '\u00f3': 'o', '\u00f4': 'o', '\u00f5': 'o', '\u00f6': 'oe', '\u00f8': 'o',
  '\u00f9': 'u', '\u00fa': 'u', '\u00fb': 'u', '\u00fc': 'ue', '\u00fd': 'y', '\u00ff': 'y',
  '\u00df': 'ss', '\u0142': 'l', '\u017e': 'z', '\u0161': 's', '\u010d': 'c', '\u0159': 'r',
  '\u017c': 'z', '\u0105': 'a', '\u0119': 'e', '\u0144': 'n', '\u015b': 's', '\u0107': 'c',
  '\u00c0': 'a', '\u00c1': 'a', '\u00c2': 'a', '\u00c3': 'a', '\u00c4': 'ae', '\u00c5': 'a',
  '\u00c6': 'ae', '\u00c7': 'c', '\u00c8': 'e', '\u00c9': 'e', '\u00ca': 'e', '\u00cb': 'e',
  '\u00cc': 'i', '\u00cd': 'i', '\u00ce': 'i', '\u00cf': 'i', '\u00d1': 'n', '\u00d2': 'o',
  '\u00d3': 'o', '\u00d4': 'o', '\u00d5': 'o', '\u00d6': 'oe', '\u00d8': 'o', '\u00d9': 'u',
  '\u00da': 'u', '\u00db': 'u', '\u00dc': 'ue', '\u00dd': 'y',
};

export class SlugifyTransformProvider {
  transform(value: unknown, config: TransformConfig): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    const separator = (config.options?.separator as string) ?? '-';
    const maxLength = config.options?.maxLength as number | undefined;

    let str = String(value);

    // Lowercase
    str = str.toLowerCase();

    // Transliterate Unicode characters
    let transliterated = '';
    for (const char of str) {
      transliterated += TRANSLITERATIONS[char] ?? char;
    }
    str = transliterated;

    // Replace spaces, underscores, and non-alphanumeric chars with separator
    str = str.replace(/[^a-z0-9]+/g, separator);

    // Collapse consecutive separators
    const escapedSep = separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    str = str.replace(new RegExp(`${escapedSep}{2,}`, 'g'), separator);

    // Trim separator from start and end
    str = str.replace(new RegExp(`^${escapedSep}|${escapedSep}$`, 'g'), '');

    // Apply max length if configured
    if (maxLength && maxLength > 0 && str.length > maxLength) {
      str = str.substring(0, maxLength);
      // Clean up trailing separator after truncation
      str = str.replace(new RegExp(`${escapedSep}$`, 'g'), '');
    }

    return str;
  }

  inputType(): TypeSpec {
    return { type: 'string', nullable: true };
  }

  outputType(): TypeSpec {
    return { type: 'string', nullable: true };
  }
}

export default SlugifyTransformProvider;

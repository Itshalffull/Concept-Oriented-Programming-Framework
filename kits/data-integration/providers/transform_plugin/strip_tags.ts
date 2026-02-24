// Transform Plugin Provider: strip_tags
// Remove HTML tags with optional allowlist and entity decoding.
// See Architecture doc for transform plugin interface contract.

export const PROVIDER_ID = 'strip_tags';
export const PLUGIN_TYPE = 'transform_plugin';

export interface TransformConfig {
  options?: Record<string, unknown>;
}

export interface TypeSpec {
  type: string;
  nullable?: boolean;
}

export class StripTagsTransformProvider {
  transform(value: unknown, config: TransformConfig): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    let html = String(value);
    const allowedTags = (config.options?.allowedTags as string[]) ?? [];
    const decodeEntities = config.options?.decodeEntities !== false;
    const preserveWhitespace = config.options?.preserveWhitespace !== false;

    // Insert whitespace for block-level elements before removing
    if (preserveWhitespace) {
      const blockTags = [
        'p', 'div', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
        'blockquote', 'pre', 'section', 'article', 'header', 'footer',
      ];
      for (const tag of blockTags) {
        const openRe = new RegExp(`<${tag}[^>]*>`, 'gi');
        const closeRe = new RegExp(`</${tag}>`, 'gi');
        if (!allowedTags.includes(tag)) {
          html = html.replace(openRe, ' ');
          html = html.replace(closeRe, ' ');
        }
      }
      // <br> to newline
      if (!allowedTags.includes('br')) {
        html = html.replace(/<br\s*\/?>/gi, '\n');
      }
    }

    // Remove tags not in the allowlist
    if (allowedTags.length > 0) {
      // Build regex to match tags NOT in the allowlist
      const allowSet = new Set(allowedTags.map(t => t.toLowerCase()));
      html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g, (match, tagName: string) => {
        if (allowSet.has(tagName.toLowerCase())) {
          return match;
        }
        return '';
      });
    } else {
      // Remove all tags
      html = html.replace(/<[^>]+>/g, '');
    }

    // Remove HTML comments
    html = html.replace(/<!--[\s\S]*?-->/g, '');

    // Decode HTML entities
    if (decodeEntities) {
      html = this.decodeHtmlEntities(html);
    }

    // Normalize whitespace
    html = html.replace(/[ \t]+/g, ' ');
    html = html.replace(/\n\s*\n/g, '\n');

    return html.trim();
  }

  private decodeHtmlEntities(text: string): string {
    const namedEntities: Record<string, string> = {
      '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
      '&#39;': "'", '&apos;': "'", '&nbsp;': ' ', '&mdash;': '\u2014',
      '&ndash;': '\u2013', '&hellip;': '\u2026', '&laquo;': '\u00AB',
      '&raquo;': '\u00BB', '&bull;': '\u2022', '&middot;': '\u00B7',
      '&copy;': '\u00A9', '&reg;': '\u00AE', '&trade;': '\u2122',
      '&times;': '\u00D7', '&divide;': '\u00F7', '&euro;': '\u20AC',
      '&pound;': '\u00A3', '&yen;': '\u00A5', '&cent;': '\u00A2',
    };

    let result = text;
    for (const [entity, char] of Object.entries(namedEntities)) {
      result = result.split(entity).join(char);
    }

    // Decimal numeric entities
    result = result.replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(parseInt(code, 10)));
    // Hex numeric entities
    result = result.replace(/&#x([0-9a-fA-F]+);/g, (_m, code) => String.fromCharCode(parseInt(code, 16)));

    return result;
  }

  inputType(): TypeSpec {
    return { type: 'string', nullable: true };
  }

  outputType(): TypeSpec {
    return { type: 'string', nullable: true };
  }
}

export default StripTagsTransformProvider;

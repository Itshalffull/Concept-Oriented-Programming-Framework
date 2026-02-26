// Code block detector — detects fenced code blocks, indented blocks, and inline code
// Classifies language by keyword analysis

export const PROVIDER_ID = 'code_detector';
export const PLUGIN_TYPE = 'structure_detector';

export interface DetectorConfig {
  options?: Record<string, unknown>;
  confidenceThreshold?: number;
}

export interface Detection {
  field: string;
  value: unknown;
  type: string;
  confidence: number;
  evidence: string;
}

interface LanguageSignature {
  language: string;
  keywords: string[];
  patterns: RegExp[];
}

const LANGUAGE_SIGNATURES: LanguageSignature[] = [
  {
    language: 'javascript',
    keywords: ['const', 'let', 'var', 'function', 'require', 'module.exports', '=>', 'async', 'await'],
    patterns: [/\bconst\s+\w+\s*=/, /\bfunction\s+\w+\s*\(/, /\bmodule\.exports\b/, /\bconsole\.log\b/],
  },
  {
    language: 'typescript',
    keywords: ['interface', 'type', 'enum', 'namespace', 'as', 'implements', 'readonly'],
    patterns: [/:\s*(string|number|boolean|void|any)\b/, /\binterface\s+\w+/, /\btype\s+\w+\s*=/, /<\w+>/],
  },
  {
    language: 'python',
    keywords: ['def', 'import', 'from', 'class', 'self', 'elif', 'except', 'lambda', 'yield', 'with'],
    patterns: [/\bdef\s+\w+\s*\(/, /\bimport\s+\w+/, /\bfrom\s+\w+\s+import/, /:\s*$/, /\bself\.\w+/],
  },
  {
    language: 'rust',
    keywords: ['fn', 'let', 'mut', 'impl', 'struct', 'enum', 'pub', 'use', 'mod', 'match', 'trait'],
    patterns: [/\bfn\s+\w+/, /\blet\s+mut\s/, /\bimpl\s+\w+/, /\bpub\s+(fn|struct|enum|mod)\b/, /->/, /\bResult</, /\bOption</],
  },
  {
    language: 'go',
    keywords: ['func', 'package', 'import', 'go', 'chan', 'defer', 'goroutine', 'select'],
    patterns: [/\bfunc\s+\w+/, /\bpackage\s+\w+/, /\bgo\s+\w+/, /\bdefer\s+/, /:=\s*/],
  },
  {
    language: 'swift',
    keywords: ['func', 'var', 'let', 'guard', 'protocol', 'extension', 'struct', 'class', 'enum'],
    patterns: [/\bfunc\s+\w+/, /\bguard\s+let/, /\bprotocol\s+\w+/, /\bextension\s+\w+/],
  },
  {
    language: 'java',
    keywords: ['public', 'private', 'protected', 'class', 'interface', 'extends', 'implements', 'throws'],
    patterns: [/\bpublic\s+class\s+\w+/, /\bprivate\s+\w+\s+\w+/, /\bSystem\.out\./],
  },
  {
    language: 'html',
    keywords: ['<html', '<div', '<span', '<body', '<head', '<!DOCTYPE'],
    patterns: [/<\/?[a-z]+[^>]*>/i, /<!DOCTYPE\s+html/i],
  },
  {
    language: 'css',
    keywords: ['color:', 'background:', 'margin:', 'padding:', 'display:', 'font-size:'],
    patterns: [/\{[\s\S]*?[a-z-]+\s*:/, /@media\s/, /\.[a-z][\w-]*\s*\{/],
  },
  {
    language: 'sql',
    keywords: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'JOIN'],
    patterns: [/\bSELECT\s+.+\s+FROM\b/i, /\bCREATE\s+TABLE\b/i, /\bINSERT\s+INTO\b/i],
  },
];

function classifyLanguage(code: string): { language: string; confidence: number } {
  let bestLang = 'unknown';
  let bestScore = 0;

  for (const sig of LANGUAGE_SIGNATURES) {
    let score = 0;
    for (const keyword of sig.keywords) {
      if (code.includes(keyword)) score += 1;
    }
    for (const pattern of sig.patterns) {
      if (pattern.test(code)) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestLang = sig.language;
    }
  }

  const confidence = bestScore >= 6 ? 0.90 : bestScore >= 3 ? 0.75 : bestScore >= 1 ? 0.55 : 0.30;
  return { language: bestLang, confidence };
}

export class CodeDetectorProvider {
  detect(
    content: unknown,
    existingStructure: Record<string, unknown>,
    config: DetectorConfig
  ): Detection[] {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const threshold = config.confidenceThreshold ?? 0.5;
    const detections: Detection[] = [];

    // Fenced code blocks: ```lang ... ```
    const fencedRegex = /```(\w*)\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = fencedRegex.exec(text)) !== null) {
      const declaredLang = match[1].toLowerCase() || undefined;
      const codeContent = match[2].trim();
      if (codeContent.length === 0) continue;

      const classified = classifyLanguage(codeContent);
      const language = declaredLang ?? classified.language;
      const confidence = declaredLang ? 0.98 : classified.confidence;
      if (confidence < threshold) continue;

      detections.push({
        field: 'code',
        value: { language, content: codeContent, format: 'fenced' },
        type: 'code_block',
        confidence,
        evidence: `Fenced code block (${language}, ${codeContent.split('\n').length} lines)`,
      });
    }

    // Indented code blocks: 4+ spaces at line start, consecutive lines
    const lines = text.split(/\r?\n/);
    let indentedBlock: string[] = [];
    let indentStart = -1;

    const flushIndented = (): void => {
      if (indentedBlock.length >= 2) {
        const code = indentedBlock.join('\n');
        const classified = classifyLanguage(code);
        const confidence = Math.min(classified.confidence, 0.80);
        if (confidence >= threshold) {
          detections.push({
            field: 'code',
            value: { language: classified.language, content: code, format: 'indented' },
            type: 'code_block',
            confidence,
            evidence: `Indented code block (${classified.language}, ${indentedBlock.length} lines)`,
          });
        }
      }
      indentedBlock = [];
      indentStart = -1;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^ {4,}[^ ]/.test(line) || /^\t[^\t]/.test(line)) {
        if (indentStart === -1) indentStart = i;
        indentedBlock.push(line.replace(/^ {4}/, '').replace(/^\t/, ''));
      } else if (line.trim() === '' && indentedBlock.length > 0) {
        indentedBlock.push('');
      } else {
        flushIndented();
      }
    }
    flushIndented();

    // Inline code: `code here`
    const inlineRegex = /(?<!`)`([^`\n]+)`(?!`)/g;
    let inlineCount = 0;
    while ((match = inlineRegex.exec(text)) !== null) {
      if (inlineCount >= 20) break; // cap inline code detections
      const code = match[1].trim();
      if (code.length < 2 || code.length > 200) continue;
      inlineCount++;

      const confidence = code.includes('(') || code.includes('.') || code.includes('=') ? 0.80 : 0.65;
      if (confidence < threshold) continue;

      detections.push({
        field: 'code',
        value: { language: 'inline', content: code, format: 'inline' },
        type: 'code_inline',
        confidence,
        evidence: `Inline code: \`${code.slice(0, 50)}\``,
      });
    }

    return detections;
  }

  appliesTo(contentType: string): boolean {
    return ['text/plain', 'text/html', 'text/markdown'].includes(contentType);
  }
}

export default CodeDetectorProvider;

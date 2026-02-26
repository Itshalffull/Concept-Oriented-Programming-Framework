// COPF Data Integration Kit - Language detection enricher provider
// Uses character n-gram frequency profiles compared against language profiles.

export const PROVIDER_ID = 'language_detect';
export const PLUGIN_TYPE = 'enricher_plugin';

export interface ContentItem {
  id: string;
  content: string;
  contentType: string;
  metadata?: Record<string, unknown>;
}

export interface EnricherConfig {
  model?: string;
  apiKey?: string;
  threshold?: number;
  options?: Record<string, unknown>;
}

export interface EnrichmentResult {
  fields: Record<string, unknown>;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface SchemaRef {
  name: string;
  fields?: string[];
}

export interface CostEstimate {
  tokens?: number;
  apiCalls?: number;
  durationMs?: number;
}

// Language profiles: top character trigrams for each language
// These are derived from corpus analysis of common languages
const LANGUAGE_PROFILES: Record<string, { trigrams: string[]; script: string }> = {
  en: {
    script: 'Latin',
    trigrams: [
      'the', 'and', 'ing', 'tion', 'her', 'hat', 'tha', 'ere', 'for', 'ent',
      'ion', 'ter', 'was', 'you', 'ith', 'ver', 'all', 'wit', 'thi', 'ate',
      'his', 'ght', 'rig', 'are', 'not', 'ons', 'ess', 'com', 'pro', 'hou',
    ],
  },
  es: {
    script: 'Latin',
    trigrams: [
      'que', 'ión', 'ent', 'aci', 'ado', 'est', 'las', 'los', 'con', 'del',
      'par', 'res', 'nte', 'era', 'cia', 'com', 'una', 'ara', 'ien', 'sta',
      'mos', 'tos', 'ido', 'tra', 'tad', 'nes', 'ues', 'des', 'ero', 'ici',
    ],
  },
  fr: {
    script: 'Latin',
    trigrams: [
      'les', 'ent', 'ion', 'que', 'des', 'ait', 'est', 'ous', 'ire', 'tio',
      'ans', 'par', 'con', 'ons', 'our', 'com', 'men', 'pas', 'eur', 'dan',
      'ais', 'une', 'ell', 'ien', 'eme', 'uit', 'ait', 'ant', 'nte', 'ter',
    ],
  },
  de: {
    script: 'Latin',
    trigrams: [
      'ein', 'ich', 'der', 'die', 'und', 'den', 'sch', 'ung', 'che', 'ine',
      'gen', 'ver', 'ber', 'ten', 'ter', 'hen', 'eit', 'auf', 'ent', 'ges',
      'ach', 'lic', 'ier', 'ste', 'ren', 'nde', 'ers', 'ige', 'erd', 'ann',
    ],
  },
  pt: {
    script: 'Latin',
    trigrams: [
      'que', 'ção', 'ent', 'ade', 'est', 'nte', 'com', 'par', 'res', 'ção',
      'ido', 'ais', 'dos', 'mos', 'uma', 'men', 'sta', 'tos', 'tra', 'era',
      'ado', 'ica', 'oss', 'con', 'por', 'ria', 'ões', 'ame', 'ura', 'ais',
    ],
  },
  it: {
    script: 'Latin',
    trigrams: [
      'che', 'ell', 'ion', 'ent', 'con', 'per', 'ato', 'zia', 'tti', 'nte',
      'eri', 'sta', 'del', 'ita', 'are', 'ment', 'gli', 'tto', 'ess', 'ano',
      'ato', 'lia', 'ali', 'ame', 'oni', 'com', 'ino', 'ore', 'ona', 'est',
    ],
  },
  ja: {
    script: 'CJK',
    trigrams: [
      'の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し',
      'れ', 'さ', 'ある', 'する', 'から', 'った', 'もの', 'この', 'ない', 'され',
    ],
  },
  zh: {
    script: 'CJK',
    trigrams: [
      '的', '了', '在', '是', '我', '不', '人', '有', '这', '他',
      '上', '们', '来', '到', '大', '地', '为', '子', '中', '你',
    ],
  },
  ko: {
    script: 'Hangul',
    trigrams: [
      '이', '의', '는', '을', '에', '가', '한', '하', '다', '는',
      '로', '를', '그', '것', '서', '고', '으로', '에서', '와', '도',
    ],
  },
  ar: {
    script: 'Arabic',
    trigrams: [
      'ال', 'في', 'من', 'على', 'ان', 'ما', 'هذ', 'كا', 'وا', 'لا',
      'ية', 'عل', 'ها', 'ين', 'ات', 'لم', 'بال', 'قد', 'بين', 'عن',
    ],
  },
  ru: {
    script: 'Cyrillic',
    trigrams: [
      'ого', 'ени', 'ста', 'ать', 'ние', 'про', 'что', 'ест', 'ова', 'ных',
      'ком', 'нов', 'ого', 'ска', 'ные', 'ель', 'раз', 'все', 'при', 'пер',
    ],
  },
  hi: {
    script: 'Devanagari',
    trigrams: [
      'का', 'के', 'में', 'है', 'की', 'को', 'से', 'और', 'पर', 'ने',
      'एक', 'यह', 'कि', 'नह', 'भी', 'इस', 'था', 'जा', 'रहा', 'हो',
    ],
  },
};

function extractNgrams(text: string, n: number): Map<string, number> {
  const ngrams = new Map<string, number>();
  const cleaned = text.toLowerCase().replace(/\s+/g, ' ').trim();

  for (let i = 0; i <= cleaned.length - n; i++) {
    const ngram = cleaned.substring(i, i + n);
    if (ngram.trim().length > 0) {
      ngrams.set(ngram, (ngrams.get(ngram) ?? 0) + 1);
    }
  }

  // Normalize frequencies
  const total = Array.from(ngrams.values()).reduce((sum, v) => sum + v, 0);
  if (total > 0) {
    for (const [key, val] of ngrams) {
      ngrams.set(key, val / total);
    }
  }

  return ngrams;
}

function detectScript(text: string): string {
  const ranges: [RegExp, string][] = [
    [/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, 'CJK'],
    [/[\uAC00-\uD7AF]/g, 'Hangul'],
    [/[\u0600-\u06FF]/g, 'Arabic'],
    [/[\u0400-\u04FF]/g, 'Cyrillic'],
    [/[\u0900-\u097F]/g, 'Devanagari'],
    [/[\u0041-\u007A\u00C0-\u024F]/g, 'Latin'],
  ];

  let maxCount = 0;
  let detectedScript = 'Latin';

  for (const [regex, script] of ranges) {
    const matches = text.match(regex);
    const count = matches ? matches.length : 0;
    if (count > maxCount) {
      maxCount = count;
      detectedScript = script;
    }
  }

  return detectedScript;
}

function computeProfileDistance(textNgrams: Map<string, number>, profileTrigrams: string[]): number {
  let score = 0;
  const profileSet = new Set(profileTrigrams);

  // Count how many of the profile's top trigrams appear in the text
  for (const trigram of profileTrigrams) {
    if (textNgrams.has(trigram)) {
      score += textNgrams.get(trigram)! * profileTrigrams.length;
    }
  }

  // Also measure what fraction of the text's top ngrams are in the profile
  const sorted = Array.from(textNgrams.entries()).sort((a, b) => b[1] - a[1]).slice(0, 50);
  for (const [ngram] of sorted) {
    if (profileSet.has(ngram)) {
      score += 1;
    }
  }

  return score;
}

export class LanguageDetectEnricherProvider {
  async enrich(item: ContentItem, config: EnricherConfig): Promise<EnrichmentResult> {
    const candidateLanguages = (config.options?.candidateLanguages as string[]) ?? Object.keys(LANGUAGE_PROFILES);
    const text = item.content;

    if (text.trim().length < 10) {
      return {
        fields: { language: 'und', confidence: 0, script: 'Unknown' },
        confidence: 0,
        metadata: { provider: PROVIDER_ID, reason: 'Text too short' },
      };
    }

    // Detect script to narrow candidates
    const script = detectScript(text);

    // Build character n-gram profiles for the text (trigrams)
    const textTrigrams = extractNgrams(text, 3);
    const textBigrams = extractNgrams(text, 2);

    // Score each candidate language
    const scores: Array<{ lang: string; score: number; script: string }> = [];

    for (const lang of candidateLanguages) {
      const profile = LANGUAGE_PROFILES[lang];
      if (!profile) continue;

      // Script mismatch dramatically reduces score
      const scriptMatch = profile.script === script;
      if (!scriptMatch && script !== 'Latin') continue;

      const trigramScore = computeProfileDistance(textTrigrams, profile.trigrams);
      const bigramTrigrams = profile.trigrams.filter((t) => t.length === 2);
      const bigramScore = computeProfileDistance(textBigrams, bigramTrigrams);

      let totalScore = trigramScore + bigramScore * 0.5;
      if (!scriptMatch) totalScore *= 0.1;

      scores.push({ lang, score: totalScore, script: profile.script });
    }

    scores.sort((a, b) => b.score - a.score);

    const bestMatch = scores[0] ?? { lang: 'und', score: 0, script: 'Unknown' };
    const secondMatch = scores[1];

    // Confidence is based on margin between top two candidates
    let confidence = 0;
    if (bestMatch.score > 0) {
      const margin = secondMatch ? (bestMatch.score - secondMatch.score) / bestMatch.score : 1;
      confidence = Math.min(0.99, 0.5 + margin * 0.5);
      // Scale up with text length (longer = more confident)
      confidence = Math.min(0.99, confidence * Math.min(1.0, text.length / 200));
    }

    // Build runner-up list
    const alternatives = scores.slice(1, 4).map((s) => ({
      language: s.lang,
      confidence: Math.round((s.score / Math.max(bestMatch.score, 1)) * 1000) / 1000,
    }));

    return {
      fields: {
        language: bestMatch.lang,
        confidence: Math.round(confidence * 1000) / 1000,
        script,
        alternatives,
      },
      confidence,
      metadata: {
        provider: PROVIDER_ID,
        candidateCount: candidateLanguages.length,
        textLength: text.length,
        method: 'ngram_frequency',
      },
    };
  }

  appliesTo(schema: SchemaRef): boolean {
    // Language detection applies to any text content
    const applicable = ['text', 'article', 'document', 'content', 'post', 'message', 'page'];
    return applicable.some((s) => schema.name.toLowerCase().includes(s));
  }

  costEstimate(item: ContentItem): CostEstimate {
    const charCount = item.content.length;
    return { durationMs: Math.max(5, Math.ceil(charCount / 5000)), apiCalls: 0 };
  }
}

export default LanguageDetectEnricherProvider;

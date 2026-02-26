// COPF Data Integration Kit - Auto-summarization enricher provider
// Implements extractive summarization (TF-IDF sentence scoring) with optional LLM abstractive mode.

import * as https from 'https';

export const PROVIDER_ID = 'auto_summarize';
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

type SummaryMode = 'extractive' | 'abstractive';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
  'might', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'and', 'but', 'or', 'not', 'this', 'that', 'it', 'its', 'i', 'me', 'my',
  'we', 'our', 'you', 'your', 'he', 'him', 'she', 'her', 'they', 'them',
]);

function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation, keeping the delimiter
  const raw = text.split(/(?<=[.!?])\s+/);
  return raw
    .map((s) => s.trim())
    .filter((s) => s.length > 10 && s.split(/\s+/).length >= 3);
}

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function computeTfIdf(sentences: string[]): Map<string, number> {
  // Term frequency across all sentences
  const df = new Map<string, number>();
  const sentenceTokenSets = sentences.map((s) => new Set(tokenize(s)));

  for (const tokenSet of sentenceTokenSets) {
    for (const token of tokenSet) {
      df.set(token, (df.get(token) ?? 0) + 1);
    }
  }

  // IDF: log(N / df)
  const n = sentences.length;
  const idf = new Map<string, number>();
  for (const [term, count] of df) {
    idf.set(term, Math.log((n + 1) / (count + 1)) + 1);
  }

  return idf;
}

function scoreSentence(
  sentence: string,
  index: number,
  totalSentences: number,
  idf: Map<string, number>,
  titleTokens: Set<string>,
): number {
  const tokens = tokenize(sentence);
  if (tokens.length === 0) return 0;

  // TF-IDF score: sum of IDF values for sentence tokens
  let tfidfScore = 0;
  const tokenCounts = new Map<string, number>();
  for (const t of tokens) {
    tokenCounts.set(t, (tokenCounts.get(t) ?? 0) + 1);
  }
  for (const [token, count] of tokenCounts) {
    const tf = count / tokens.length;
    const idfVal = idf.get(token) ?? 1;
    tfidfScore += tf * idfVal;
  }

  // Position score: first and last paragraphs weight more
  let positionScore = 0;
  const relativePos = index / Math.max(totalSentences - 1, 1);
  if (relativePos < 0.15) positionScore = 3.0;       // Opening sentences
  else if (relativePos < 0.3) positionScore = 1.5;
  else if (relativePos > 0.85) positionScore = 2.0;   // Closing sentences
  else positionScore = 0.5;

  // Length score: prefer medium-length sentences (8-30 words)
  const wordCount = sentence.split(/\s+/).length;
  let lengthScore = 0;
  if (wordCount >= 8 && wordCount <= 30) lengthScore = 2.0;
  else if (wordCount >= 5 && wordCount <= 40) lengthScore = 1.0;
  else lengthScore = 0.3;

  // Key phrase score: sentences with title words get a boost
  let titleOverlap = 0;
  for (const token of tokens) {
    if (titleTokens.has(token)) titleOverlap++;
  }
  const keyPhraseScore = titleTokens.size > 0
    ? (titleOverlap / titleTokens.size) * 3.0
    : 0;

  // Cue phrase bonus
  const cuePhrases = ['important', 'significant', 'key', 'result', 'conclusion', 'summary', 'therefore', 'consequently'];
  const cueScore = cuePhrases.some((p) => sentence.toLowerCase().includes(p)) ? 1.5 : 0;

  return tfidfScore + positionScore + lengthScore + keyPhraseScore + cueScore;
}

function extractiveSummarize(
  text: string,
  sentenceCounts: { short: number; medium: number; long: number },
): { short: string; medium: string; long: string } {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return { short: '', medium: '', long: '' };

  const idf = computeTfIdf(sentences);

  // Use first sentence tokens as proxy for title/topic
  const titleTokens = new Set(tokenize(sentences[0]));

  const scored = sentences.map((sentence, idx) => ({
    sentence,
    originalIndex: idx,
    score: scoreSentence(sentence, idx, sentences.length, idf, titleTokens),
  }));

  // Sort by score descending
  const ranked = [...scored].sort((a, b) => b.score - a.score);

  const pickTopN = (n: number): string => {
    const topN = ranked.slice(0, Math.min(n, ranked.length));
    // Restore original order for readability
    topN.sort((a, b) => a.originalIndex - b.originalIndex);
    return topN.map((s) => s.sentence).join(' ');
  };

  return {
    short: pickTopN(sentenceCounts.short),
    medium: pickTopN(sentenceCounts.medium),
    long: pickTopN(sentenceCounts.long),
  };
}

async function abstractiveSummarize(
  text: string,
  model: string,
  apiKey: string,
): Promise<{ short: string; medium: string; long: string }> {
  const prompt = `Summarize the following text at three different lengths:
1. SHORT (1-2 sentences)
2. MEDIUM (3-5 sentences)
3. LONG (1-2 paragraphs)

Respond in JSON: {"short": "...", "medium": "...", "long": "..."}

Text:
${text.slice(0, 8000)}`;

  const body = JSON.stringify({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2000,
  });

  const response = await new Promise<any>((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': String(Buffer.byteLength(body)),
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch { reject(new Error('Failed to parse LLM response')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  const content = response?.choices?.[0]?.message?.content ?? '';
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch { /* fallback */ }

  return { short: content.slice(0, 200), medium: content.slice(0, 600), long: content };
}

export class AutoSummarizeEnricherProvider {
  async enrich(item: ContentItem, config: EnricherConfig): Promise<EnrichmentResult> {
    const mode = (config.options?.mode as SummaryMode) ?? 'extractive';
    const lengths = (config.options?.lengths as { short: number; medium: number; long: number }) ??
      { short: 2, medium: 5, long: 10 };

    let summary: { short: string; medium: string; long: string };

    if (mode === 'abstractive' && config.apiKey) {
      summary = await abstractiveSummarize(
        item.content, config.model ?? 'gpt-4o-mini', config.apiKey,
      );
    } else {
      summary = extractiveSummarize(item.content, lengths);
    }

    const wordCounts = {
      short: summary.short.split(/\s+/).filter(Boolean).length,
      medium: summary.medium.split(/\s+/).filter(Boolean).length,
      long: summary.long.split(/\s+/).filter(Boolean).length,
    };

    const originalWordCount = item.content.split(/\s+/).filter(Boolean).length;
    const compressionRatio = originalWordCount > 0
      ? wordCounts.medium / originalWordCount
      : 1;

    return {
      fields: {
        summary,
        word_counts: wordCounts,
        compression_ratio: Math.round(compressionRatio * 100) / 100,
      },
      confidence: mode === 'abstractive' ? 0.85 : 0.7,
      metadata: {
        provider: PROVIDER_ID,
        mode,
        originalWordCount,
        sentenceCounts: lengths,
      },
    };
  }

  appliesTo(schema: SchemaRef): boolean {
    const textSchemas = ['text', 'article', 'document', 'content', 'post', 'report', 'paper'];
    return textSchemas.some((s) => schema.name.toLowerCase().includes(s));
  }

  costEstimate(item: ContentItem): CostEstimate {
    const wordCount = item.content.split(/\s+/).length;
    // Extractive: purely computational
    const durationMs = Math.max(10, Math.ceil(wordCount / 100));
    return {
      tokens: Math.ceil(wordCount * 1.3),
      durationMs,
      apiCalls: 0,
    };
  }
}

export default AutoSummarizeEnricherProvider;

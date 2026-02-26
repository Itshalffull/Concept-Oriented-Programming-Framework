// COPF Data Integration Kit - Sentiment analysis enricher provider
// Scores text sentiment using lexicon-based approach with valence scores.

export const PROVIDER_ID = 'sentiment';
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

type Granularity = 'document' | 'sentence' | 'aspect';
type SentimentLabel = 'positive' | 'negative' | 'neutral';

interface SentimentScore {
  sentiment: SentimentLabel;
  score: number;
  magnitude: number;
}

// Lexicon-based sentiment dictionary with valence scores (-5 to +5)
const POSITIVE_LEXICON: Record<string, number> = {
  'excellent': 4.5, 'amazing': 4.2, 'wonderful': 4.0, 'fantastic': 4.3,
  'great': 3.5, 'good': 2.5, 'nice': 2.0, 'love': 3.8, 'loved': 3.8,
  'like': 1.5, 'enjoy': 2.5, 'happy': 3.0, 'pleased': 2.8, 'delighted': 3.5,
  'perfect': 4.5, 'beautiful': 3.2, 'brilliant': 4.0, 'outstanding': 4.5,
  'superb': 4.2, 'terrific': 3.8, 'impressive': 3.5, 'remarkable': 3.5,
  'best': 4.0, 'better': 2.0, 'improve': 2.0, 'improved': 2.5,
  'recommend': 3.0, 'recommended': 3.0, 'helpful': 2.5, 'useful': 2.0,
  'efficient': 2.5, 'effective': 2.5, 'reliable': 2.5, 'success': 3.5,
  'successful': 3.5, 'win': 3.0, 'won': 3.0, 'achievement': 3.0,
  'positive': 2.5, 'optimistic': 2.5, 'enthusiastic': 3.0, 'grateful': 3.0,
  'appreciate': 2.5, 'thank': 2.0, 'thanks': 2.0, 'fortunate': 2.5,
};

const NEGATIVE_LEXICON: Record<string, number> = {
  'terrible': -4.5, 'horrible': -4.5, 'awful': -4.2, 'dreadful': -4.0,
  'bad': -2.5, 'poor': -2.5, 'worst': -4.5, 'worse': -3.0,
  'hate': -4.0, 'hated': -4.0, 'dislike': -2.5, 'disgust': -3.5,
  'angry': -3.0, 'furious': -4.0, 'annoyed': -2.5, 'frustrated': -3.0,
  'disappointed': -3.0, 'disappointing': -3.0, 'fail': -3.0, 'failed': -3.0,
  'failure': -3.5, 'problem': -2.0, 'problems': -2.0, 'issue': -1.5,
  'issues': -1.5, 'error': -2.0, 'errors': -2.0, 'bug': -2.0, 'bugs': -2.0,
  'broken': -3.0, 'useless': -3.5, 'waste': -3.0, 'ugly': -2.5,
  'difficult': -1.5, 'hard': -1.0, 'painful': -2.5, 'suffering': -3.0,
  'sad': -2.5, 'unhappy': -2.5, 'unfortunate': -2.0, 'regret': -2.5,
  'worry': -2.0, 'worried': -2.0, 'fear': -2.5, 'afraid': -2.5,
  'negative': -2.5, 'pessimistic': -2.5, 'critical': -1.5, 'crisis': -3.0,
};

// Negation words that flip sentiment
const NEGATION_WORDS = new Set([
  'not', "n't", 'no', 'never', 'neither', 'nor', 'hardly', 'barely',
  'scarcely', 'seldom', 'rarely', 'without', 'lack', 'lacking',
]);

// Intensifiers that amplify sentiment
const INTENSIFIERS: Record<string, number> = {
  'very': 1.5, 'extremely': 2.0, 'incredibly': 2.0, 'absolutely': 2.0,
  'really': 1.3, 'quite': 1.2, 'fairly': 1.1, 'rather': 1.1,
  'somewhat': 0.8, 'slightly': 0.7, 'barely': 0.5, 'almost': 0.8,
  'totally': 1.8, 'completely': 1.8, 'utterly': 2.0, 'truly': 1.5,
};

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
}

function analyzeSentenceValence(sentence: string): SentimentScore {
  const tokens = sentence.toLowerCase().replace(/[^a-z'\s-]/g, ' ').split(/\s+/).filter(Boolean);
  let totalValence = 0;
  let wordCount = 0;
  let isNegated = false;
  let intensifierMultiplier = 1.0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Check for negation
    if (NEGATION_WORDS.has(token) || (token.endsWith("n't"))) {
      isNegated = true;
      continue;
    }

    // Check for intensifiers
    if (INTENSIFIERS[token]) {
      intensifierMultiplier = INTENSIFIERS[token];
      continue;
    }

    // Look up in lexicons
    let valence = 0;
    if (POSITIVE_LEXICON[token] !== undefined) {
      valence = POSITIVE_LEXICON[token];
    } else if (NEGATIVE_LEXICON[token] !== undefined) {
      valence = NEGATIVE_LEXICON[token];
    }

    if (valence !== 0) {
      // Apply negation (flip sign)
      if (isNegated) {
        valence *= -0.75; // Negation doesn't fully reverse (empirically)
        isNegated = false;
      }
      // Apply intensifier
      valence *= intensifierMultiplier;
      intensifierMultiplier = 1.0;

      totalValence += valence;
      wordCount++;
    } else {
      // Reset negation after non-sentiment word
      if (i > 0 && !NEGATION_WORDS.has(tokens[i - 1])) {
        isNegated = false;
      }
      intensifierMultiplier = 1.0;
    }
  }

  // Normalize score to -1.0 to 1.0
  const normalizedScore = wordCount > 0
    ? Math.max(-1, Math.min(1, totalValence / (wordCount * 2.5)))
    : 0;
  const magnitude = Math.abs(totalValence);

  const sentiment: SentimentLabel =
    normalizedScore > 0.05 ? 'positive' :
    normalizedScore < -0.05 ? 'negative' :
    'neutral';

  return { sentiment, score: Math.round(normalizedScore * 1000) / 1000, magnitude };
}

export class SentimentEnricherProvider {
  async enrich(item: ContentItem, config: EnricherConfig): Promise<EnrichmentResult> {
    const granularity = (config.options?.granularity as Granularity) ?? 'document';

    if (granularity === 'sentence') {
      const sentences = splitSentences(item.content);
      const sentenceResults = sentences.map((sentence) => ({
        text: sentence.slice(0, 200),
        ...analyzeSentenceValence(sentence),
      }));

      const avgScore = sentenceResults.length > 0
        ? sentenceResults.reduce((sum, r) => sum + r.score, 0) / sentenceResults.length
        : 0;
      const overallSentiment: SentimentLabel =
        avgScore > 0.05 ? 'positive' : avgScore < -0.05 ? 'negative' : 'neutral';

      return {
        fields: {
          sentiment: overallSentiment,
          score: Math.round(avgScore * 1000) / 1000,
          sentences: sentenceResults,
          sentence_count: sentenceResults.length,
          positive_count: sentenceResults.filter((r) => r.sentiment === 'positive').length,
          negative_count: sentenceResults.filter((r) => r.sentiment === 'negative').length,
          neutral_count: sentenceResults.filter((r) => r.sentiment === 'neutral').length,
        },
        confidence: Math.min(0.95, 0.5 + sentenceResults.length * 0.02),
        metadata: { provider: PROVIDER_ID, granularity, mode: 'lexicon_based' },
      };
    }

    if (granularity === 'aspect') {
      // Extract aspect-level sentiment from noun-adjective pairs
      const aspects = extractAspectSentiments(item.content);
      const avgScore = aspects.length > 0
        ? aspects.reduce((sum, a) => sum + a.score, 0) / aspects.length
        : 0;

      return {
        fields: {
          sentiment: avgScore > 0.05 ? 'positive' : avgScore < -0.05 ? 'negative' : 'neutral',
          score: Math.round(avgScore * 1000) / 1000,
          aspects,
        },
        confidence: Math.min(0.85, 0.4 + aspects.length * 0.05),
        metadata: { provider: PROVIDER_ID, granularity, mode: 'lexicon_based' },
      };
    }

    // Document-level sentiment
    const result = analyzeSentenceValence(item.content);

    return {
      fields: {
        sentiment: result.sentiment,
        score: result.score,
        magnitude: result.magnitude,
      },
      confidence: Math.min(0.9, 0.5 + Math.abs(result.score) * 0.4),
      metadata: { provider: PROVIDER_ID, granularity, mode: 'lexicon_based' },
    };
  }

  appliesTo(schema: SchemaRef): boolean {
    const applicable = ['text', 'review', 'comment', 'feedback', 'post', 'message', 'tweet'];
    return applicable.some((s) => schema.name.toLowerCase().includes(s));
  }

  costEstimate(item: ContentItem): CostEstimate {
    const wordCount = item.content.split(/\s+/).length;
    return { durationMs: Math.max(5, Math.ceil(wordCount / 500)), apiCalls: 0 };
  }
}

function extractAspectSentiments(text: string): Array<{
  aspect: string; sentiment: SentimentLabel; score: number;
}> {
  const aspects: Array<{ aspect: string; sentiment: SentimentLabel; score: number }> = [];
  const sentences = splitSentences(text);

  // Simple aspect extraction: look for adjective-noun patterns near sentiment words
  const allLexicon = { ...POSITIVE_LEXICON, ...NEGATIVE_LEXICON };

  for (const sentence of sentences) {
    const tokens = sentence.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);

    for (let i = 0; i < tokens.length; i++) {
      if (allLexicon[tokens[i]] !== undefined) {
        // Look for nearby nouns (heuristic: next/prev non-sentiment word of 4+ chars)
        for (let j = Math.max(0, i - 3); j <= Math.min(tokens.length - 1, i + 3); j++) {
          if (j !== i && tokens[j].length >= 4 && !allLexicon[tokens[j]] && !NEGATION_WORDS.has(tokens[j])) {
            const valence = allLexicon[tokens[i]];
            const normalized = Math.max(-1, Math.min(1, valence / 5));
            aspects.push({
              aspect: tokens[j],
              sentiment: normalized > 0.05 ? 'positive' : normalized < -0.05 ? 'negative' : 'neutral',
              score: Math.round(normalized * 1000) / 1000,
            });
            break;
          }
        }
      }
    }
  }

  // Deduplicate aspects, averaging scores
  const grouped = new Map<string, number[]>();
  for (const a of aspects) {
    if (!grouped.has(a.aspect)) grouped.set(a.aspect, []);
    grouped.get(a.aspect)!.push(a.score);
  }

  return Array.from(grouped.entries()).map(([aspect, scores]) => {
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    return {
      aspect,
      sentiment: avg > 0.05 ? 'positive' as const : avg < -0.05 ? 'negative' as const : 'neutral' as const,
      score: Math.round(avg * 1000) / 1000,
    };
  });
}

export default SentimentEnricherProvider;

// Clef Data Integration Kit - Sentiment analysis enricher provider
// Scores text sentiment using lexicon-based approach with valence scores.

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "sentiment";
pub const PLUGIN_TYPE: &str = "enricher_plugin";

#[derive(Debug, Clone)]
pub struct ContentItem {
    pub id: String,
    pub content: String,
    pub content_type: String,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone)]
pub struct EnricherConfig {
    pub model: Option<String>,
    pub api_key: Option<String>,
    pub threshold: Option<f64>,
    pub options: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone)]
pub struct EnrichmentResult {
    pub fields: HashMap<String, serde_json::Value>,
    pub confidence: f64,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone)]
pub struct SchemaRef {
    pub name: String,
    pub fields: Option<Vec<String>>,
}

#[derive(Debug, Clone)]
pub struct CostEstimate {
    pub tokens: Option<u64>,
    pub api_calls: Option<u64>,
    pub duration_ms: Option<u64>,
}

#[derive(Debug)]
pub enum EnricherError {
    ConfigError(String),
}

fn build_positive_lexicon() -> HashMap<&'static str, f64> {
    let mut lex = HashMap::new();
    let words: &[(&str, f64)] = &[
        ("excellent", 4.5), ("amazing", 4.2), ("wonderful", 4.0), ("fantastic", 4.3),
        ("great", 3.5), ("good", 2.5), ("nice", 2.0), ("love", 3.8), ("loved", 3.8),
        ("like", 1.5), ("enjoy", 2.5), ("happy", 3.0), ("pleased", 2.8), ("delighted", 3.5),
        ("perfect", 4.5), ("beautiful", 3.2), ("brilliant", 4.0), ("outstanding", 4.5),
        ("superb", 4.2), ("terrific", 3.8), ("impressive", 3.5), ("remarkable", 3.5),
        ("best", 4.0), ("better", 2.0), ("improve", 2.0), ("recommend", 3.0),
        ("helpful", 2.5), ("useful", 2.0), ("efficient", 2.5), ("effective", 2.5),
        ("reliable", 2.5), ("success", 3.5), ("successful", 3.5), ("positive", 2.5),
        ("optimistic", 2.5), ("enthusiastic", 3.0), ("grateful", 3.0), ("appreciate", 2.5),
    ];
    for &(word, val) in words { lex.insert(word, val); }
    lex
}

fn build_negative_lexicon() -> HashMap<&'static str, f64> {
    let mut lex = HashMap::new();
    let words: &[(&str, f64)] = &[
        ("terrible", -4.5), ("horrible", -4.5), ("awful", -4.2), ("dreadful", -4.0),
        ("bad", -2.5), ("poor", -2.5), ("worst", -4.5), ("worse", -3.0),
        ("hate", -4.0), ("hated", -4.0), ("dislike", -2.5), ("disgust", -3.5),
        ("angry", -3.0), ("furious", -4.0), ("annoyed", -2.5), ("frustrated", -3.0),
        ("disappointed", -3.0), ("disappointing", -3.0), ("fail", -3.0), ("failed", -3.0),
        ("failure", -3.5), ("problem", -2.0), ("problems", -2.0), ("issue", -1.5),
        ("error", -2.0), ("errors", -2.0), ("broken", -3.0), ("useless", -3.5),
        ("waste", -3.0), ("ugly", -2.5), ("difficult", -1.5), ("painful", -2.5),
        ("sad", -2.5), ("unhappy", -2.5), ("unfortunate", -2.0), ("regret", -2.5),
        ("worry", -2.0), ("worried", -2.0), ("fear", -2.5), ("afraid", -2.5),
        ("negative", -2.5), ("pessimistic", -2.5), ("critical", -1.5), ("crisis", -3.0),
    ];
    for &(word, val) in words { lex.insert(word, val); }
    lex
}

fn build_intensifiers() -> HashMap<&'static str, f64> {
    let mut int = HashMap::new();
    let words: &[(&str, f64)] = &[
        ("very", 1.5), ("extremely", 2.0), ("incredibly", 2.0), ("absolutely", 2.0),
        ("really", 1.3), ("quite", 1.2), ("fairly", 1.1), ("rather", 1.1),
        ("somewhat", 0.8), ("slightly", 0.7), ("barely", 0.5), ("totally", 1.8),
        ("completely", 1.8), ("utterly", 2.0), ("truly", 1.5),
    ];
    for &(word, val) in words { int.insert(word, val); }
    int
}

fn is_negation(word: &str) -> bool {
    matches!(word,
        "not" | "no" | "never" | "neither" | "nor" | "hardly" | "barely" |
        "scarcely" | "seldom" | "rarely" | "without" | "lack" | "lacking"
    ) || word.ends_with("n't")
}

struct SentimentScore {
    sentiment: String,
    score: f64,
    magnitude: f64,
}

fn analyze_valence(
    text: &str,
    positive: &HashMap<&str, f64>,
    negative: &HashMap<&str, f64>,
    intensifiers: &HashMap<&str, f64>,
) -> SentimentScore {
    let cleaned: String = text.to_lowercase()
        .chars()
        .map(|c| if c.is_alphabetic() || c == '\'' || c.is_whitespace() || c == '-' { c } else { ' ' })
        .collect();
    let tokens: Vec<&str> = cleaned.split_whitespace().collect();

    let mut total_valence = 0.0;
    let mut word_count = 0;
    let mut is_negated = false;
    let mut intensifier_mult = 1.0;

    for (i, token) in tokens.iter().enumerate() {
        if is_negation(token) {
            is_negated = true;
            continue;
        }
        if let Some(&mult) = intensifiers.get(token) {
            intensifier_mult = mult;
            continue;
        }

        let valence = positive.get(token).copied()
            .or_else(|| negative.get(token).copied());

        if let Some(mut v) = valence {
            if is_negated {
                v *= -0.75;
                is_negated = false;
            }
            v *= intensifier_mult;
            intensifier_mult = 1.0;
            total_valence += v;
            word_count += 1;
        } else {
            if i > 0 && !is_negation(tokens[i - 1]) {
                is_negated = false;
            }
            intensifier_mult = 1.0;
        }
    }

    let normalized = if word_count > 0 {
        (total_valence / (word_count as f64 * 2.5)).max(-1.0).min(1.0)
    } else { 0.0 };
    let magnitude = total_valence.abs();

    let sentiment = if normalized > 0.05 { "positive" }
        else if normalized < -0.05 { "negative" }
        else { "neutral" };

    SentimentScore {
        sentiment: sentiment.to_string(),
        score: (normalized * 1000.0).round() / 1000.0,
        magnitude,
    }
}

fn split_sentences(text: &str) -> Vec<String> {
    let mut sentences = Vec::new();
    let mut current = String::new();
    for ch in text.chars() {
        current.push(ch);
        if (ch == '.' || ch == '!' || ch == '?') && current.len() > 5 {
            let trimmed = current.trim().to_string();
            if !trimmed.is_empty() { sentences.push(trimmed); }
            current = String::new();
        }
    }
    let trimmed = current.trim().to_string();
    if !trimmed.is_empty() { sentences.push(trimmed); }
    sentences
}

pub struct SentimentEnricherProvider;

impl SentimentEnricherProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn enrich(
        &self,
        item: &ContentItem,
        config: &EnricherConfig,
    ) -> Result<EnrichmentResult, EnricherError> {
        let opts = config.options.as_ref();
        let granularity = opts.and_then(|o| o.get("granularity"))
            .and_then(|g| g.as_str())
            .unwrap_or("document");

        let positive = build_positive_lexicon();
        let negative = build_negative_lexicon();
        let intensifiers = build_intensifiers();

        let mut fields = HashMap::new();
        let mut meta = HashMap::new();
        meta.insert("provider".to_string(), serde_json::json!(PROVIDER_ID));
        meta.insert("granularity".to_string(), serde_json::json!(granularity));
        meta.insert("mode".to_string(), serde_json::json!("lexicon_based"));

        let confidence: f64;

        if granularity == "sentence" {
            let sentences = split_sentences(&item.content);
            let results: Vec<serde_json::Value> = sentences.iter().map(|sent| {
                let score = analyze_valence(sent, &positive, &negative, &intensifiers);
                serde_json::json!({
                    "text": if sent.len() > 200 { &sent[..200] } else { sent.as_str() },
                    "sentiment": score.sentiment,
                    "score": score.score,
                    "magnitude": score.magnitude,
                })
            }).collect();

            let avg_score: f64 = if results.is_empty() { 0.0 } else {
                results.iter()
                    .filter_map(|r| r.get("score").and_then(|s| s.as_f64()))
                    .sum::<f64>() / results.len() as f64
            };
            let overall = if avg_score > 0.05 { "positive" }
                else if avg_score < -0.05 { "negative" }
                else { "neutral" };

            let pos_count = results.iter().filter(|r| r.get("sentiment").and_then(|s| s.as_str()) == Some("positive")).count();
            let neg_count = results.iter().filter(|r| r.get("sentiment").and_then(|s| s.as_str()) == Some("negative")).count();
            let neu_count = results.len() - pos_count - neg_count;

            fields.insert("sentiment".to_string(), serde_json::json!(overall));
            fields.insert("score".to_string(), serde_json::json!((avg_score * 1000.0).round() / 1000.0));
            fields.insert("sentences".to_string(), serde_json::json!(results));
            fields.insert("sentence_count".to_string(), serde_json::json!(results.len()));
            fields.insert("positive_count".to_string(), serde_json::json!(pos_count));
            fields.insert("negative_count".to_string(), serde_json::json!(neg_count));
            fields.insert("neutral_count".to_string(), serde_json::json!(neu_count));
            confidence = (0.5 + results.len() as f64 * 0.02).min(0.95);
        } else {
            let result = analyze_valence(&item.content, &positive, &negative, &intensifiers);
            fields.insert("sentiment".to_string(), serde_json::json!(result.sentiment));
            fields.insert("score".to_string(), serde_json::json!(result.score));
            fields.insert("magnitude".to_string(), serde_json::json!(result.magnitude));
            confidence = (0.5 + result.score.abs() * 0.4).min(0.9);
        }

        Ok(EnrichmentResult {
            fields,
            confidence,
            metadata: Some(meta),
        })
    }

    pub fn applies_to(&self, schema: &SchemaRef) -> bool {
        let applicable = ["text", "review", "comment", "feedback", "post", "message", "tweet"];
        let name_lower = schema.name.to_lowercase();
        applicable.iter().any(|s| name_lower.contains(s))
    }

    pub fn cost_estimate(&self, item: &ContentItem) -> CostEstimate {
        let word_count = item.content.split_whitespace().count() as u64;
        CostEstimate {
            tokens: None,
            api_calls: Some(0),
            duration_ms: Some((word_count / 500).max(5)),
        }
    }
}

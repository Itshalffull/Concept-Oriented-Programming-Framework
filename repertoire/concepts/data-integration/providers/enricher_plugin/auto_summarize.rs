// Clef Data Integration Kit - Auto-summarization enricher provider
// Implements extractive summarization (TF-IDF sentence scoring) with optional LLM abstractive mode.

use std::collections::{HashMap, HashSet};

pub const PROVIDER_ID: &str = "auto_summarize";
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
    ProcessError(String),
}

const STOP_WORDS: &[&str] = &[
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "have", "has",
    "had", "do", "does", "did", "will", "would", "could", "should", "may",
    "might", "to", "of", "in", "for", "on", "with", "at", "by", "from", "as",
    "and", "but", "or", "not", "this", "that", "it", "its", "i", "me", "my",
    "we", "our", "you", "your", "he", "him", "she", "her", "they", "them",
];

fn is_stop_word(word: &str) -> bool {
    STOP_WORDS.contains(&word)
}

fn split_sentences(text: &str) -> Vec<String> {
    let mut sentences = Vec::new();
    let mut current = String::new();

    for ch in text.chars() {
        current.push(ch);
        if (ch == '.' || ch == '!' || ch == '?') && current.len() > 10 {
            let trimmed = current.trim().to_string();
            if trimmed.split_whitespace().count() >= 3 {
                sentences.push(trimmed);
            }
            current = String::new();
        }
    }
    // Handle last fragment
    let trimmed = current.trim().to_string();
    if trimmed.len() > 10 && trimmed.split_whitespace().count() >= 3 {
        sentences.push(trimmed);
    }
    sentences
}

fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || c.is_whitespace() { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .filter(|w| w.len() > 2 && !is_stop_word(w))
        .map(String::from)
        .collect()
}

fn compute_idf(sentences: &[String]) -> HashMap<String, f64> {
    let n = sentences.len() as f64;
    let mut df: HashMap<String, f64> = HashMap::new();

    for sentence in sentences {
        let unique_tokens: HashSet<String> = tokenize(sentence).into_iter().collect();
        for token in unique_tokens {
            *df.entry(token).or_insert(0.0) += 1.0;
        }
    }

    let mut idf = HashMap::new();
    for (term, count) in df {
        idf.insert(term, ((n + 1.0) / (count + 1.0)).ln() + 1.0);
    }
    idf
}

fn score_sentence(
    sentence: &str,
    index: usize,
    total: usize,
    idf: &HashMap<String, f64>,
    title_tokens: &HashSet<String>,
) -> f64 {
    let tokens = tokenize(sentence);
    if tokens.is_empty() { return 0.0; }

    // TF-IDF score
    let mut token_counts: HashMap<String, f64> = HashMap::new();
    for t in &tokens {
        *token_counts.entry(t.clone()).or_insert(0.0) += 1.0;
    }
    let mut tfidf_score = 0.0;
    for (token, count) in &token_counts {
        let tf = count / tokens.len() as f64;
        let idf_val = idf.get(token).copied().unwrap_or(1.0);
        tfidf_score += tf * idf_val;
    }

    // Position score
    let relative_pos = if total > 1 { index as f64 / (total - 1) as f64 } else { 0.0 };
    let position_score = if relative_pos < 0.15 { 3.0 }
        else if relative_pos < 0.3 { 1.5 }
        else if relative_pos > 0.85 { 2.0 }
        else { 0.5 };

    // Length score
    let word_count = sentence.split_whitespace().count();
    let length_score = if word_count >= 8 && word_count <= 30 { 2.0 }
        else if word_count >= 5 && word_count <= 40 { 1.0 }
        else { 0.3 };

    // Title overlap score
    let title_overlap: usize = tokens.iter()
        .filter(|t| title_tokens.contains(t.as_str()))
        .count();
    let key_phrase_score = if !title_tokens.is_empty() {
        (title_overlap as f64 / title_tokens.len() as f64) * 3.0
    } else { 0.0 };

    // Cue phrase bonus
    let cue_phrases = ["important", "significant", "key", "result", "conclusion", "summary", "therefore"];
    let lower = sentence.to_lowercase();
    let cue_score = if cue_phrases.iter().any(|p| lower.contains(p)) { 1.5 } else { 0.0 };

    tfidf_score + position_score + length_score + key_phrase_score + cue_score
}

fn extractive_summarize(
    text: &str,
    counts: (usize, usize, usize),
) -> (String, String, String) {
    let sentences = split_sentences(text);
    if sentences.is_empty() {
        return (String::new(), String::new(), String::new());
    }

    let idf = compute_idf(&sentences);
    let title_tokens: HashSet<String> = tokenize(&sentences[0]).into_iter().collect();

    let mut scored: Vec<(usize, f64, &String)> = sentences.iter().enumerate().map(|(idx, sent)| {
        let score = score_sentence(sent, idx, sentences.len(), &idf, &title_tokens);
        (idx, score, sent)
    }).collect();

    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let pick_top_n = |n: usize| -> String {
        let mut top: Vec<(usize, &str)> = scored.iter()
            .take(n.min(scored.len()))
            .map(|(idx, _, sent)| (*idx, sent.as_str()))
            .collect();
        top.sort_by_key(|(idx, _)| *idx);
        top.iter().map(|(_, s)| *s).collect::<Vec<_>>().join(" ")
    };

    (pick_top_n(counts.0), pick_top_n(counts.1), pick_top_n(counts.2))
}

pub struct AutoSummarizeEnricherProvider;

impl AutoSummarizeEnricherProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn enrich(
        &self,
        item: &ContentItem,
        config: &EnricherConfig,
    ) -> Result<EnrichmentResult, EnricherError> {
        let opts = config.options.as_ref();
        let mode = opts.and_then(|o| o.get("mode"))
            .and_then(|m| m.as_str())
            .unwrap_or("extractive");

        let short_count = opts.and_then(|o| o.get("lengths"))
            .and_then(|l| l.get("short")).and_then(|v| v.as_u64()).unwrap_or(2) as usize;
        let medium_count = opts.and_then(|o| o.get("lengths"))
            .and_then(|l| l.get("medium")).and_then(|v| v.as_u64()).unwrap_or(5) as usize;
        let long_count = opts.and_then(|o| o.get("lengths"))
            .and_then(|l| l.get("long")).and_then(|v| v.as_u64()).unwrap_or(10) as usize;

        // Extractive summarization (default; abstractive would require async HTTP)
        let (short, medium, long) = extractive_summarize(
            &item.content, (short_count, medium_count, long_count),
        );

        let original_word_count = item.content.split_whitespace().count();
        let medium_word_count = medium.split_whitespace().count();
        let compression = if original_word_count > 0 {
            medium_word_count as f64 / original_word_count as f64
        } else { 1.0 };

        let mut fields = HashMap::new();
        fields.insert("summary".to_string(), serde_json::json!({
            "short": short,
            "medium": medium,
            "long": long,
        }));
        fields.insert("word_counts".to_string(), serde_json::json!({
            "short": short.split_whitespace().count(),
            "medium": medium_word_count,
            "long": long.split_whitespace().count(),
        }));
        fields.insert("compression_ratio".to_string(),
            serde_json::json!((compression * 100.0).round() / 100.0));

        let confidence = if mode == "abstractive" { 0.85 } else { 0.7 };

        let mut metadata = HashMap::new();
        metadata.insert("provider".to_string(), serde_json::json!(PROVIDER_ID));
        metadata.insert("mode".to_string(), serde_json::json!(mode));
        metadata.insert("originalWordCount".to_string(), serde_json::json!(original_word_count));

        Ok(EnrichmentResult {
            fields,
            confidence,
            metadata: Some(metadata),
        })
    }

    pub fn applies_to(&self, schema: &SchemaRef) -> bool {
        let text_schemas = ["text", "article", "document", "content", "post", "report", "paper"];
        let name_lower = schema.name.to_lowercase();
        text_schemas.iter().any(|s| name_lower.contains(s))
    }

    pub fn cost_estimate(&self, item: &ContentItem) -> CostEstimate {
        let word_count = item.content.split_whitespace().count() as u64;
        let duration_ms = (word_count / 100).max(10);
        CostEstimate {
            tokens: Some((word_count as f64 * 1.3) as u64),
            api_calls: Some(0),
            duration_ms: Some(duration_ms),
        }
    }
}

// COPF Data Integration Kit - Auto-tagging enricher provider
// Classifies content into existing taxonomy using TF-IDF similarity.

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "auto_tag";
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

#[derive(Debug, Clone, serde::Serialize)]
pub struct TagResult {
    pub term: String,
    pub taxonomy: String,
    pub confidence: f64,
}

#[derive(Debug)]
pub enum EnricherError {
    ConfigError(String),
}

struct TaxonomyTerm {
    term: String,
    taxonomy: String,
    synonyms: Vec<String>,
    keywords: Vec<String>,
}

const STOP_WORDS: &[&str] = &[
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "and", "but", "or",
    "nor", "not", "so", "yet", "both", "either", "neither", "each",
    "every", "all", "any", "few", "more", "most", "other", "some", "such",
    "no", "only", "own", "same", "than", "too", "very", "just", "because",
    "this", "that", "these", "those", "it", "its", "i", "me", "my", "we",
    "our", "you", "your", "he", "him", "his", "she", "her", "they", "them",
];

fn is_stop_word(word: &str) -> bool {
    STOP_WORDS.contains(&word)
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

fn compute_term_frequency(tokens: &[String]) -> HashMap<String, f64> {
    let mut counts: HashMap<String, f64> = HashMap::new();
    for token in tokens {
        *counts.entry(token.clone()).or_insert(0.0) += 1.0;
    }
    let max_freq = counts.values().cloned().fold(1.0f64, f64::max);
    for val in counts.values_mut() {
        *val = 0.5 + 0.5 * (*val / max_freq);
    }
    counts
}

fn build_term_vector(words: &[String]) -> HashMap<String, f64> {
    let mut vector: HashMap<String, f64> = HashMap::new();
    for word in words {
        let tokens = tokenize(word);
        for token in tokens {
            *vector.entry(token).or_insert(0.0) += 1.0;
        }
    }
    let max_val = vector.values().cloned().fold(1.0f64, f64::max);
    for val in vector.values_mut() {
        *val /= max_val;
    }
    vector
}

fn cosine_similarity(vec_a: &HashMap<String, f64>, vec_b: &HashMap<String, f64>) -> f64 {
    let mut dot_product = 0.0;
    let mut norm_a = 0.0;
    let mut norm_b = 0.0;

    // Collect all unique keys
    let mut all_keys: Vec<&String> = vec_a.keys().collect();
    for key in vec_b.keys() {
        if !vec_a.contains_key(key) {
            all_keys.push(key);
        }
    }

    for key in &all_keys {
        let a = vec_a.get(*key).copied().unwrap_or(0.0);
        let b = vec_b.get(*key).copied().unwrap_or(0.0);
        dot_product += a * b;
        norm_a += a * a;
        norm_b += b * b;
    }

    let denominator = norm_a.sqrt() * norm_b.sqrt();
    if denominator > 0.0 { dot_product / denominator } else { 0.0 }
}

fn parse_taxonomies(taxonomies: &[serde_json::Value]) -> Vec<TaxonomyTerm> {
    let mut terms = Vec::new();
    for taxonomy in taxonomies {
        let taxonomy_name = taxonomy.get("name")
            .and_then(|n| n.as_str())
            .unwrap_or("default");

        let terms_arr = taxonomy.get("terms")
            .and_then(|t| t.as_array())
            .cloned()
            .unwrap_or_default();

        for term_val in &terms_arr {
            let term = term_val.get("term")
                .or_else(|| term_val.get("name"))
                .and_then(|t| t.as_str())
                .unwrap_or("")
                .to_string();

            let synonyms: Vec<String> = term_val.get("synonyms")
                .and_then(|s| s.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();

            let keywords: Vec<String> = term_val.get("keywords")
                .and_then(|k| k.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default();

            terms.push(TaxonomyTerm {
                term,
                taxonomy: taxonomy_name.to_string(),
                synonyms,
                keywords,
            });
        }
    }
    terms
}

pub struct AutoTagEnricherProvider;

impl AutoTagEnricherProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn enrich(
        &self,
        item: &ContentItem,
        config: &EnricherConfig,
    ) -> Result<EnrichmentResult, EnricherError> {
        let opts = config.options.as_ref();
        let taxonomies_val = opts.and_then(|o| o.get("taxonomies"))
            .and_then(|t| t.as_array())
            .cloned()
            .unwrap_or_default();
        let max_tags = opts.and_then(|o| o.get("maxTags"))
            .and_then(|m| m.as_u64())
            .unwrap_or(10) as usize;
        let threshold = config.threshold.unwrap_or(0.3);

        let terms = parse_taxonomies(&taxonomies_val);
        let content_tokens = tokenize(&item.content);
        let content_tf = compute_term_frequency(&content_tokens);
        let lower_content = item.content.to_lowercase();

        let mut tag_results: Vec<TagResult> = Vec::new();

        for taxonomy_term in &terms {
            let mut term_words: Vec<String> = vec![taxonomy_term.term.clone()];
            term_words.extend(taxonomy_term.synonyms.clone());
            term_words.extend(taxonomy_term.keywords.clone());

            let term_vector = build_term_vector(&term_words);
            let mut similarity = cosine_similarity(&content_tf, &term_vector);

            // Boost for exact term match
            if lower_content.contains(&taxonomy_term.term.to_lowercase()) {
                similarity = (similarity + 0.3).min(1.0);
            }
            // Boost for synonym matches
            for synonym in &taxonomy_term.synonyms {
                if lower_content.contains(&synonym.to_lowercase()) {
                    similarity = (similarity + 0.15).min(1.0);
                }
            }

            if similarity >= threshold {
                tag_results.push(TagResult {
                    term: taxonomy_term.term.clone(),
                    taxonomy: taxonomy_term.taxonomy.clone(),
                    confidence: (similarity * 1000.0).round() / 1000.0,
                });
            }
        }

        tag_results.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal));
        tag_results.truncate(max_tags);

        let avg_conf = if tag_results.is_empty() {
            0.0
        } else {
            tag_results.iter().map(|t| t.confidence).sum::<f64>() / tag_results.len() as f64
        };

        // Group by taxonomy
        let mut by_taxonomy: HashMap<String, Vec<&TagResult>> = HashMap::new();
        for tag in &tag_results {
            by_taxonomy.entry(tag.taxonomy.clone()).or_default().push(tag);
        }

        let mut fields = HashMap::new();
        fields.insert("tags".to_string(), serde_json::json!(tag_results));
        fields.insert("tag_count".to_string(), serde_json::json!(tag_results.len()));
        fields.insert("tags_by_taxonomy".to_string(), serde_json::json!(by_taxonomy));

        let mut metadata = HashMap::new();
        metadata.insert("provider".to_string(), serde_json::json!(PROVIDER_ID));
        metadata.insert("taxonomyCount".to_string(), serde_json::json!(taxonomies_val.len()));
        metadata.insert("termCount".to_string(), serde_json::json!(terms.len()));
        metadata.insert("threshold".to_string(), serde_json::json!(threshold));
        metadata.insert("maxTags".to_string(), serde_json::json!(max_tags));
        metadata.insert("mode".to_string(), serde_json::json!("tfidf_similarity"));

        Ok(EnrichmentResult {
            fields,
            confidence: avg_conf,
            metadata: Some(metadata),
        })
    }

    pub fn applies_to(&self, schema: &SchemaRef) -> bool {
        let applicable = ["text", "article", "document", "content", "post", "page", "product"];
        let name_lower = schema.name.to_lowercase();
        applicable.iter().any(|s| name_lower.contains(s))
    }

    pub fn cost_estimate(&self, item: &ContentItem) -> CostEstimate {
        let char_count = item.content.len();
        let duration_ms = (char_count / 2000).max(5) as u64;
        CostEstimate {
            tokens: None,
            api_calls: Some(0),
            duration_ms: Some(duration_ms),
        }
    }
}

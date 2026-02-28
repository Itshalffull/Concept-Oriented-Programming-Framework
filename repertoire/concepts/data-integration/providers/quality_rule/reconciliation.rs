// Quality Rule Provider: Reconciliation Validation
// Matches field values against external knowledge bases for accuracy verification.
// Dimension: accuracy

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "reconciliation";
pub const PLUGIN_TYPE: &str = "quality_rule";

#[derive(Debug, Clone)]
pub struct FieldDef {
    pub name: String,
    pub field_type: String,
    pub required: Option<bool>,
    pub constraints: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone)]
pub struct RuleConfig {
    pub options: Option<HashMap<String, serde_json::Value>>,
    pub threshold: Option<f64>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Severity { Error, Warning, Info }

#[derive(Debug, Clone)]
pub struct RuleResult {
    pub valid: bool,
    pub message: Option<String>,
    pub severity: Severity,
}

#[derive(Debug, Clone, PartialEq)]
pub enum QualityDimension {
    Completeness, Uniqueness, Validity, Consistency, Timeliness, Accuracy,
}

#[derive(Debug, Clone)]
pub struct KBMatch {
    pub canonical_value: String,
    pub confidence: f64,
    pub source: String,
}

pub struct ReconciliationQualityProvider {
    local_dictionaries: HashMap<String, Vec<String>>,
}

impl ReconciliationQualityProvider {
    pub fn new() -> Self {
        Self {
            local_dictionaries: HashMap::new(),
        }
    }

    /// Register a local dictionary for reconciliation without external API calls.
    pub fn register_local_dictionary(&mut self, name: &str, values: Vec<String>) {
        self.local_dictionaries.insert(name.to_string(), values);
    }

    pub fn validate(
        &self,
        value: &serde_json::Value,
        field: &FieldDef,
        _record: &HashMap<String, serde_json::Value>,
        config: &RuleConfig,
    ) -> RuleResult {
        if value.is_null() {
            return RuleResult { valid: true, message: None, severity: Severity::Info };
        }

        let string_value = match value.as_str() {
            Some(s) => s.to_string(),
            None => value.to_string().trim_matches('"').to_string(),
        };

        let match_threshold = config.threshold.unwrap_or(0.8);
        let knowledge_base = config.options.as_ref()
            .and_then(|o| o.get("knowledgeBase"))
            .and_then(|v| v.as_str())
            .unwrap_or("local");

        // Try local dictionary first
        let local_dict = config.options.as_ref()
            .and_then(|o| o.get("localDictionary"))
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect::<Vec<_>>());

        let candidates = local_dict
            .or_else(|| self.local_dictionaries.get(knowledge_base).cloned());

        match candidates {
            Some(ref dict) if !dict.is_empty() => {
                let best_match = self.find_best_match(&string_value, dict);

                if best_match.confidence >= match_threshold {
                    if best_match.canonical_value != string_value {
                        return RuleResult {
                            valid: true,
                            message: Some(format!(
                                "Field '{}': suggested canonical form is '{}' (similarity: {:.1}%).",
                                field.name, best_match.canonical_value,
                                best_match.confidence * 100.0
                            )),
                            severity: Severity::Info,
                        };
                    }
                    return RuleResult { valid: true, message: None, severity: Severity::Info };
                }

                RuleResult {
                    valid: false,
                    message: Some(format!(
                        "Field '{}' value '{}' could not be reconciled. Best match: '{}' ({:.1}%).",
                        field.name, string_value, best_match.canonical_value,
                        best_match.confidence * 100.0
                    )),
                    severity: Severity::Warning,
                }
            }
            _ => {
                RuleResult {
                    valid: true,
                    message: Some(format!(
                        "Field '{}': reconciliation requires a localDictionary or registered dictionary for '{}'.",
                        field.name, knowledge_base
                    )),
                    severity: Severity::Info,
                }
            }
        }
    }

    fn find_best_match(&self, value: &str, candidates: &[String]) -> KBMatch {
        let lower_value = value.to_lowercase();
        let mut best = KBMatch {
            canonical_value: candidates.first().cloned().unwrap_or_default(),
            confidence: 0.0,
            source: "local".to_string(),
        };

        for candidate in candidates {
            let lower_candidate = candidate.to_lowercase();
            if lower_value == lower_candidate {
                return KBMatch {
                    canonical_value: candidate.clone(),
                    confidence: 1.0,
                    source: "local".to_string(),
                };
            }
            let similarity = self.jaro_winkler(&lower_value, &lower_candidate);
            if similarity > best.confidence {
                best.confidence = similarity;
                best.canonical_value = candidate.clone();
            }
        }

        best
    }

    fn jaro_winkler(&self, s1: &str, s2: &str) -> f64 {
        if s1 == s2 { return 1.0; }
        let s1_chars: Vec<char> = s1.chars().collect();
        let s2_chars: Vec<char> = s2.chars().collect();
        let len1 = s1_chars.len();
        let len2 = s2_chars.len();
        if len1 == 0 || len2 == 0 { return 0.0; }

        let match_distance = (len1.max(len2) / 2).saturating_sub(1);
        let mut s1_matches = vec![false; len1];
        let mut s2_matches = vec![false; len2];
        let mut matches = 0usize;
        let mut transpositions = 0usize;

        for i in 0..len1 {
            let start = if i > match_distance { i - match_distance } else { 0 };
            let end = (i + match_distance + 1).min(len2);
            for j in start..end {
                if s2_matches[j] || s1_chars[i] != s2_chars[j] { continue; }
                s1_matches[i] = true;
                s2_matches[j] = true;
                matches += 1;
                break;
            }
        }

        if matches == 0 { return 0.0; }

        let mut k = 0;
        for i in 0..len1 {
            if !s1_matches[i] { continue; }
            while !s2_matches[k] { k += 1; }
            if s1_chars[i] != s2_chars[k] { transpositions += 1; }
            k += 1;
        }

        let m = matches as f64;
        let jaro = (m / len1 as f64 + m / len2 as f64
            + (m - transpositions as f64 / 2.0) / m) / 3.0;

        let mut prefix = 0;
        for i in 0..4.min(len1.min(len2)) {
            if s1_chars[i] == s2_chars[i] { prefix += 1; }
            else { break; }
        }

        jaro + prefix as f64 * 0.1 * (1.0 - jaro)
    }

    pub fn applies_to(&self, field: &FieldDef) -> bool {
        field.field_type.to_lowercase() == "string"
    }

    pub fn dimension(&self) -> QualityDimension {
        QualityDimension::Accuracy
    }
}

impl Default for ReconciliationQualityProvider {
    fn default() -> Self {
        Self::new()
    }
}

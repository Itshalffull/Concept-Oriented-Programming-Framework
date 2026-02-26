// Quality Rule Provider: No Duplicates (Record-Level Deduplication)
// Detects duplicate records using exact match, fuzzy, or phonetic strategies.
// Dimension: uniqueness

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "no_duplicates";
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

#[derive(Clone)]
struct RecordSignature {
    id: String,
    fields: HashMap<String, String>,
}

pub struct NoDuplicatesQualityProvider {
    seen_records: Vec<RecordSignature>,
}

impl NoDuplicatesQualityProvider {
    pub fn new() -> Self {
        Self {
            seen_records: Vec::new(),
        }
    }

    pub fn validate(
        &mut self,
        _value: &serde_json::Value,
        field: &FieldDef,
        record: &HashMap<String, serde_json::Value>,
        config: &RuleConfig,
    ) -> RuleResult {
        let fields: Vec<String> = config.options.as_ref()
            .and_then(|o| o.get("fields"))
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_else(|| vec![field.name.clone()]);

        let strategy = config.options.as_ref()
            .and_then(|o| o.get("strategy"))
            .and_then(|v| v.as_str())
            .unwrap_or("exact");

        let threshold = config.threshold.unwrap_or(0.8);

        let record_id = record.get("_id")
            .and_then(|v| v.as_str())
            .map(String::from)
            .unwrap_or_else(|| self.seen_records.len().to_string());

        let mut signature = HashMap::new();
        for f in &fields {
            let val = record.get(f)
                .map(|v| match v.as_str() {
                    Some(s) => s.to_string(),
                    None => v.to_string(),
                })
                .unwrap_or_default();
            signature.insert(f.clone(), val);
        }

        let mut duplicates: Vec<String> = Vec::new();
        for seen in &self.seen_records {
            if self.compare_records(&signature, &seen.fields, strategy, threshold) {
                duplicates.push(seen.id.clone());
            }
        }

        self.seen_records.push(RecordSignature {
            id: record_id.clone(),
            fields: signature,
        });

        if !duplicates.is_empty() {
            return RuleResult {
                valid: false,
                message: Some(format!(
                    "Record '{}' is a duplicate of [{}] using '{}' strategy on fields [{}].",
                    record_id,
                    duplicates.join(", "),
                    strategy,
                    fields.join(", ")
                )),
                severity: Severity::Warning,
            };
        }

        RuleResult { valid: true, message: None, severity: Severity::Warning }
    }

    fn compare_records(
        &self,
        a: &HashMap<String, String>,
        b: &HashMap<String, String>,
        strategy: &str,
        threshold: f64,
    ) -> bool {
        match strategy {
            "exact" => a.iter().all(|(k, v)| b.get(k).map_or(false, |bv| bv == v)),

            "fuzzy" => {
                let similarities: Vec<f64> = a.iter()
                    .map(|(k, v)| {
                        let bv = b.get(k).map(String::as_str).unwrap_or("");
                        self.levenshtein_similarity(v, bv)
                    })
                    .collect();
                let avg = similarities.iter().sum::<f64>() / similarities.len() as f64;
                avg >= threshold
            }

            "phonetic" => {
                a.iter().all(|(k, v)| {
                    let bv = b.get(k).map(String::as_str).unwrap_or("");
                    self.soundex(v) == self.soundex(bv)
                })
            }

            _ => a.iter().all(|(k, v)| b.get(k).map_or(false, |bv| bv == v)),
        }
    }

    fn levenshtein_similarity(&self, a: &str, b: &str) -> f64 {
        if a == b { return 1.0; }
        let max_len = a.len().max(b.len());
        if max_len == 0 { return 1.0; }

        let a_bytes = a.as_bytes();
        let b_bytes = b.as_bytes();
        let mut matrix = vec![vec![0usize; b.len() + 1]; a.len() + 1];

        for i in 0..=a.len() { matrix[i][0] = i; }
        for j in 0..=b.len() { matrix[0][j] = j; }

        for i in 1..=a.len() {
            for j in 1..=b.len() {
                let cost = if a_bytes[i - 1] == b_bytes[j - 1] { 0 } else { 1 };
                matrix[i][j] = (matrix[i - 1][j] + 1)
                    .min(matrix[i][j - 1] + 1)
                    .min(matrix[i - 1][j - 1] + cost);
            }
        }

        let distance = matrix[a.len()][b.len()];
        1.0 - (distance as f64 / max_len as f64)
    }

    fn soundex(&self, s: &str) -> String {
        let upper: String = s.to_uppercase().chars().filter(|c| c.is_ascii_alphabetic()).collect();
        if upper.is_empty() { return "0000".to_string(); }

        let mut result = String::new();
        let chars: Vec<char> = upper.chars().collect();
        result.push(chars[0]);

        let code = |c: char| -> Option<char> {
            match c {
                'B' | 'F' | 'P' | 'V' => Some('1'),
                'C' | 'G' | 'J' | 'K' | 'Q' | 'S' | 'X' | 'Z' => Some('2'),
                'D' | 'T' => Some('3'),
                'L' => Some('4'),
                'M' | 'N' => Some('5'),
                'R' => Some('6'),
                _ => None,
            }
        };

        let mut last_code = code(chars[0]);
        for &c in &chars[1..] {
            if result.len() >= 4 { break; }
            let cur_code = code(c);
            if let Some(cc) = cur_code {
                if Some(cc) != last_code {
                    result.push(cc);
                }
            }
            last_code = cur_code.or(last_code);
        }

        while result.len() < 4 {
            result.push('0');
        }
        result
    }

    pub fn applies_to(&self, _field: &FieldDef) -> bool {
        true
    }

    pub fn dimension(&self) -> QualityDimension {
        QualityDimension::Uniqueness
    }

    pub fn reset(&mut self) {
        self.seen_records.clear();
    }
}

impl Default for NoDuplicatesQualityProvider {
    fn default() -> Self {
        Self::new()
    }
}

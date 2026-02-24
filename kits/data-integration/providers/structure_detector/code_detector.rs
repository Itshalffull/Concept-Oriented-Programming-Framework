// Code block detector — detects fenced code blocks, indented blocks, and inline code
// Classifies language by keyword analysis

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

pub const PROVIDER_ID: &str = "code_detector";
pub const PLUGIN_TYPE: &str = "structure_detector";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectorConfig {
    pub options: Option<HashMap<String, Value>>,
    pub confidence_threshold: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Detection {
    pub field: String,
    pub value: Value,
    pub r#type: String,
    pub confidence: f64,
    pub evidence: String,
}

#[derive(Debug)]
pub enum DetectorError {
    ParseError(String),
    RegexError(String),
}

impl std::fmt::Display for DetectorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DetectorError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            DetectorError::RegexError(msg) => write!(f, "Regex error: {}", msg),
        }
    }
}

struct LanguageSignature {
    language: &'static str,
    keywords: Vec<&'static str>,
    patterns: Vec<Regex>,
}

fn build_signatures() -> Vec<LanguageSignature> {
    vec![
        LanguageSignature {
            language: "javascript",
            keywords: vec!["const", "let", "var", "function", "require", "module.exports", "=>", "async", "await"],
            patterns: vec![
                Regex::new(r"\bconst\s+\w+\s*=").unwrap(),
                Regex::new(r"\bfunction\s+\w+\s*\(").unwrap(),
                Regex::new(r"\bconsole\.log\b").unwrap(),
            ],
        },
        LanguageSignature {
            language: "typescript",
            keywords: vec!["interface", "type", "enum", "namespace", "implements", "readonly"],
            patterns: vec![
                Regex::new(r":\s*(string|number|boolean|void|any)\b").unwrap(),
                Regex::new(r"\binterface\s+\w+").unwrap(),
                Regex::new(r"\btype\s+\w+\s*=").unwrap(),
            ],
        },
        LanguageSignature {
            language: "python",
            keywords: vec!["def", "import", "from", "class", "self", "elif", "except", "lambda", "yield"],
            patterns: vec![
                Regex::new(r"\bdef\s+\w+\s*\(").unwrap(),
                Regex::new(r"\bimport\s+\w+").unwrap(),
                Regex::new(r"\bfrom\s+\w+\s+import").unwrap(),
                Regex::new(r"\bself\.\w+").unwrap(),
            ],
        },
        LanguageSignature {
            language: "rust",
            keywords: vec!["fn", "let", "mut", "impl", "struct", "enum", "pub", "use", "mod", "match", "trait"],
            patterns: vec![
                Regex::new(r"\bfn\s+\w+").unwrap(),
                Regex::new(r"\blet\s+mut\s").unwrap(),
                Regex::new(r"\bimpl\s+\w+").unwrap(),
                Regex::new(r"\bpub\s+(fn|struct|enum|mod)\b").unwrap(),
                Regex::new(r"->").unwrap(),
            ],
        },
        LanguageSignature {
            language: "go",
            keywords: vec!["func", "package", "import", "go", "chan", "defer", "select"],
            patterns: vec![
                Regex::new(r"\bfunc\s+\w+").unwrap(),
                Regex::new(r"\bpackage\s+\w+").unwrap(),
                Regex::new(r":=\s*").unwrap(),
            ],
        },
        LanguageSignature {
            language: "swift",
            keywords: vec!["func", "var", "let", "guard", "protocol", "extension", "struct", "class", "enum"],
            patterns: vec![
                Regex::new(r"\bguard\s+let").unwrap(),
                Regex::new(r"\bprotocol\s+\w+").unwrap(),
                Regex::new(r"\bextension\s+\w+").unwrap(),
            ],
        },
        LanguageSignature {
            language: "java",
            keywords: vec!["public", "private", "protected", "class", "interface", "extends", "implements"],
            patterns: vec![
                Regex::new(r"\bpublic\s+class\s+\w+").unwrap(),
                Regex::new(r"\bSystem\.out\.").unwrap(),
            ],
        },
        LanguageSignature {
            language: "sql",
            keywords: vec!["SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "CREATE", "JOIN"],
            patterns: vec![
                Regex::new(r"(?i)\bSELECT\s+.+\s+FROM\b").unwrap(),
                Regex::new(r"(?i)\bCREATE\s+TABLE\b").unwrap(),
            ],
        },
    ]
}

fn classify_language(code: &str) -> (&'static str, f64) {
    let sigs = build_signatures();
    let mut best_lang = "unknown";
    let mut best_score: usize = 0;

    for sig in &sigs {
        let mut score: usize = 0;
        for kw in &sig.keywords {
            if code.contains(kw) { score += 1; }
        }
        for pat in &sig.patterns {
            if pat.is_match(code) { score += 2; }
        }
        if score > best_score {
            best_score = score;
            best_lang = sig.language;
        }
    }

    let confidence = if best_score >= 6 { 0.90 } else if best_score >= 3 { 0.75 }
        else if best_score >= 1 { 0.55 } else { 0.30 };
    (best_lang, confidence)
}

fn code_value(language: &str, content: &str, format: &str) -> Value {
    let mut m = serde_json::Map::new();
    m.insert("language".into(), Value::String(language.to_string()));
    m.insert("content".into(), Value::String(content.to_string()));
    m.insert("format".into(), Value::String(format.to_string()));
    Value::Object(m)
}

pub struct CodeDetectorProvider;

impl CodeDetectorProvider {
    pub fn new() -> Self { Self }

    pub fn detect(
        &self,
        content: &str,
        _existing: &HashMap<String, Value>,
        config: &DetectorConfig,
    ) -> Result<Vec<Detection>, DetectorError> {
        let threshold = config.confidence_threshold.unwrap_or(0.5);
        let mut detections = Vec::new();

        // Fenced code blocks
        let fenced_re = Regex::new(r"```(\w*)\n([\s\S]*?)```")
            .map_err(|e| DetectorError::RegexError(e.to_string()))?;

        for cap in fenced_re.captures_iter(content) {
            let declared = cap.get(1).map(|m| m.as_str()).unwrap_or("");
            let code = cap[2].trim();
            if code.is_empty() { continue; }

            let (classified_lang, classified_conf) = classify_language(code);
            let language = if declared.is_empty() { classified_lang } else { declared };
            let confidence = if !declared.is_empty() { 0.98 } else { classified_conf };
            if confidence < threshold { continue; }

            let line_count = code.lines().count();
            detections.push(Detection {
                field: "code".into(),
                value: code_value(language, code, "fenced"),
                r#type: "code_block".into(),
                confidence,
                evidence: format!("Fenced code block ({}, {} lines)", language, line_count),
            });
        }

        // Indented code blocks (4+ spaces)
        let lines: Vec<&str> = content.lines().collect();
        let indent_re = Regex::new(r"^ {4,}\S").unwrap();
        let tab_re = Regex::new(r"^\t\S").unwrap();
        let mut block: Vec<String> = Vec::new();

        let mut flush_indented = |block: &mut Vec<String>, dets: &mut Vec<Detection>| {
            if block.len() >= 2 {
                let code = block.join("\n");
                let (lang, conf) = classify_language(&code);
                let confidence = conf.min(0.80);
                if confidence >= threshold {
                    let lc = block.len();
                    dets.push(Detection {
                        field: "code".into(),
                        value: code_value(lang, &code, "indented"),
                        r#type: "code_block".into(),
                        confidence,
                        evidence: format!("Indented code block ({}, {} lines)", lang, lc),
                    });
                }
            }
            block.clear();
        };

        for line in &lines {
            if indent_re.is_match(line) || tab_re.is_match(line) {
                let cleaned = if line.starts_with("    ") { &line[4..] }
                    else if line.starts_with('\t') { &line[1..] }
                    else { line };
                block.push(cleaned.to_string());
            } else if line.trim().is_empty() && !block.is_empty() {
                block.push(String::new());
            } else {
                flush_indented(&mut block, &mut detections);
            }
        }
        flush_indented(&mut block, &mut detections);

        // Inline code
        let inline_re = Regex::new(r"(?:^|[^`])`([^`\n]+)`(?:[^`]|$)")
            .map_err(|e| DetectorError::RegexError(e.to_string()))?;
        let mut inline_count = 0;

        for cap in inline_re.captures_iter(content) {
            if inline_count >= 20 { break; }
            let code = cap[1].trim();
            if code.len() < 2 || code.len() > 200 { continue; }
            inline_count += 1;

            let confidence = if code.contains('(') || code.contains('.') || code.contains('=') { 0.80 } else { 0.65 };
            if confidence < threshold { continue; }

            let preview = if code.len() > 50 { &code[..50] } else { code };
            detections.push(Detection {
                field: "code".into(),
                value: code_value("inline", code, "inline"),
                r#type: "code_inline".into(),
                confidence,
                evidence: format!("Inline code: `{}`", preview),
            });
        }

        Ok(detections)
    }

    pub fn applies_to(&self, content_type: &str) -> bool {
        matches!(content_type, "text/plain" | "text/html" | "text/markdown")
    }
}

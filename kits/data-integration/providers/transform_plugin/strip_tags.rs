// Transform Plugin Provider: strip_tags
// Remove HTML tags with optional allowlist and entity decoding.
// See Architecture doc for transform plugin interface contract.

use std::collections::HashMap;
use std::collections::HashSet;

pub const PROVIDER_ID: &str = "strip_tags";
pub const PLUGIN_TYPE: &str = "transform_plugin";

#[derive(Debug, Clone)]
pub enum Value {
    String(String),
    Number(f64),
    Integer(i64),
    Boolean(bool),
    Null,
    Array(Vec<Value>),
    Object(HashMap<String, Value>),
}

#[derive(Debug, Clone)]
pub struct TransformConfig {
    pub options: HashMap<String, Value>,
}

#[derive(Debug, Clone)]
pub struct TypeSpec {
    pub type_name: String,
    pub nullable: bool,
}

#[derive(Debug)]
pub enum TransformError {
    InvalidInput(String),
}

impl std::fmt::Display for TransformError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransformError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
        }
    }
}

pub struct StripTagsTransformProvider;

impl StripTagsTransformProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let html = match value {
            Value::Null => return Ok(Value::Null),
            Value::String(s) => s.clone(),
            _ => return Err(TransformError::InvalidInput("Expected string input".to_string())),
        };

        let allowed_tags: HashSet<String> = match config.options.get("allowedTags") {
            Some(Value::Array(arr)) => {
                arr.iter().filter_map(|v| {
                    if let Value::String(s) = v { Some(s.to_lowercase()) } else { None }
                }).collect()
            }
            _ => HashSet::new(),
        };

        let decode_entities = match config.options.get("decodeEntities") {
            Some(Value::Boolean(false)) => false,
            _ => true,
        };

        let preserve_whitespace = match config.options.get("preserveWhitespace") {
            Some(Value::Boolean(false)) => false,
            _ => true,
        };

        let mut result = html;

        // Insert whitespace for block elements before stripping
        if preserve_whitespace {
            let block_tags = [
                "p", "div", "h1", "h2", "h3", "h4", "h5", "h6",
                "ul", "ol", "li", "table", "tr", "td", "th",
                "blockquote", "pre", "section", "article",
            ];
            for tag in &block_tags {
                if !allowed_tags.contains(*tag) {
                    // Replace opening tags with space
                    let open = format!("<{}", tag);
                    while let Some(pos) = result.find(&open) {
                        if let Some(end) = result[pos..].find('>') {
                            result = format!("{} {}", &result[..pos], &result[pos + end + 1..]);
                        } else {
                            break;
                        }
                    }
                    // Replace closing tags with space
                    let close = format!("</{}>", tag);
                    result = result.replace(&close, " ");
                }
            }
            // <br> to newline
            if !allowed_tags.contains("br") {
                result = result.replace("<br>", "\n")
                    .replace("<br/>", "\n")
                    .replace("<br />", "\n");
            }
        }

        // Remove HTML comments
        while let Some(start) = result.find("<!--") {
            if let Some(end) = result[start..].find("-->") {
                result = format!("{}{}", &result[..start], &result[start + end + 3..]);
            } else {
                break;
            }
        }

        // Strip tags (preserving allowlisted ones)
        if allowed_tags.is_empty() {
            result = self.strip_all_tags(&result);
        } else {
            result = self.strip_tags_except(&result, &allowed_tags);
        }

        // Decode HTML entities
        if decode_entities {
            result = self.decode_html_entities(&result);
        }

        // Normalize whitespace
        result = self.normalize_whitespace(&result);

        Ok(Value::String(result.trim().to_string()))
    }

    fn strip_all_tags(&self, html: &str) -> String {
        let mut result = String::new();
        let mut in_tag = false;
        for ch in html.chars() {
            if ch == '<' {
                in_tag = true;
            } else if ch == '>' {
                in_tag = false;
            } else if !in_tag {
                result.push(ch);
            }
        }
        result
    }

    fn strip_tags_except(&self, html: &str, allowed: &HashSet<String>) -> String {
        let mut result = String::new();
        let mut remaining = html;

        while let Some(pos) = remaining.find('<') {
            result.push_str(&remaining[..pos]);
            remaining = &remaining[pos..];

            if let Some(end) = remaining.find('>') {
                let tag = &remaining[..end + 1];
                let tag_name = self.extract_tag_name(tag);

                if allowed.contains(&tag_name.to_lowercase()) {
                    result.push_str(tag);
                }
                remaining = &remaining[end + 1..];
            } else {
                result.push_str(remaining);
                break;
            }
        }
        result.push_str(remaining);
        result
    }

    fn extract_tag_name(&self, tag: &str) -> String {
        let inner = tag.trim_start_matches('<').trim_start_matches('/');
        let mut name = String::new();
        for ch in inner.chars() {
            if ch.is_alphanumeric() {
                name.push(ch);
            } else {
                break;
            }
        }
        name
    }

    fn decode_html_entities(&self, text: &str) -> String {
        let mut result = text.to_string();
        let entities = [
            ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", "\""),
            ("&#39;", "'"), ("&apos;", "'"), ("&nbsp;", " "),
            ("&mdash;", "\u{2014}"), ("&ndash;", "\u{2013}"),
            ("&hellip;", "\u{2026}"), ("&bull;", "\u{2022}"),
            ("&copy;", "\u{00A9}"), ("&reg;", "\u{00AE}"),
            ("&trade;", "\u{2122}"), ("&times;", "\u{00D7}"),
            ("&euro;", "\u{20AC}"), ("&pound;", "\u{00A3}"),
        ];
        for (entity, replacement) in &entities {
            result = result.replace(entity, replacement);
        }

        // Decode decimal numeric entities (&#NNN;)
        while let Some(start) = result.find("&#") {
            if let Some(end) = result[start..].find(';') {
                let num_str = &result[start + 2..start + end];
                if let Ok(code) = num_str.parse::<u32>() {
                    if let Some(ch) = char::from_u32(code) {
                        result = format!("{}{}{}", &result[..start], ch, &result[start + end + 1..]);
                        continue;
                    }
                }
            }
            break;
        }

        result
    }

    fn normalize_whitespace(&self, text: &str) -> String {
        let mut result = String::new();
        let mut last_was_space = false;
        for ch in text.chars() {
            if ch == ' ' || ch == '\t' {
                if !last_was_space {
                    result.push(' ');
                    last_was_space = true;
                }
            } else if ch == '\n' {
                result.push('\n');
                last_was_space = false;
            } else {
                result.push(ch);
                last_was_space = false;
            }
        }
        // Collapse multiple newlines
        while result.contains("\n\n\n") {
            result = result.replace("\n\n\n", "\n\n");
        }
        result
    }

    pub fn input_type(&self) -> TypeSpec {
        TypeSpec { type_name: "string".to_string(), nullable: true }
    }

    pub fn output_type(&self) -> TypeSpec {
        TypeSpec { type_name: "string".to_string(), nullable: true }
    }
}

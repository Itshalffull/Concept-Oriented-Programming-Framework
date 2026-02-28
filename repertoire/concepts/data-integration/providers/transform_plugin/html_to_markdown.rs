// Transform Plugin Provider: html_to_markdown
// Convert HTML content to Markdown syntax.
// See Architecture doc for transform plugin interface contract.

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "html_to_markdown";
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

pub struct HtmlToMarkdownTransformProvider;

impl HtmlToMarkdownTransformProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let html = match value {
            Value::Null => return Ok(Value::Null),
            Value::String(s) => s.clone(),
            _ => return Err(TransformError::InvalidInput("Expected string input".to_string())),
        };

        let preserve_links = match config.options.get("preserveLinks") {
            Some(Value::Boolean(false)) => false,
            _ => true,
        };

        let mut result = html;

        // Normalize line breaks
        result = result.replace("\r\n", "\n").replace('\r', "\n");

        // Headings h1-h6
        for i in (1..=6).rev() {
            let hashes = "#".repeat(i);
            let open_tag = format!("<h{}", i);
            let close_tag = format!("</h{}>", i);
            result = self.replace_tag_pair(&result, &open_tag, &close_tag,
                &format!("\n\n{} ", hashes), "\n\n");
        }

        // Bold
        result = self.replace_simple_tag(&result, "strong", "**", "**");
        result = self.replace_simple_tag(&result, "b", "**", "**");

        // Italic
        result = self.replace_simple_tag(&result, "em", "*", "*");
        result = self.replace_simple_tag(&result, "i", "*", "*");

        // Code blocks: <pre><code>...</code></pre>
        result = self.replace_code_blocks(&result);

        // Inline code
        result = self.replace_simple_tag(&result, "code", "`", "`");

        // Links
        if preserve_links {
            result = self.replace_links(&result);
        } else {
            result = self.strip_links(&result);
        }

        // Images
        result = self.replace_images(&result);

        // Blockquotes
        result = self.replace_blockquotes(&result);

        // Lists
        result = self.replace_unordered_lists(&result);
        result = self.replace_ordered_lists(&result);

        // Horizontal rules
        result = self.replace_hr(&result);

        // Line breaks
        result = result.replace("<br>", "\n").replace("<br/>", "\n").replace("<br />", "\n");

        // Paragraphs
        result = self.replace_tag_pair(&result, "<p", "</p>", "\n\n", "\n\n");

        // Strip remaining tags
        result = self.strip_all_tags(&result);

        // Decode entities
        result = self.decode_entities(&result);

        // Clean up excessive blank lines
        while result.contains("\n\n\n") {
            result = result.replace("\n\n\n", "\n\n");
        }

        Ok(Value::String(result.trim().to_string()))
    }

    fn replace_simple_tag(&self, html: &str, tag: &str, prefix: &str, suffix: &str) -> String {
        let mut result = html.to_string();
        let open = format!("<{}>", tag);
        let open_attr = format!("<{} ", tag);
        let close = format!("</{}>", tag);

        // Handle tags without attributes
        loop {
            let start = result.find(&open).or_else(|| {
                result.find(&open_attr).and_then(|pos| {
                    result[pos..].find('>').map(|end| pos)
                })
            });
            let end_tag = result.find(&close);

            match (start, end_tag) {
                (Some(s), Some(e)) if s < e => {
                    let tag_end = result[s..].find('>').unwrap() + s + 1;
                    let content = &result[tag_end..e];
                    let replacement = format!("{}{}{}", prefix, content, suffix);
                    result = format!("{}{}{}", &result[..s], replacement, &result[e + close.len()..]);
                }
                _ => break,
            }
        }
        result
    }

    fn replace_tag_pair(&self, html: &str, open_start: &str, close_tag: &str, prefix: &str, suffix: &str) -> String {
        let mut result = html.to_string();
        loop {
            if let Some(start) = result.find(open_start) {
                if let Some(tag_end) = result[start..].find('>') {
                    let content_start = start + tag_end + 1;
                    if let Some(end) = result[content_start..].find(close_tag) {
                        let content = &result[content_start..content_start + end];
                        let replacement = format!("{}{}{}", prefix, content, suffix);
                        result = format!("{}{}{}", &result[..start], replacement,
                            &result[content_start + end + close_tag.len()..]);
                        continue;
                    }
                }
            }
            break;
        }
        result
    }

    fn replace_code_blocks(&self, html: &str) -> String {
        let mut result = html.to_string();
        let pre_open = "<pre";
        let pre_close = "</pre>";
        loop {
            if let Some(start) = result.find(pre_open) {
                if let Some(end) = result[start..].find(pre_close) {
                    let block = &result[start..start + end + pre_close.len()];
                    let mut content = block.to_string();
                    // Remove pre/code tags
                    content = self.strip_all_tags(&content);
                    let replacement = format!("\n\n```\n{}\n```\n\n", content.trim());
                    result = format!("{}{}{}", &result[..start], replacement,
                        &result[start + end + pre_close.len()..]);
                    continue;
                }
            }
            break;
        }
        result
    }

    fn replace_links(&self, html: &str) -> String {
        let mut result = html.to_string();
        let open = "<a ";
        let close = "</a>";
        loop {
            if let Some(start) = result.find(open) {
                if let Some(end_pos) = result[start..].find(close) {
                    let tag_region = &result[start..start + end_pos + close.len()];
                    let href = self.extract_attr(tag_region, "href");
                    let tag_end = result[start..].find('>').unwrap() + start + 1;
                    let text = &result[tag_end..start + end_pos];
                    let md = format!("[{}]({})", text, href);
                    result = format!("{}{}{}", &result[..start], md,
                        &result[start + end_pos + close.len()..]);
                    continue;
                }
            }
            break;
        }
        result
    }

    fn strip_links(&self, html: &str) -> String {
        let mut result = html.to_string();
        loop {
            if let Some(start) = result.find("<a ") {
                if let Some(end_pos) = result[start..].find("</a>") {
                    let tag_end = result[start..].find('>').unwrap() + start + 1;
                    let text = &result[tag_end..start + end_pos];
                    result = format!("{}{}{}", &result[..start], text,
                        &result[start + end_pos + 4..]);
                    continue;
                }
            }
            break;
        }
        result
    }

    fn replace_images(&self, html: &str) -> String {
        let mut result = html.to_string();
        loop {
            if let Some(start) = result.find("<img ") {
                if let Some(end) = result[start..].find('>') {
                    let tag = &result[start..start + end + 1];
                    let src = self.extract_attr(tag, "src");
                    let alt = self.extract_attr(tag, "alt");
                    let md = format!("![{}]({})", alt, src);
                    result = format!("{}{}{}", &result[..start], md, &result[start + end + 1..]);
                    continue;
                }
            }
            break;
        }
        result
    }

    fn replace_blockquotes(&self, html: &str) -> String {
        let mut result = html.to_string();
        loop {
            if let Some(start) = result.find("<blockquote") {
                if let Some(end) = result[start..].find("</blockquote>") {
                    let tag_end = result[start..].find('>').unwrap() + start + 1;
                    let content = &result[tag_end..start + end];
                    let quoted: String = content.trim().lines()
                        .map(|l| format!("> {}", l.trim()))
                        .collect::<Vec<_>>()
                        .join("\n");
                    result = format!("{}\n\n{}\n\n{}", &result[..start], quoted,
                        &result[start + end + 13..]);
                    continue;
                }
            }
            break;
        }
        result
    }

    fn replace_unordered_lists(&self, html: &str) -> String {
        let mut result = html.to_string();
        loop {
            if let Some(start) = result.find("<ul") {
                if let Some(end) = result[start..].find("</ul>") {
                    let tag_end = result[start..].find('>').unwrap() + start + 1;
                    let content = &result[tag_end..start + end];
                    let items = self.extract_list_items(content);
                    let md: String = items.iter()
                        .map(|item| format!("- {}", item))
                        .collect::<Vec<_>>()
                        .join("\n");
                    result = format!("{}\n\n{}\n\n{}", &result[..start], md,
                        &result[start + end + 5..]);
                    continue;
                }
            }
            break;
        }
        result
    }

    fn replace_ordered_lists(&self, html: &str) -> String {
        let mut result = html.to_string();
        loop {
            if let Some(start) = result.find("<ol") {
                if let Some(end) = result[start..].find("</ol>") {
                    let tag_end = result[start..].find('>').unwrap() + start + 1;
                    let content = &result[tag_end..start + end];
                    let items = self.extract_list_items(content);
                    let md: String = items.iter().enumerate()
                        .map(|(i, item)| format!("{}. {}", i + 1, item))
                        .collect::<Vec<_>>()
                        .join("\n");
                    result = format!("{}\n\n{}\n\n{}", &result[..start], md,
                        &result[start + end + 5..]);
                    continue;
                }
            }
            break;
        }
        result
    }

    fn extract_list_items(&self, content: &str) -> Vec<String> {
        let mut items = Vec::new();
        let mut remaining = content;
        while let Some(start) = remaining.find("<li") {
            if let Some(end) = remaining[start..].find("</li>") {
                let tag_end = remaining[start..].find('>').unwrap() + start + 1;
                let text = remaining[tag_end..start + end].trim().to_string();
                items.push(text);
                remaining = &remaining[start + end + 5..];
            } else {
                break;
            }
        }
        items
    }

    fn replace_hr(&self, html: &str) -> String {
        let mut result = html.to_string();
        for pattern in &["<hr>", "<hr/>", "<hr />"] {
            result = result.replace(pattern, "\n\n---\n\n");
        }
        result
    }

    fn extract_attr(&self, tag: &str, attr: &str) -> String {
        let search = format!("{}=\"", attr);
        if let Some(pos) = tag.find(&search) {
            let start = pos + search.len();
            if let Some(end) = tag[start..].find('"') {
                return tag[start..start + end].to_string();
            }
        }
        let search_single = format!("{}='", attr);
        if let Some(pos) = tag.find(&search_single) {
            let start = pos + search_single.len();
            if let Some(end) = tag[start..].find('\'') {
                return tag[start..start + end].to_string();
            }
        }
        String::new()
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

    fn decode_entities(&self, text: &str) -> String {
        let mut result = text.to_string();
        let entities = [
            ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", "\""),
            ("&#39;", "'"), ("&apos;", "'"), ("&nbsp;", " "),
            ("&mdash;", "\u{2014}"), ("&ndash;", "\u{2013}"),
        ];
        for (entity, replacement) in &entities {
            result = result.replace(entity, replacement);
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

// Transform Plugin Provider: markdown_to_html
// Convert Markdown content to HTML syntax.
// See Architecture doc for transform plugin interface contract.

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "markdown_to_html";
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

pub struct MarkdownToHtmlTransformProvider;

impl MarkdownToHtmlTransformProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let md = match value {
            Value::Null => return Ok(Value::Null),
            Value::String(s) => s.clone(),
            _ => return Err(TransformError::InvalidInput("Expected string input".to_string())),
        };

        let wrap_in_div = match config.options.get("wrapInDiv") {
            Some(Value::Boolean(true)) => true,
            _ => false,
        };

        let mut result = md.replace("\r\n", "\n").replace('\r', "\n");

        // Code blocks (fenced) - process before inline patterns
        result = self.convert_code_blocks(&result);

        // Blockquotes
        result = self.convert_blockquotes(&result);

        // Headings
        result = self.convert_headings(&result);

        // Horizontal rules
        result = result.replace("\n---\n", "\n<hr>\n")
            .replace("\n***\n", "\n<hr>\n")
            .replace("\n___\n", "\n<hr>\n");

        // Unordered lists
        result = self.convert_unordered_lists(&result);

        // Ordered lists
        result = self.convert_ordered_lists(&result);

        // Images (before links)
        result = self.convert_images(&result);

        // Links
        result = self.convert_links(&result);

        // Inline code
        result = self.convert_inline_code(&result);

        // Bold
        result = self.convert_bold(&result);

        // Italic
        result = self.convert_italic(&result);

        // Strikethrough
        result = self.convert_strikethrough(&result);

        // Paragraphs
        result = self.convert_paragraphs(&result);

        if wrap_in_div {
            result = format!("<div>{}</div>", result);
        }

        Ok(Value::String(result))
    }

    fn convert_code_blocks(&self, md: &str) -> String {
        let mut result = String::new();
        let mut remaining = md;

        while let Some(start) = remaining.find("```") {
            result.push_str(&remaining[..start]);
            let after_ticks = &remaining[start + 3..];

            // Find language identifier (until newline)
            let lang_end = after_ticks.find('\n').unwrap_or(0);
            let lang = after_ticks[..lang_end].trim();

            let code_start = lang_end + 1;
            if let Some(end) = after_ticks[code_start..].find("```") {
                let code = &after_ticks[code_start..code_start + end];
                let lang_attr = if !lang.is_empty() {
                    format!(" class=\"language-{}\"", lang)
                } else {
                    String::new()
                };
                result.push_str(&format!("<pre><code{}>{}</code></pre>",
                    lang_attr, self.escape_html(code.trim_end())));
                remaining = &after_ticks[code_start + end + 3..];
            } else {
                result.push_str("```");
                remaining = after_ticks;
            }
        }
        result.push_str(remaining);
        result
    }

    fn convert_blockquotes(&self, md: &str) -> String {
        let lines: Vec<&str> = md.lines().collect();
        let mut result = Vec::new();
        let mut in_quote = false;
        let mut quote_content = Vec::new();

        for line in &lines {
            if line.starts_with("> ") || line.starts_with(">") {
                in_quote = true;
                let content = if line.starts_with("> ") {
                    &line[2..]
                } else {
                    &line[1..]
                };
                quote_content.push(content.to_string());
            } else {
                if in_quote {
                    result.push(format!("<blockquote>{}</blockquote>",
                        quote_content.join("\n")));
                    quote_content.clear();
                    in_quote = false;
                }
                result.push(line.to_string());
            }
        }
        if in_quote {
            result.push(format!("<blockquote>{}</blockquote>",
                quote_content.join("\n")));
        }
        result.join("\n")
    }

    fn convert_headings(&self, md: &str) -> String {
        let mut result = Vec::new();
        for line in md.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("######") {
                result.push(format!("<h6>{}</h6>", trimmed[6..].trim()));
            } else if trimmed.starts_with("#####") {
                result.push(format!("<h5>{}</h5>", trimmed[5..].trim()));
            } else if trimmed.starts_with("####") {
                result.push(format!("<h4>{}</h4>", trimmed[4..].trim()));
            } else if trimmed.starts_with("###") {
                result.push(format!("<h3>{}</h3>", trimmed[3..].trim()));
            } else if trimmed.starts_with("##") {
                result.push(format!("<h2>{}</h2>", trimmed[2..].trim()));
            } else if trimmed.starts_with("# ") {
                result.push(format!("<h1>{}</h1>", trimmed[2..].trim()));
            } else {
                result.push(line.to_string());
            }
        }
        result.join("\n")
    }

    fn convert_unordered_lists(&self, md: &str) -> String {
        let lines: Vec<&str> = md.lines().collect();
        let mut result = Vec::new();
        let mut in_list = false;
        let mut items = Vec::new();

        for line in &lines {
            let trimmed = line.trim();
            if (trimmed.starts_with("- ") || trimmed.starts_with("* ") || trimmed.starts_with("+ "))
                && !trimmed.starts_with("---")
            {
                if !in_list {
                    in_list = true;
                }
                let content = &trimmed[2..];
                items.push(format!("<li>{}</li>", content));
            } else {
                if in_list {
                    result.push(format!("<ul>\n{}\n</ul>", items.join("\n")));
                    items.clear();
                    in_list = false;
                }
                result.push(line.to_string());
            }
        }
        if in_list {
            result.push(format!("<ul>\n{}\n</ul>", items.join("\n")));
        }
        result.join("\n")
    }

    fn convert_ordered_lists(&self, md: &str) -> String {
        let lines: Vec<&str> = md.lines().collect();
        let mut result = Vec::new();
        let mut in_list = false;
        let mut items = Vec::new();

        for line in &lines {
            let trimmed = line.trim();
            // Check if line starts with number followed by ". "
            if let Some(dot_pos) = trimmed.find(". ") {
                let prefix = &trimmed[..dot_pos];
                if prefix.chars().all(|c| c.is_ascii_digit()) && !prefix.is_empty() {
                    if !in_list {
                        in_list = true;
                    }
                    let content = &trimmed[dot_pos + 2..];
                    items.push(format!("<li>{}</li>", content));
                    continue;
                }
            }
            if in_list {
                result.push(format!("<ol>\n{}\n</ol>", items.join("\n")));
                items.clear();
                in_list = false;
            }
            result.push(line.to_string());
        }
        if in_list {
            result.push(format!("<ol>\n{}\n</ol>", items.join("\n")));
        }
        result.join("\n")
    }

    fn convert_images(&self, md: &str) -> String {
        let mut result = md.to_string();
        while let Some(start) = result.find("![") {
            if let Some(alt_end) = result[start + 2..].find("](") {
                let alt = &result[start + 2..start + 2 + alt_end];
                let url_start = start + 2 + alt_end + 2;
                if let Some(url_end) = result[url_start..].find(')') {
                    let url = &result[url_start..url_start + url_end];
                    let html = format!("<img src=\"{}\" alt=\"{}\">", url, alt);
                    result = format!("{}{}{}", &result[..start], html,
                        &result[url_start + url_end + 1..]);
                    continue;
                }
            }
            break;
        }
        result
    }

    fn convert_links(&self, md: &str) -> String {
        let mut result = md.to_string();
        loop {
            // Find [ not preceded by !
            let start = {
                let mut found = None;
                let bytes = result.as_bytes();
                for i in 0..bytes.len() {
                    if bytes[i] == b'[' && (i == 0 || bytes[i - 1] != b'!') {
                        found = Some(i);
                        break;
                    }
                }
                found
            };

            if let Some(start) = start {
                if let Some(text_end) = result[start + 1..].find("](") {
                    let text = result[start + 1..start + 1 + text_end].to_string();
                    let url_start = start + 1 + text_end + 2;
                    if let Some(url_end) = result[url_start..].find(')') {
                        let url = result[url_start..url_start + url_end].to_string();
                        let html = format!("<a href=\"{}\">{}</a>", url, text);
                        result = format!("{}{}{}", &result[..start], html,
                            &result[url_start + url_end + 1..]);
                        continue;
                    }
                }
            }
            break;
        }
        result
    }

    fn convert_inline_code(&self, md: &str) -> String {
        let mut result = String::new();
        let mut chars = md.chars().peekable();
        while let Some(ch) = chars.next() {
            if ch == '`' {
                let mut code = String::new();
                let mut found_end = false;
                while let Some(next) = chars.next() {
                    if next == '`' {
                        found_end = true;
                        break;
                    }
                    code.push(next);
                }
                if found_end {
                    result.push_str(&format!("<code>{}</code>", code));
                } else {
                    result.push('`');
                    result.push_str(&code);
                }
            } else {
                result.push(ch);
            }
        }
        result
    }

    fn convert_bold(&self, md: &str) -> String {
        let mut result = md.to_string();
        while let Some(start) = result.find("**") {
            if let Some(end) = result[start + 2..].find("**") {
                let content = &result[start + 2..start + 2 + end];
                let html = format!("<strong>{}</strong>", content);
                result = format!("{}{}{}", &result[..start], html,
                    &result[start + 2 + end + 2..]);
            } else {
                break;
            }
        }
        while let Some(start) = result.find("__") {
            if let Some(end) = result[start + 2..].find("__") {
                let content = &result[start + 2..start + 2 + end];
                let html = format!("<strong>{}</strong>", content);
                result = format!("{}{}{}", &result[..start], html,
                    &result[start + 2 + end + 2..]);
            } else {
                break;
            }
        }
        result
    }

    fn convert_italic(&self, md: &str) -> String {
        let mut result = md.to_string();
        // Single * for italic (but not **)
        let chars: Vec<char> = result.chars().collect();
        let mut new_result = String::new();
        let mut i = 0;
        while i < chars.len() {
            if chars[i] == '*' && (i + 1 >= chars.len() || chars[i + 1] != '*')
                && (i == 0 || chars[i - 1] != '*')
            {
                // Find closing *
                if let Some(end) = chars[i + 1..].iter().position(|&c| c == '*') {
                    let content: String = chars[i + 1..i + 1 + end].iter().collect();
                    new_result.push_str(&format!("<em>{}</em>", content));
                    i = i + 1 + end + 1;
                    continue;
                }
            }
            new_result.push(chars[i]);
            i += 1;
        }
        new_result
    }

    fn convert_strikethrough(&self, md: &str) -> String {
        let mut result = md.to_string();
        while let Some(start) = result.find("~~") {
            if let Some(end) = result[start + 2..].find("~~") {
                let content = &result[start + 2..start + 2 + end];
                let html = format!("<del>{}</del>", content);
                result = format!("{}{}{}", &result[..start], html,
                    &result[start + 2 + end + 2..]);
            } else {
                break;
            }
        }
        result
    }

    fn convert_paragraphs(&self, md: &str) -> String {
        let blocks: Vec<&str> = md.split("\n\n").collect();
        let mut result = Vec::new();

        for block in blocks {
            let trimmed = block.trim();
            if trimmed.is_empty() {
                continue;
            }
            if trimmed.starts_with('<') {
                result.push(trimmed.to_string());
            } else {
                result.push(format!("<p>{}</p>", trimmed));
            }
        }
        result.join("\n")
    }

    fn escape_html(&self, s: &str) -> String {
        s.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
    }

    pub fn input_type(&self) -> TypeSpec {
        TypeSpec { type_name: "string".to_string(), nullable: true }
    }

    pub fn output_type(&self) -> TypeSpec {
        TypeSpec { type_name: "string".to_string(), nullable: true }
    }
}

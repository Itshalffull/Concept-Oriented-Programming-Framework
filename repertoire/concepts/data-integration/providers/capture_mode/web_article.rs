// Data Integration Kit - Web Article Capture Provider
// Extracts article content via Readability-style algorithm with scoring heuristics

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "web_article";
pub const PLUGIN_TYPE: &str = "capture_mode";

#[derive(Debug, Clone)]
pub struct CaptureInput {
    pub url: Option<String>,
    pub file: Option<Vec<u8>>,
    pub email: Option<String>,
    pub share_data: Option<serde_json::Value>,
}

#[derive(Debug, Clone)]
pub struct CaptureConfig {
    pub mode: String,
    pub options: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone)]
pub struct SourceMetadata {
    pub title: String,
    pub url: Option<String>,
    pub captured_at: String,
    pub content_type: String,
    pub author: Option<String>,
    pub tags: Option<Vec<String>>,
    pub source: Option<String>,
}

#[derive(Debug, Clone)]
pub struct CaptureItem {
    pub content: String,
    pub source_metadata: SourceMetadata,
    pub raw_data: Option<String>,
}

#[derive(Debug)]
pub enum CaptureError {
    MissingUrl,
    FetchError(String),
    ParseError(String),
}

impl std::fmt::Display for CaptureError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CaptureError::MissingUrl => write!(f, "web_article capture requires a URL"),
            CaptureError::FetchError(e) => write!(f, "Fetch error: {}", e),
            CaptureError::ParseError(e) => write!(f, "Parse error: {}", e),
        }
    }
}

fn is_negative_class(s: &str) -> bool {
    let lower = s.to_lowercase();
    ["comment", "footer", "header", "menu", "nav", "sidebar", "sponsor", "ad", "popup", "rss"]
        .iter().any(|pat| lower.contains(pat))
}

fn is_positive_class(s: &str) -> bool {
    let lower = s.to_lowercase();
    ["article", "content", "entry", "main", "post", "text", "body", "blog", "story"]
        .iter().any(|pat| lower.contains(pat))
}

fn score_element(tag: &str, class: &str, id: &str) -> i32 {
    let mut score: i32 = match tag {
        "article" => 30,
        "section" => 10,
        "div" => 5,
        "p" => 3,
        _ => 0,
    };
    let combined = format!("{} {}", class, id);
    if is_positive_class(&combined) { score += 25; }
    if is_negative_class(&combined) { score -= 25; }
    score
}

fn strip_non_content(html: &str) -> String {
    let mut result = html.to_string();
    for tag in &["script", "style", "nav", "footer", "header", "aside", "iframe", "noscript"] {
        let pattern = format!(r"(?i)<{0}[^>]*>[\s\S]*?</{0}>", tag);
        if let Ok(re) = regex::Regex::new(&pattern) {
            result = re.replace_all(&result, "").to_string();
        }
    }
    if let Ok(re) = regex::Regex::new(r"<!--[\s\S]*?-->") {
        result = re.replace_all(&result, "").to_string();
    }
    result
}

fn extract_text(html: &str) -> String {
    let mut text = html.to_string();
    text = regex::Regex::new(r"(?i)<br\s*/?>").unwrap().replace_all(&text, "\n").to_string();
    text = regex::Regex::new(r"(?i)</p>").unwrap().replace_all(&text, "\n\n").to_string();
    text = regex::Regex::new(r"<[^>]+>").unwrap().replace_all(&text, "").to_string();
    text = text.replace("&nbsp;", " ").replace("&amp;", "&")
        .replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"");
    text.trim().to_string()
}

fn extract_meta<'a>(html: &'a str, patterns: &[&str]) -> Option<String> {
    for pat in patterns {
        if let Ok(re) = regex::Regex::new(pat) {
            if let Some(caps) = re.captures(html) {
                if let Some(m) = caps.get(1) {
                    let val = m.as_str().trim();
                    if !val.is_empty() { return Some(val.to_string()); }
                }
            }
        }
    }
    None
}

fn find_main_content(html: &str) -> String {
    let cleaned = strip_non_content(html);
    let block_re = regex::Regex::new(
        r"(?is)<(div|section|article|main)\b([^>]*)>([\s\S]*?)</\1>"
    ).unwrap();

    let mut best_score = i32::MIN;
    let mut best_content = String::new();
    let class_re = regex::Regex::new(r#"class=["']([^"']+)["']"#).unwrap();
    let id_re = regex::Regex::new(r#"id=["']([^"']+)["']"#).unwrap();
    let p_re = regex::Regex::new(r"(?i)<p[\s>]").unwrap();

    for caps in block_re.captures_iter(&cleaned) {
        let tag = caps.get(1).map(|m| m.as_str()).unwrap_or("");
        let attrs = caps.get(2).map(|m| m.as_str()).unwrap_or("");
        let inner = caps.get(3).map(|m| m.as_str()).unwrap_or("");

        let class = class_re.captures(attrs).and_then(|c| c.get(1)).map(|m| m.as_str()).unwrap_or("");
        let id = id_re.captures(attrs).and_then(|c| c.get(1)).map(|m| m.as_str()).unwrap_or("");

        let paragraph_count = p_re.find_iter(inner).count() as i32;
        let text_len = extract_text(inner).len() as i32;
        let mut score = score_element(tag, class, id);
        score += paragraph_count * 3;
        score += std::cmp::min(text_len / 100, 20);

        if score > best_score {
            best_score = score;
            best_content = inner.to_string();
        }
    }

    if best_content.is_empty() { cleaned } else { best_content }
}

pub struct WebArticleCaptureProvider;

impl WebArticleCaptureProvider {
    pub fn new() -> Self { Self }

    pub fn capture(&self, input: &CaptureInput, config: &CaptureConfig) -> Result<CaptureItem, CaptureError> {
        let url = input.url.as_ref().ok_or(CaptureError::MissingUrl)?;
        let html = http_get(url).map_err(|e| CaptureError::FetchError(e.to_string()))?;

        let title = extract_meta(&html, &[
            r#"(?i)og:title["']\s+content=["']([^"']+)"#,
            r"(?i)<title>([^<]+)</title>",
        ]).unwrap_or_else(|| "Untitled".to_string());

        let author = extract_meta(&html, &[
            r#"(?i)name=["']author["']\s+content=["']([^"']+)"#,
        ]);

        let main_html = find_main_content(&html);
        let content = extract_text(&main_html);

        Ok(CaptureItem {
            content,
            source_metadata: SourceMetadata {
                title,
                url: Some(url.clone()),
                captured_at: chrono::Utc::now().to_rfc3339(),
                content_type: "text/html".to_string(),
                author,
                tags: Some(vec!["article".to_string()]),
                source: Some("web_article".to_string()),
            },
            raw_data: if config.options.as_ref().and_then(|o| o.get("includeRaw")).is_some() {
                Some(html)
            } else {
                None
            },
        })
    }

    pub fn supports(&self, input: &CaptureInput) -> bool {
        input.url.as_ref().map_or(false, |u| {
            u.starts_with("http://") || u.starts_with("https://")
        })
    }
}

fn http_get(url: &str) -> Result<String, CaptureError> {
    // Platform HTTP integration point - delegates to runtime HTTP client
    Err(CaptureError::FetchError(format!("HTTP client not configured for: {}", url)))
}

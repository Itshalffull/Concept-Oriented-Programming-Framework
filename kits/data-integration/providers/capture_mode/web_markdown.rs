// Data Integration Kit - Web Markdown Capture Provider
// HTML to Markdown conversion with Readability extraction and YAML frontmatter

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "web_markdown";
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
            CaptureError::MissingUrl => write!(f, "web_markdown capture requires a URL"),
            CaptureError::FetchError(e) => write!(f, "Fetch error: {}", e),
            CaptureError::ParseError(e) => write!(f, "Parse error: {}", e),
        }
    }
}

#[derive(Debug, Default)]
struct ArticleMeta {
    title: String,
    author: Option<String>,
    date: Option<String>,
    description: Option<String>,
    tags: Vec<String>,
}

fn extract_meta(html: &str, property: &str) -> Option<String> {
    let pat = format!(
        r#"(?i)<meta[^>]+(?:property|name)=["']{}["'][^>]+content=["']([^"']+)["']"#,
        regex::escape(property)
    );
    regex::Regex::new(&pat).ok()
        .and_then(|re| re.captures(html))
        .and_then(|caps| caps.get(1).map(|m| m.as_str().trim().to_string()))
}

fn extract_article_meta(html: &str) -> ArticleMeta {
    let title = extract_meta(html, "og:title")
        .or_else(|| {
            regex::Regex::new(r"(?i)<title>([^<]+)</title>").ok()
                .and_then(|re| re.captures(html))
                .map(|caps| caps[1].trim().to_string())
        })
        .unwrap_or_else(|| "Untitled".to_string());

    let author = extract_meta(html, "author").or_else(|| extract_meta(html, "article:author"));
    let date = extract_meta(html, "article:published_time").or_else(|| extract_meta(html, "date"));
    let description = extract_meta(html, "og:description").or_else(|| extract_meta(html, "description"));

    let tags_str = extract_meta(html, "article:tag").or_else(|| extract_meta(html, "keywords"));
    let tags = tags_str.map(|t| t.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect())
        .unwrap_or_default();

    ArticleMeta { title, author, date, description, tags }
}

fn strip_non_content(html: &str) -> String {
    let mut result = html.to_string();
    for tag in &["script", "style", "nav", "footer", "header", "aside", "iframe", "noscript"] {
        let pat = format!(r"(?is)<{0}[^>]*>[\s\S]*?</{0}>", tag);
        if let Ok(re) = regex::Regex::new(&pat) {
            result = re.replace_all(&result, "").to_string();
        }
    }
    result
}

fn strip_tags(html: &str) -> String {
    regex::Regex::new(r"<[^>]+>").unwrap().replace_all(html, "").to_string()
}

fn decode_entities(text: &str) -> String {
    text.replace("&nbsp;", " ").replace("&amp;", "&")
        .replace("&lt;", "<").replace("&gt;", ">")
        .replace("&quot;", "\"").replace("&#39;", "'")
}

fn html_to_markdown(html: &str) -> String {
    let mut md = html.to_string();

    // Headings h1-h6
    for i in 1..=6 {
        let prefix = "#".repeat(i);
        let pat = format!(r"(?is)<h{}[^>]*>([\s\S]*?)</h{}>", i, i);
        if let Ok(re) = regex::Regex::new(&pat) {
            md = re.replace_all(&md, |caps: &regex::Captures| {
                format!("\n{} {}\n", prefix, strip_tags(&caps[1]).trim())
            }).to_string();
        }
    }

    // Bold
    if let Ok(re) = regex::Regex::new(r"(?is)<(?:strong|b)>([\s\S]*?)</(?:strong|b)>") {
        md = re.replace_all(&md, |caps: &regex::Captures| format!("**{}**", strip_tags(&caps[1]))).to_string();
    }

    // Italic
    if let Ok(re) = regex::Regex::new(r"(?is)<(?:em|i)>([\s\S]*?)</(?:em|i)>") {
        md = re.replace_all(&md, |caps: &regex::Captures| format!("*{}*", strip_tags(&caps[1]))).to_string();
    }

    // Links
    if let Ok(re) = regex::Regex::new(r#"(?is)<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)</a>"#) {
        md = re.replace_all(&md, |caps: &regex::Captures| {
            format!("[{}]({})", strip_tags(&caps[2]).trim(), &caps[1])
        }).to_string();
    }

    // Code blocks
    if let Ok(re) = regex::Regex::new(r#"(?is)<pre[^>]*>\s*<code[^>]*(?:class=["']language-(\w+)["'][^>]*)?>([\\s\\S]*?)</code>\s*</pre>"#) {
        md = re.replace_all(&md, |caps: &regex::Captures| {
            let lang = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            format!("\n```{}\n{}\n```\n", lang, decode_entities(&caps[2]).trim())
        }).to_string();
    }

    // Inline code
    if let Ok(re) = regex::Regex::new(r"(?is)<code>([\s\S]*?)</code>") {
        md = re.replace_all(&md, |caps: &regex::Captures| format!("`{}`", decode_entities(&caps[1]))).to_string();
    }

    // Blockquotes
    if let Ok(re) = regex::Regex::new(r"(?is)<blockquote[^>]*>([\s\S]*?)</blockquote>") {
        md = re.replace_all(&md, |caps: &regex::Captures| {
            let text = strip_tags(&caps[1]).trim().to_string();
            let lines: Vec<String> = text.lines().map(|l| format!("> {}", l)).collect();
            format!("\n{}\n", lines.join("\n"))
        }).to_string();
    }

    // Unordered lists
    if let Ok(ul_re) = regex::Regex::new(r"(?is)<ul[^>]*>([\s\S]*?)</ul>") {
        md = ul_re.replace_all(&md, |caps: &regex::Captures| {
            let items = &caps[1];
            if let Ok(li_re) = regex::Regex::new(r"(?is)<li[^>]*>([\s\S]*?)</li>") {
                let result: Vec<String> = li_re.captures_iter(items)
                    .map(|c| format!("- {}", strip_tags(&c[1]).trim()))
                    .collect();
                return format!("\n{}\n", result.join("\n"));
            }
            String::new()
        }).to_string();
    }

    // Ordered lists
    if let Ok(ol_re) = regex::Regex::new(r"(?is)<ol[^>]*>([\s\S]*?)</ol>") {
        md = ol_re.replace_all(&md, |caps: &regex::Captures| {
            let items = &caps[1];
            if let Ok(li_re) = regex::Regex::new(r"(?is)<li[^>]*>([\s\S]*?)</li>") {
                let result: Vec<String> = li_re.captures_iter(items).enumerate()
                    .map(|(i, c)| format!("{}. {}", i + 1, strip_tags(&c[1]).trim()))
                    .collect();
                return format!("\n{}\n", result.join("\n"));
            }
            String::new()
        }).to_string();
    }

    // Tables
    if let Ok(table_re) = regex::Regex::new(r"(?is)<table[^>]*>([\s\S]*?)</table>") {
        md = table_re.replace_all(&md, |caps: &regex::Captures| convert_table(&caps[1])).to_string();
    }

    // HR
    md = regex::Regex::new(r"(?i)<hr\s*/?>").unwrap().replace_all(&md, "\n---\n").to_string();
    // BR and P
    md = regex::Regex::new(r"(?i)<br\s*/?>").unwrap().replace_all(&md, "\n").to_string();
    if let Ok(re) = regex::Regex::new(r"(?is)<p[^>]*>([\s\S]*?)</p>") {
        md = re.replace_all(&md, |caps: &regex::Captures| format!("\n{}\n", strip_tags(&caps[1]).trim())).to_string();
    }

    md = strip_tags(&md);
    md = decode_entities(&md);
    regex::Regex::new(r"\n{3,}").unwrap().replace_all(&md, "\n\n").trim().to_string()
}

fn convert_table(html: &str) -> String {
    let row_re = regex::Regex::new(r"(?is)<tr[^>]*>([\s\S]*?)</tr>").unwrap();
    let cell_re = regex::Regex::new(r"(?is)<(?:td|th)[^>]*>([\s\S]*?)</(?:td|th)>").unwrap();

    let mut rows: Vec<Vec<String>> = Vec::new();
    for row_caps in row_re.captures_iter(html) {
        let cells: Vec<String> = cell_re.captures_iter(&row_caps[1])
            .map(|c| strip_tags(&c[1]).trim().to_string())
            .collect();
        if !cells.is_empty() { rows.push(cells); }
    }
    if rows.is_empty() { return String::new(); }

    let max_cols = rows.iter().map(|r| r.len()).max().unwrap_or(0);
    let mut lines = Vec::new();
    for (i, row) in rows.iter().enumerate() {
        let padded: Vec<&str> = (0..max_cols).map(|j| row.get(j).map(|s| s.as_str()).unwrap_or("")).collect();
        lines.push(format!("| {} |", padded.join(" | ")));
        if i == 0 {
            lines.push(format!("| {} |", vec!["---"; max_cols].join(" | ")));
        }
    }
    format!("\n{}\n", lines.join("\n"))
}

fn generate_frontmatter(meta: &ArticleMeta, url: &str) -> String {
    let mut lines = vec!["---".to_string()];
    lines.push(format!("title: \"{}\"", meta.title.replace('"', "\\\"")));
    if let Some(ref author) = meta.author { lines.push(format!("author: \"{}\"", author)); }
    if let Some(ref date) = meta.date { lines.push(format!("date: \"{}\"", date)); }
    lines.push(format!("source: \"{}\"", url));
    if let Some(ref desc) = meta.description { lines.push(format!("description: \"{}\"", desc.replace('"', "\\\""))); }
    if !meta.tags.is_empty() {
        let tags_str: Vec<String> = meta.tags.iter().map(|t| format!("\"{}\"", t)).collect();
        lines.push(format!("tags: [{}]", tags_str.join(", ")));
    }
    lines.push("---".to_string());
    lines.join("\n")
}

pub struct WebMarkdownCaptureProvider;

impl WebMarkdownCaptureProvider {
    pub fn new() -> Self { Self }

    pub fn capture(&self, input: &CaptureInput, config: &CaptureConfig) -> Result<CaptureItem, CaptureError> {
        let url = input.url.as_ref().ok_or(CaptureError::MissingUrl)?;
        let html = http_get(url).map_err(|e| CaptureError::FetchError(e.to_string()))?;

        let meta = extract_article_meta(&html);
        let cleaned = strip_non_content(&html);
        let markdown = html_to_markdown(&cleaned);

        let include_frontmatter = config.options.as_ref()
            .and_then(|o| o.get("frontmatter").and_then(|v| v.as_bool()))
            .unwrap_or(true);

        let content = if include_frontmatter {
            format!("{}\n\n{}", generate_frontmatter(&meta, url), markdown)
        } else {
            markdown
        };

        let mut tags = vec!["markdown".to_string()];
        tags.extend(meta.tags.clone());

        Ok(CaptureItem {
            content,
            source_metadata: SourceMetadata {
                title: meta.title,
                url: Some(url.clone()),
                captured_at: chrono::Utc::now().to_rfc3339(),
                content_type: "text/markdown".to_string(),
                author: meta.author,
                tags: Some(tags),
                source: Some("web_markdown".to_string()),
            },
            raw_data: if config.options.as_ref().and_then(|o| o.get("includeHtml")).is_some() {
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
    Err(CaptureError::FetchError(format!("HTTP client not configured for: {}", url)))
}

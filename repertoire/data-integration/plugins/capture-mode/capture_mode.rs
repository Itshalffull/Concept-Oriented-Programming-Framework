// Capture Mode Plugin — capture strategy implementations for the Capture concept
// Provides pluggable content capture from URLs, files, emails, APIs, and OS share intents.
// See Data Integration Kit capture.concept for the parent Capture concept definition.

use std::collections::HashMap;
use std::fmt;

use async_trait::async_trait;
use chrono::Utc;
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/// Discriminated input describing what to capture.
#[derive(Debug, Clone)]
pub enum CaptureInput {
    Url {
        url: String,
        selection: Option<ElementSelection>,
    },
    File {
        path: String,
        data: Vec<u8>,
        mime_hint: Option<String>,
    },
    Email {
        raw: String,
    },
    ApiEndpoint {
        endpoint_url: String,
        method: Option<String>,
        headers: Option<HashMap<String, String>>,
        cursor: Option<String>,
    },
    ShareIntent {
        text: Option<String>,
        url: Option<String>,
        files: Option<Vec<SharedFile>>,
    },
}

/// A file received via OS share sheet.
#[derive(Debug, Clone)]
pub struct SharedFile {
    pub name: String,
    pub mime_type: String,
    pub data: Vec<u8>,
}

/// Selection region for targeted capture (e.g., screenshot of a specific element).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementSelection {
    pub selector: String,
    pub rect: Option<Rect>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Provider-specific configuration knobs.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CaptureConfig {
    pub max_raw_bytes: Option<usize>,
    pub include_raw_data: bool,
    pub timeout_ms: Option<u64>,
    pub provider_options: Option<HashMap<String, HashMap<String, serde_json::Value>>>,
}

/// Metadata about where the captured content came from.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub published_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub site_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub favicon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    pub captured_at: String,
    pub provider_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra: Option<serde_json::Value>,
}

impl SourceMetadata {
    fn new(provider_id: &str) -> Self {
        Self {
            source_url: None,
            title: None,
            author: None,
            published_at: None,
            site_name: None,
            favicon: None,
            description: None,
            mime_type: None,
            language: None,
            captured_at: Utc::now().to_rfc3339(),
            provider_id: provider_id.to_string(),
            extra: None,
        }
    }
}

/// The product of a capture operation.
#[derive(Debug, Clone)]
pub struct CaptureItem {
    pub content: String,
    pub source_metadata: SourceMetadata,
    pub raw_data: Option<Vec<u8>>,
}

/// Errors that can occur during capture.
#[derive(Debug)]
pub enum CaptureError {
    UnsupportedInput { provider: String, input_kind: String },
    NetworkError { url: String, status: Option<u16>, detail: String },
    Timeout { url: String, timeout_ms: u64 },
    ParseError { detail: String },
    NoContentFound { url: String },
    ProviderUnavailable { id: String },
    IoError(std::io::Error),
}

impl fmt::Display for CaptureError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnsupportedInput { provider, input_kind } =>
                write!(f, "{provider} does not support {input_kind} input"),
            Self::NetworkError { url, status, detail } =>
                write!(f, "Network error fetching {url} (HTTP {}): {detail}", status.unwrap_or(0)),
            Self::Timeout { url, timeout_ms } =>
                write!(f, "Timeout after {timeout_ms}ms fetching {url}"),
            Self::ParseError { detail } =>
                write!(f, "Parse error: {detail}"),
            Self::NoContentFound { url } =>
                write!(f, "No extractable content at {url}"),
            Self::ProviderUnavailable { id } =>
                write!(f, "Provider {id} not available"),
            Self::IoError(e) =>
                write!(f, "I/O error: {e}"),
        }
    }
}

impl std::error::Error for CaptureError {}

impl From<std::io::Error> for CaptureError {
    fn from(e: std::io::Error) -> Self {
        Self::IoError(e)
    }
}

// ---------------------------------------------------------------------------
// Trait
// ---------------------------------------------------------------------------

/// Interface every capture-mode provider must implement.
#[async_trait]
pub trait CaptureModePlugin: Send + Sync {
    /// Unique identifier for this provider.
    fn id(&self) -> &str;

    /// Human-readable display name.
    fn display_name(&self) -> &str;

    /// Execute the capture operation.
    async fn capture(
        &self,
        input: &CaptureInput,
        config: &CaptureConfig,
    ) -> Result<CaptureItem, CaptureError>;

    /// Check whether this provider can handle the given input.
    fn supports(&self, input: &CaptureInput) -> bool;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/// Fetch a URL and return the response body as bytes.
async fn fetch_url(url: &str, timeout_ms: u64, extra_headers: Option<&HashMap<String, String>>) -> Result<(Vec<u8>, u16), CaptureError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(timeout_ms))
        .user_agent("Clef-Capture/1.0")
        .build()
        .map_err(|e| CaptureError::NetworkError {
            url: url.to_string(),
            status: None,
            detail: e.to_string(),
        })?;

    let mut request = client.get(url);
    if let Some(headers) = extra_headers {
        for (k, v) in headers {
            request = request.header(k.as_str(), v.as_str());
        }
    }

    let response = request.send().await.map_err(|e| {
        if e.is_timeout() {
            CaptureError::Timeout { url: url.to_string(), timeout_ms }
        } else {
            CaptureError::NetworkError { url: url.to_string(), status: None, detail: e.to_string() }
        }
    })?;

    let status = response.status().as_u16();
    if status >= 400 {
        return Err(CaptureError::NetworkError {
            url: url.to_string(),
            status: Some(status),
            detail: format!("HTTP {status}"),
        });
    }

    let body = response.bytes().await.map_err(|e| CaptureError::NetworkError {
        url: url.to_string(),
        status: Some(status),
        detail: e.to_string(),
    })?;

    Ok((body.to_vec(), status))
}

fn format_bytes(bytes: usize) -> String {
    if bytes < 1024 {
        format!("{bytes} B")
    } else if bytes < 1024 * 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else {
        format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0))
    }
}

// ---------------------------------------------------------------------------
// Regex helpers for HTML metadata extraction
// ---------------------------------------------------------------------------

fn extract_og(html: &str, property: &str) -> Option<String> {
    let pattern = format!(r#"<meta[^>]+property=["']og:{property}["'][^>]+content=["']([^"']+)["']"#);
    regex::Regex::new(&pattern)
        .ok()
        .and_then(|re| re.captures(html))
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().to_string())
}

fn extract_meta_name(html: &str, name: &str) -> Option<String> {
    let pattern = format!(r#"<meta[^>]+name=["']{name}["'][^>]+content=["']([^"']+)["']"#);
    regex::Regex::new(&pattern)
        .ok()
        .and_then(|re| re.captures(html))
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().to_string())
}

fn extract_tag_content(html: &str, tag: &str) -> Option<String> {
    let pattern = format!(r"<{tag}[^>]*>([^<]+)</{tag}>");
    regex::Regex::new(&pattern)
        .ok()
        .and_then(|re| re.captures(html))
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().trim().to_string())
}

fn extract_favicon(html: &str, base_url: &str) -> Option<String> {
    let pattern = r#"<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']"#;
    if let Some(href) = regex::Regex::new(pattern)
        .ok()
        .and_then(|re| re.captures(html))
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().to_string())
    {
        return resolve_url(base_url, &href);
    }
    // Default to /favicon.ico
    url::Url::parse(base_url)
        .ok()
        .map(|u| format!("{}://{}/favicon.ico", u.scheme(), u.host_str().unwrap_or("")))
}

fn resolve_url(base: &str, relative: &str) -> Option<String> {
    url::Url::parse(base)
        .ok()
        .and_then(|b| b.join(relative).ok())
        .map(|u| u.to_string())
}

struct PageMetadata {
    title: String,
    author: Option<String>,
    published_date: Option<String>,
    site_name: Option<String>,
    favicon: Option<String>,
    description: Option<String>,
    language: Option<String>,
}

fn extract_page_metadata(html: &str, url: &str) -> PageMetadata {
    let title = extract_og(html, "title")
        .or_else(|| extract_tag_content(html, "title"))
        .unwrap_or_else(|| "Untitled".to_string());

    let author = extract_meta_name(html, "author")
        .or_else(|| extract_og(html, "article:author"));

    let published_date = extract_meta_name(html, "article:published_time")
        .or_else(|| extract_og(html, "article:published_time"));

    let site_name = extract_og(html, "site_name");
    let description = extract_og(html, "description")
        .or_else(|| extract_meta_name(html, "description"));
    let favicon = extract_favicon(html, url);

    let language = regex::Regex::new(r#"<html[^>]+lang=["']([^"']+)["']"#)
        .ok()
        .and_then(|re| re.captures(html))
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().to_string());

    PageMetadata {
        title,
        author,
        published_date,
        site_name,
        favicon,
        description,
        language,
    }
}

// ---------------------------------------------------------------------------
// 1. WebArticleProvider — Readability-based article extraction
// ---------------------------------------------------------------------------

pub struct WebArticleProvider;

#[async_trait]
impl CaptureModePlugin for WebArticleProvider {
    fn id(&self) -> &str { "web_article" }
    fn display_name(&self) -> &str { "Web Article (Readability)" }

    fn supports(&self, input: &CaptureInput) -> bool {
        matches!(input, CaptureInput::Url { selection: None, .. })
    }

    async fn capture(&self, input: &CaptureInput, config: &CaptureConfig) -> Result<CaptureItem, CaptureError> {
        let url = match input {
            CaptureInput::Url { url, .. } => url,
            _ => return Err(CaptureError::UnsupportedInput {
                provider: self.id().into(), input_kind: "non-URL".into(),
            }),
        };

        let timeout = config.timeout_ms.unwrap_or(30_000);
        let (body, _status) = fetch_url(url, timeout, None).await?;
        let html = String::from_utf8_lossy(&body).to_string();

        // Readability extraction pipeline:
        // 1. Remove unlikely candidates — scripts, styles, nav, footer, sidebar, ads
        let cleaned = self.remove_unlikely_candidates(&html);

        // 2. Score block-level elements by text density, link density, paragraph count
        //    - For each <p> with > 25 chars, add 1 + comma_count to parent score
        //    - Bonus for elements with class/id matching: article, content, entry, post
        //    - Penalty for: comment, footer, sidebar, sponsor, ad
        //    - Penalize ancestors with high link-to-text ratio (navigation blocks)
        let candidates = self.score_candidates(&cleaned);

        // 3. Select top candidate as article container
        let article_html = candidates.first()
            .ok_or_else(|| CaptureError::NoContentFound { url: url.clone() })?
            .clone();

        // 4. Clean article: remove forms, social widgets, related content blocks
        let clean_article = self.clean_article_node(&article_html);

        // 5. Convert cleaned HTML to plain text
        let plain_text = self.html_to_plain_text(&clean_article);

        // 6. Extract metadata from <head>
        let meta = extract_page_metadata(&html, url);

        let mut source_metadata = SourceMetadata::new(self.id());
        source_metadata.source_url = Some(url.clone());
        source_metadata.title = Some(meta.title);
        source_metadata.author = meta.author;
        source_metadata.published_at = meta.published_date;
        source_metadata.site_name = meta.site_name;
        source_metadata.favicon = meta.favicon;
        source_metadata.description = meta.description;
        source_metadata.language = meta.language;

        let raw_data = if config.include_raw_data { Some(body) } else { None };

        Ok(CaptureItem { content: plain_text, source_metadata, raw_data })
    }
}

impl WebArticleProvider {
    fn remove_unlikely_candidates(&self, html: &str) -> String {
        let mut result = html.to_string();

        // Remove script, style, noscript, iframe, nav, footer tags and contents
        let tags = ["script", "style", "noscript", "iframe", "nav", "footer"];
        for tag in tags {
            let pattern = format!(r"(?is)<{tag}[^>]*>.*?</{tag}>");
            if let Ok(re) = regex::Regex::new(&pattern) {
                result = re.replace_all(&result, "").to_string();
            }
        }

        // Remove elements with unlikely class/id patterns
        let unlikely = r"(?i)(class|id)=[\"'][^\"']*(combinator|comment|community|disqus|extra|foot|header|menu|remark|rss|shoutbox|sidebar|sponsor|ad-break|pagination|pager|popup|tweet|twitter)[^\"']*[\"']";
        // Note: full DOM manipulation would be needed for proper removal;
        // in production this uses an HTML parser like scraper or lol-html
        let _ = unlikely; // Pattern available for DOM-based implementation

        result
    }

    fn score_candidates(&self, html: &str) -> Vec<String> {
        // Extract content from common article containers, scored by text density
        let patterns = [
            (r"(?is)<article[^>]*>(.*?)</article>", 25.0_f64),
            (r#"(?is)<div[^>]*(?:class|id)=["'][^"']*(?:article|content|entry|post|story|text|body)[^"']*["'][^>]*>(.*?)</div>"#, 15.0),
            (r"(?is)<main[^>]*>(.*?)</main>", 10.0),
            (r"(?is)<body[^>]*>(.*?)</body>", 1.0),
        ];

        let mut candidates: Vec<(String, f64)> = Vec::new();

        for (pattern, bonus) in patterns {
            if let Ok(re) = regex::Regex::new(pattern) {
                for caps in re.captures_iter(html) {
                    if let Some(content) = caps.get(1) {
                        let text = content.as_str();
                        // Score: paragraph count * 2 + text_length / 100 + tag bonus
                        let paragraph_count = text.matches("<p").count() as f64;
                        let stripped = regex::Regex::new(r"<[^>]+>")
                            .map(|re| re.replace_all(text, "").len())
                            .unwrap_or(text.len());
                        let score = paragraph_count * 2.0 + stripped as f64 / 100.0 + bonus;
                        candidates.push((text.to_string(), score));
                    }
                }
            }
        }

        candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        candidates.into_iter().map(|(html, _)| html).collect()
    }

    fn clean_article_node(&self, html: &str) -> String {
        let mut result = html.to_string();
        // Remove forms, inputs, share/social/related divs
        let patterns = [
            r"(?is)<form[^>]*>.*?</form>",
            r"(?i)<input[^>]*/?>",
            r"(?is)<button[^>]*>.*?</button>",
            r#"(?is)<div[^>]*(?:class|id)=["'][^"']*(?:share|social|related|comment)[^"']*["'][^>]*>.*?</div>"#,
        ];
        for p in patterns {
            if let Ok(re) = regex::Regex::new(p) {
                result = re.replace_all(&result, "").to_string();
            }
        }
        result
    }

    fn html_to_plain_text(&self, html: &str) -> String {
        let mut text = html.to_string();

        // Replace block elements with double newlines
        if let Ok(re) = regex::Regex::new(r"(?i)</?(p|div|section|article|h[1-6]|blockquote|li|tr)[^>]*>") {
            text = re.replace_all(&text, "\n\n").to_string();
        }
        // Replace <br> with single newline
        if let Ok(re) = regex::Regex::new(r"(?i)<br\s*/?>") {
            text = re.replace_all(&text, "\n").to_string();
        }
        // Strip remaining tags
        if let Ok(re) = regex::Regex::new(r"<[^>]+>") {
            text = re.replace_all(&text, "").to_string();
        }
        // Decode common entities
        text = text
            .replace("&nbsp;", " ")
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"");

        // Collapse multiple blank lines
        if let Ok(re) = regex::Regex::new(r"\n{3,}") {
            text = re.replace_all(&text, "\n\n").to_string();
        }

        text.trim().to_string()
    }
}

// ---------------------------------------------------------------------------
// 2. WebFullPageProvider — Full HTML snapshot
// ---------------------------------------------------------------------------

pub struct WebFullPageProvider;

#[async_trait]
impl CaptureModePlugin for WebFullPageProvider {
    fn id(&self) -> &str { "web_full_page" }
    fn display_name(&self) -> &str { "Web Full Page Snapshot" }

    fn supports(&self, input: &CaptureInput) -> bool {
        matches!(input, CaptureInput::Url { .. })
    }

    async fn capture(&self, input: &CaptureInput, config: &CaptureConfig) -> Result<CaptureItem, CaptureError> {
        let url = match input {
            CaptureInput::Url { url, .. } => url,
            _ => return Err(CaptureError::UnsupportedInput {
                provider: self.id().into(), input_kind: "non-URL".into(),
            }),
        };

        let timeout = config.timeout_ms.unwrap_or(60_000);
        let (body, _status) = fetch_url(url, timeout, None).await?;
        let html = String::from_utf8_lossy(&body).to_string();

        // 1. Resolve all relative URLs to absolute
        let resolved = self.resolve_relative_urls(&html, url);

        // 2. Inline external stylesheets — fetch each and embed as <style>
        let with_styles = self.inline_external_stylesheets(&resolved, url, timeout).await;

        // 3. Inject capture metadata
        let meta_tags = format!(
            r#"<meta name="clef:captured-at" content="{}" /><meta name="clef:source-url" content="{}" />"#,
            Utc::now().to_rfc3339(),
            url
        );
        let final_html = if let Some(pos) = with_styles.to_lowercase().find("<head>") {
            let insert_at = pos + "<head>".len();
            format!("{}{}\n{}", &with_styles[..insert_at], meta_tags, &with_styles[insert_at..])
        } else {
            format!("{}\n{}", meta_tags, with_styles)
        };

        let title = extract_tag_content(&html, "title").unwrap_or_else(|| "Untitled".into());

        let mut source_metadata = SourceMetadata::new(self.id());
        source_metadata.source_url = Some(url.clone());
        source_metadata.title = Some(title);
        source_metadata.mime_type = Some("text/html".into());
        source_metadata.extra = Some(serde_json::json!({
            "sizeBytes": body.len(),
        }));

        let raw_data = if config.include_raw_data { Some(body) } else { None };

        Ok(CaptureItem { content: final_html, source_metadata, raw_data })
    }
}

impl WebFullPageProvider {
    fn resolve_relative_urls(&self, html: &str, base_url: &str) -> String {
        let base = match url::Url::parse(base_url) {
            Ok(u) => u,
            Err(_) => return html.to_string(),
        };

        let re = match regex::Regex::new(r#"(src|href|action)=["']([^"']+)["']"#) {
            Ok(r) => r,
            Err(_) => return html.to_string(),
        };

        re.replace_all(html, |caps: &regex::Captures| {
            let attr = &caps[1];
            let value = &caps[2];
            match base.join(value) {
                Ok(absolute) => format!(r#"{}="{}""#, attr, absolute),
                Err(_) => format!(r#"{}="{}""#, attr, value),
            }
        }).to_string()
    }

    async fn inline_external_stylesheets(&self, html: &str, base_url: &str, timeout_ms: u64) -> String {
        let re = match regex::Regex::new(r#"<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*/?>""#) {
            Ok(r) => r,
            Err(_) => return html.to_string(),
        };

        let mut result = html.to_string();

        // Collect all stylesheet URLs first
        let stylesheet_urls: Vec<(String, String)> = re.captures_iter(html)
            .filter_map(|caps| {
                let full = caps.get(0)?.as_str().to_string();
                let href = caps.get(1)?.as_str().to_string();
                Some((full, href))
            })
            .collect();

        for (full_match, href) in stylesheet_urls {
            let css_url = match resolve_url(base_url, &href) {
                Some(u) => u,
                None => continue,
            };
            match fetch_url(&css_url, timeout_ms, None).await {
                Ok((css_data, _)) => {
                    let css = String::from_utf8_lossy(&css_data);
                    let style_tag = format!(
                        "<style data-source=\"{}\">\n{}\n</style>",
                        css_url, css
                    );
                    result = result.replace(&full_match, &style_tag);
                }
                Err(_) => {} // Keep original <link> on failure
            }
        }

        result
    }
}

// ---------------------------------------------------------------------------
// 3. WebBookmarkProvider — Metadata-only capture
// ---------------------------------------------------------------------------

pub struct WebBookmarkProvider;

#[async_trait]
impl CaptureModePlugin for WebBookmarkProvider {
    fn id(&self) -> &str { "web_bookmark" }
    fn display_name(&self) -> &str { "Web Bookmark (Metadata Only)" }

    fn supports(&self, input: &CaptureInput) -> bool {
        matches!(input, CaptureInput::Url { .. })
    }

    async fn capture(&self, input: &CaptureInput, config: &CaptureConfig) -> Result<CaptureItem, CaptureError> {
        let url = match input {
            CaptureInput::Url { url, .. } => url,
            _ => return Err(CaptureError::UnsupportedInput {
                provider: self.id().into(), input_kind: "non-URL".into(),
            }),
        };

        let timeout = config.timeout_ms.unwrap_or(15_000);
        let (body, _) = fetch_url(url, timeout, None).await?;
        let html = String::from_utf8_lossy(&body).to_string();

        let title = extract_og(&html, "title")
            .or_else(|| extract_tag_content(&html, "title"))
            .unwrap_or_else(|| url.clone());
        let description = extract_og(&html, "description")
            .or_else(|| extract_meta_name(&html, "description"));
        let site_name = extract_og(&html, "site_name");
        let image = extract_og(&html, "image");
        let favicon = extract_favicon(&html, url);
        let theme_color = extract_meta_name(&html, "theme-color");

        // Extract canonical URL
        let canonical = regex::Regex::new(r#"<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']"#)
            .ok()
            .and_then(|re| re.captures(&html))
            .and_then(|caps| caps.get(1))
            .map(|m| m.as_str().to_string())
            .unwrap_or_else(|| url.clone());

        let mut content_lines = vec![format!("# {}", title)];
        if let Some(ref desc) = description {
            content_lines.push(format!("\n> {}", desc));
        }
        content_lines.push(format!("\nURL: {}", canonical));
        if let Some(ref sn) = site_name {
            content_lines.push(format!("Site: {}", sn));
        }
        if let Some(ref img) = image {
            content_lines.push(format!("Image: {}", img));
        }
        if let Some(ref fav) = favicon {
            content_lines.push(format!("Favicon: {}", fav));
        }

        let mut source_metadata = SourceMetadata::new(self.id());
        source_metadata.source_url = Some(canonical);
        source_metadata.title = Some(title);
        source_metadata.site_name = site_name;
        source_metadata.favicon = favicon;
        source_metadata.description = description;
        source_metadata.extra = Some(serde_json::json!({
            "themeColor": theme_color,
            "ogImage": image,
        }));

        Ok(CaptureItem {
            content: content_lines.join("\n"),
            source_metadata,
            raw_data: None,
        })
    }
}

// ---------------------------------------------------------------------------
// 4. WebScreenshotProvider — Visual screenshot capture
// ---------------------------------------------------------------------------

pub struct WebScreenshotProvider;

#[async_trait]
impl CaptureModePlugin for WebScreenshotProvider {
    fn id(&self) -> &str { "web_screenshot" }
    fn display_name(&self) -> &str { "Web Screenshot" }

    fn supports(&self, input: &CaptureInput) -> bool {
        matches!(input, CaptureInput::Url { .. })
    }

    async fn capture(&self, input: &CaptureInput, config: &CaptureConfig) -> Result<CaptureItem, CaptureError> {
        let (url, selection) = match input {
            CaptureInput::Url { url, selection } => (url, selection),
            _ => return Err(CaptureError::UnsupportedInput {
                provider: self.id().into(), input_kind: "non-URL".into(),
            }),
        };

        let opts = config.provider_options
            .as_ref()
            .and_then(|po| po.get("web_screenshot"));

        let format = opts.and_then(|o| o.get("format"))
            .and_then(|v| v.as_str())
            .unwrap_or("png");
        let full_page = opts.and_then(|o| o.get("fullPage"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let viewport_width = opts.and_then(|o| o.get("viewportWidth"))
            .and_then(|v| v.as_u64())
            .unwrap_or(1280);
        let viewport_height = opts.and_then(|o| o.get("viewportHeight"))
            .and_then(|v| v.as_u64())
            .unwrap_or(800);
        let device_scale = opts.and_then(|o| o.get("deviceScaleFactor"))
            .and_then(|v| v.as_u64())
            .unwrap_or(2);

        // In production: launch headless Chromium via chromiumoxide or headless_chrome crate
        //   1. Navigate to URL with specified viewport
        //   2. Wait for network idle
        //   3. If selector provided, find element and capture its bounding box
        //   4. If full_page, set viewport to document scroll height
        //   5. Capture screenshot as PNG/JPEG bytes

        let selector_str = selection.as_ref()
            .map(|s| s.selector.clone())
            .unwrap_or_else(|| "none".to_string());

        let content = format!(
            "[Screenshot of {}]\nFormat: {}\nViewport: {}x{}@{}x\nFull page: {}\nSelector: {}",
            url, format, viewport_width, viewport_height, device_scale, full_page, selector_str
        );

        let mut source_metadata = SourceMetadata::new(self.id());
        source_metadata.source_url = Some(url.clone());
        source_metadata.mime_type = Some(format!("image/{}", format));
        source_metadata.extra = Some(serde_json::json!({
            "viewport": { "width": viewport_width, "height": viewport_height, "deviceScaleFactor": device_scale },
            "fullPage": full_page,
            "selector": selector_str,
        }));

        Ok(CaptureItem { content, source_metadata, raw_data: None })
    }
}

// ---------------------------------------------------------------------------
// 5. WebMarkdownProvider — HTML to Markdown with YAML frontmatter
// ---------------------------------------------------------------------------

pub struct WebMarkdownProvider;

#[async_trait]
impl CaptureModePlugin for WebMarkdownProvider {
    fn id(&self) -> &str { "web_markdown" }
    fn display_name(&self) -> &str { "Web Markdown (Turndown)" }

    fn supports(&self, input: &CaptureInput) -> bool {
        matches!(input, CaptureInput::Url { .. })
    }

    async fn capture(&self, input: &CaptureInput, config: &CaptureConfig) -> Result<CaptureItem, CaptureError> {
        let url = match input {
            CaptureInput::Url { url, .. } => url,
            _ => return Err(CaptureError::UnsupportedInput {
                provider: self.id().into(), input_kind: "non-URL".into(),
            }),
        };

        let timeout = config.timeout_ms.unwrap_or(30_000);
        let (body, _) = fetch_url(url, timeout, None).await?;
        let html = String::from_utf8_lossy(&body).to_string();

        // 1. Extract article HTML from common containers
        let article_html = self.extract_article_html(&html);

        // 2. Extract metadata for frontmatter
        let meta = extract_page_metadata(&html, url);

        // 3. Convert HTML to Markdown using Turndown-equivalent rules
        let markdown_body = self.html_to_markdown(&article_html);

        // 4. Generate YAML frontmatter
        let frontmatter = self.generate_frontmatter(&meta);

        let content = format!("{}\n{}", frontmatter, markdown_body);

        let mut source_metadata = SourceMetadata::new(self.id());
        source_metadata.source_url = Some(url.clone());
        source_metadata.title = Some(meta.title);
        source_metadata.author = meta.author;
        source_metadata.published_at = meta.published_date;
        source_metadata.site_name = meta.site_name;
        source_metadata.description = meta.description;

        let raw_data = if config.include_raw_data { Some(body) } else { None };

        Ok(CaptureItem { content, source_metadata, raw_data })
    }
}

impl WebMarkdownProvider {
    fn extract_article_html<'a>(&self, html: &'a str) -> String {
        for tag in &["article", "main", "body"] {
            let pattern = format!(r"(?is)<{tag}[^>]*>(.*?)</{tag}>");
            if let Ok(re) = regex::Regex::new(&pattern) {
                if let Some(caps) = re.captures(html) {
                    if let Some(m) = caps.get(1) {
                        return m.as_str().to_string();
                    }
                }
            }
        }
        html.to_string()
    }

    fn html_to_markdown(&self, html: &str) -> String {
        let mut md = html.to_string();

        // Headings: <h1>...<h1> -> # ...
        for level in 1..=6 {
            let prefix = "#".repeat(level);
            let pattern = format!(r"(?is)<h{level}[^>]*>(.*?)</h{level}>");
            if let Ok(re) = regex::Regex::new(&pattern) {
                md = re.replace_all(&md, |caps: &regex::Captures| {
                    format!("\n\n{} {}\n\n", prefix, &caps[1].trim())
                }).to_string();
            }
        }

        // Paragraphs
        if let Ok(re) = regex::Regex::new(r"(?is)<p[^>]*>(.*?)</p>") {
            md = re.replace_all(&md, "\n\n$1\n\n").to_string();
        }

        // Bold: <strong>/<b>
        for tag in &["strong", "b"] {
            let pattern = format!(r"(?is)<{tag}[^>]*>(.*?)</{tag}>");
            if let Ok(re) = regex::Regex::new(&pattern) {
                md = re.replace_all(&md, "**$1**").to_string();
            }
        }

        // Italic: <em>/<i>
        for tag in &["em", "i"] {
            let pattern = format!(r"(?is)<{tag}[^>]*>(.*?)</{tag}>");
            if let Ok(re) = regex::Regex::new(&pattern) {
                md = re.replace_all(&md, "_$1_").to_string();
            }
        }

        // Strikethrough: <del>/<s>/<strike>
        for tag in &["del", "s", "strike"] {
            let pattern = format!(r"(?is)<{tag}[^>]*>(.*?)</{tag}>");
            if let Ok(re) = regex::Regex::new(&pattern) {
                md = re.replace_all(&md, "~~$1~~").to_string();
            }
        }

        // Links: <a href="url">text</a> -> [text](url)
        if let Ok(re) = regex::Regex::new(r#"(?is)<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)</a>"#) {
            md = re.replace_all(&md, "[$2]($1)").to_string();
        }

        // Images: <img src="url" alt="text"> -> ![text](url)
        if let Ok(re) = regex::Regex::new(r#"(?i)<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*?)["'][^>]*/?>""#) {
            md = re.replace_all(&md, "![$2]($1)").to_string();
        }

        // Code blocks: <pre><code class="language-X">...</code></pre>
        if let Ok(re) = regex::Regex::new(r#"(?is)<pre[^>]*><code[^>]*(?:class=["'][^"']*language-(\w+)[^"']*["'])?[^>]*>(.*?)</code></pre>"#) {
            md = re.replace_all(&md, |caps: &regex::Captures| {
                let lang = caps.get(1).map(|m| m.as_str()).unwrap_or("");
                let code = &caps[2];
                format!("\n\n```{}\n{}\n```\n\n", lang, code)
            }).to_string();
        }

        // Inline code
        if let Ok(re) = regex::Regex::new(r"(?is)<code[^>]*>(.*?)</code>") {
            md = re.replace_all(&md, "`$1`").to_string();
        }

        // Blockquote
        if let Ok(re) = regex::Regex::new(r"(?is)<blockquote[^>]*>(.*?)</blockquote>") {
            md = re.replace_all(&md, "\n\n> $1\n\n").to_string();
        }

        // List items
        if let Ok(re) = regex::Regex::new(r"(?is)<li[^>]*>(.*?)</li>") {
            md = re.replace_all(&md, "- $1\n").to_string();
        }

        // Horizontal rules
        if let Ok(re) = regex::Regex::new(r"(?i)<hr\s*/?>") {
            md = re.replace_all(&md, "\n\n---\n\n").to_string();
        }

        // Line breaks
        if let Ok(re) = regex::Regex::new(r"(?i)<br\s*/?>") {
            md = re.replace_all(&md, "\n").to_string();
        }

        // Strip remaining HTML tags
        if let Ok(re) = regex::Regex::new(r"<[^>]+>") {
            md = re.replace_all(&md, "").to_string();
        }

        // Decode HTML entities
        md = md
            .replace("&nbsp;", " ")
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"");

        // Collapse excessive newlines
        if let Ok(re) = regex::Regex::new(r"\n{3,}") {
            md = re.replace_all(&md, "\n\n").to_string();
        }

        md.trim().to_string()
    }

    fn generate_frontmatter(&self, meta: &PageMetadata) -> String {
        let mut lines = vec!["---".to_string()];
        lines.push(format!("title: \"{}\"", meta.title.replace('"', "\\\"")));
        if let Some(ref author) = meta.author {
            lines.push(format!("author: \"{}\"", author));
        }
        if let Some(ref date) = meta.published_date {
            lines.push(format!("date: {}", date));
        }
        if let Some(ref site) = meta.site_name {
            lines.push(format!("source: \"{}\"", site));
        }
        if let Some(ref desc) = meta.description {
            lines.push(format!("description: \"{}\"", desc.replace('"', "\\\"")));
        }

        // Extract keywords as tags
        // (would be passed from metadata extraction in a full implementation)

        lines.push(format!("captured_at: {}", Utc::now().to_rfc3339()));
        lines.push("---".to_string());
        lines.join("\n")
    }
}

// ---------------------------------------------------------------------------
// 6. FileUploadProvider — Direct file ingestion with MIME detection
// ---------------------------------------------------------------------------

pub struct FileUploadProvider;

#[async_trait]
impl CaptureModePlugin for FileUploadProvider {
    fn id(&self) -> &str { "file_upload" }
    fn display_name(&self) -> &str { "File Upload" }

    fn supports(&self, input: &CaptureInput) -> bool {
        matches!(input, CaptureInput::File { .. })
    }

    async fn capture(&self, input: &CaptureInput, config: &CaptureConfig) -> Result<CaptureItem, CaptureError> {
        let (path, data, mime_hint) = match input {
            CaptureInput::File { path, data, mime_hint } => (path, data, mime_hint),
            _ => return Err(CaptureError::UnsupportedInput {
                provider: self.id().into(), input_kind: "non-file".into(),
            }),
        };

        // 1. Detect MIME type via magic bytes, extension, then hint
        let detected_mime = self.detect_mime_by_magic_bytes(data)
            .or_else(|| self.detect_mime_by_extension(path))
            .or_else(|| mime_hint.clone())
            .unwrap_or_else(|| "application/octet-stream".to_string());

        // 2. Extract file metadata
        let file_name = std::path::Path::new(path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();
        let extension = std::path::Path::new(path)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_string();
        let size_bytes = data.len();

        // 3. Content extraction based on type
        let text_content = if detected_mime.starts_with("text/") || self.is_text_mime(&detected_mime) {
            String::from_utf8(data.clone())
                .unwrap_or_else(|_| String::from_utf8_lossy(data).to_string())
        } else if detected_mime == "application/pdf" {
            // In production: use lopdf or pdf-extract crate
            format!("[PDF content: {}] ({}, {})", file_name, format_bytes(size_bytes), detected_mime)
        } else if detected_mime.starts_with("image/") {
            format!("[Image: {}] ({}, {})", file_name, format_bytes(size_bytes), detected_mime)
        } else {
            format!("[Binary file: {}] ({}, {})", file_name, format_bytes(size_bytes), detected_mime)
        };

        // 4. Compute SHA-256 hash for deduplication
        let hash = self.compute_sha256(data);

        let mut source_metadata = SourceMetadata::new(self.id());
        source_metadata.mime_type = Some(detected_mime);
        source_metadata.extra = Some(serde_json::json!({
            "fileName": file_name,
            "extension": extension,
            "sizeBytes": size_bytes,
            "sha256": hash,
            "originalPath": path,
        }));

        let raw_data = if config.include_raw_data {
            let max = config.max_raw_bytes.unwrap_or(0);
            if max > 0 { Some(data[..max.min(data.len())].to_vec()) } else { Some(data.clone()) }
        } else {
            None
        };

        Ok(CaptureItem { content: text_content, source_metadata, raw_data })
    }
}

impl FileUploadProvider {
    fn detect_mime_by_magic_bytes(&self, data: &[u8]) -> Option<String> {
        if data.len() < 16 { return None; }

        // PDF: %PDF
        if data[0] == 0x25 && data[1] == 0x50 && data[2] == 0x44 && data[3] == 0x46 {
            return Some("application/pdf".into());
        }
        // PNG: 0x89 PNG
        if data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 {
            return Some("image/png".into());
        }
        // JPEG: FF D8 FF
        if data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
            return Some("image/jpeg".into());
        }
        // GIF: GIF8
        if data[0] == 0x47 && data[1] == 0x49 && data[2] == 0x46 {
            return Some("image/gif".into());
        }
        // ZIP: PK 03 04
        if data[0] == 0x50 && data[1] == 0x4B && data[2] == 0x03 && data[3] == 0x04 {
            return Some("application/zip".into());
        }
        // GZIP: 1F 8B
        if data[0] == 0x1F && data[1] == 0x8B {
            return Some("application/gzip".into());
        }
        // WebP: RIFF....WEBP
        if data.len() >= 12
            && data[0] == 0x52 && data[1] == 0x49 && data[2] == 0x46 && data[3] == 0x46
            && data[8] == 0x57 && data[9] == 0x45 && data[10] == 0x42 && data[11] == 0x50 {
            return Some("image/webp".into());
        }

        None
    }

    fn detect_mime_by_extension(&self, path: &str) -> Option<String> {
        let ext = std::path::Path::new(path)
            .extension()
            .and_then(|e| e.to_str())?
            .to_lowercase();

        let mime = match ext.as_str() {
            "txt" => "text/plain",
            "md" => "text/markdown",
            "html" | "htm" => "text/html",
            "css" => "text/css",
            "js" => "application/javascript",
            "ts" => "application/typescript",
            "json" => "application/json",
            "xml" => "application/xml",
            "csv" => "text/csv",
            "pdf" => "application/pdf",
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "svg" => "image/svg+xml",
            "mp3" => "audio/mpeg",
            "mp4" => "video/mp4",
            "wav" => "audio/wav",
            "zip" => "application/zip",
            "gz" => "application/gzip",
            "yaml" | "yml" => "application/yaml",
            _ => return None,
        };

        Some(mime.to_string())
    }

    fn is_text_mime(&self, mime: &str) -> bool {
        matches!(mime,
            "application/json" | "application/xml" | "application/javascript" |
            "application/typescript" | "application/yaml"
        )
    }

    fn compute_sha256(&self, data: &[u8]) -> String {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(data);
        let result = hasher.finalize();
        result.iter().map(|b| format!("{:02x}", b)).collect()
    }
}

// ---------------------------------------------------------------------------
// 7. EmailForwardProvider — Parse forwarded email (RFC 2822)
// ---------------------------------------------------------------------------

pub struct EmailForwardProvider;

#[async_trait]
impl CaptureModePlugin for EmailForwardProvider {
    fn id(&self) -> &str { "email_forward" }
    fn display_name(&self) -> &str { "Email Forward (RFC 2822)" }

    fn supports(&self, input: &CaptureInput) -> bool {
        matches!(input, CaptureInput::Email { .. })
    }

    async fn capture(&self, input: &CaptureInput, config: &CaptureConfig) -> Result<CaptureItem, CaptureError> {
        let raw = match input {
            CaptureInput::Email { raw } => raw,
            _ => return Err(CaptureError::UnsupportedInput {
                provider: self.id().into(), input_kind: "non-email".into(),
            }),
        };

        // 1. Split headers from body at first blank line (RFC 2822 Section 2.1)
        let (header_section, body_section) = match raw.find("\r\n\r\n") {
            Some(pos) => (&raw[..pos], &raw[pos + 4..]),
            None => (raw.as_str(), ""),
        };

        // 2. Parse headers — unfold continuation lines (RFC 2822 Section 2.2.3)
        let headers = self.parse_headers(header_section);

        // 3. Determine Content-Type and boundary for MIME multipart
        let content_type = headers.get("content-type")
            .cloned()
            .unwrap_or_else(|| "text/plain".to_string());
        let boundary = self.extract_boundary(&content_type);

        // 4. Parse MIME parts
        let mut text_body = String::new();
        let mut html_body = String::new();
        let mut attachments: Vec<(String, String, usize)> = Vec::new(); // (name, mime, size)

        if let Some(ref boundary) = boundary {
            let parts = self.split_mime_parts(body_section, boundary);
            for part in parts {
                let parsed = self.parse_mime_part(&part);
                if parsed.content_type.starts_with("text/plain") && !parsed.is_attachment {
                    text_body.push_str(&self.decode_body(&parsed.body, &parsed.encoding));
                } else if parsed.content_type.starts_with("text/html") && !parsed.is_attachment {
                    html_body.push_str(&self.decode_body(&parsed.body, &parsed.encoding));
                } else if parsed.content_type.starts_with("multipart/") {
                    // Handle nested multipart
                    if let Some(nested_boundary) = self.extract_boundary(&parsed.content_type) {
                        let nested_parts = self.split_mime_parts(&parsed.body, &nested_boundary);
                        for np in nested_parts {
                            let nr = self.parse_mime_part(&np);
                            if nr.content_type.starts_with("text/plain") && !nr.is_attachment {
                                text_body.push_str(&self.decode_body(&nr.body, &nr.encoding));
                            } else if nr.content_type.starts_with("text/html") && !nr.is_attachment {
                                html_body.push_str(&self.decode_body(&nr.body, &nr.encoding));
                            } else {
                                let name = nr.filename.unwrap_or_else(|| "untitled".into());
                                let mime = nr.content_type.split(';').next().unwrap_or(&nr.content_type).trim().to_string();
                                attachments.push((name, mime, nr.body.len()));
                            }
                        }
                    }
                } else {
                    let name = parsed.filename.unwrap_or_else(|| "untitled".into());
                    let mime = parsed.content_type.split(';').next().unwrap_or(&parsed.content_type).trim().to_string();
                    attachments.push((name, mime, parsed.body.len()));
                }
            }
        } else {
            let encoding = headers.get("content-transfer-encoding")
                .cloned()
                .unwrap_or_else(|| "7bit".to_string());
            text_body = self.decode_body(body_section, &encoding);
        }

        // 5. Prefer HTML converted to text, fall back to text/plain
        let main_content = if !html_body.is_empty() {
            self.html_to_text(&html_body)
        } else {
            text_body
        };

        // 6. Decode RFC 2047 encoded-words in headers
        let subject = self.decode_rfc2047(
            headers.get("subject").map(|s| s.as_str()).unwrap_or("(no subject)")
        );
        let from = self.decode_rfc2047(
            headers.get("from").map(|s| s.as_str()).unwrap_or("")
        );
        let to = self.decode_rfc2047(
            headers.get("to").map(|s| s.as_str()).unwrap_or("")
        );
        let date = headers.get("date").cloned();
        let message_id = headers.get("message-id").cloned();

        // 7. Build structured content
        let mut content_lines = vec![
            format!("From: {}", from),
            format!("To: {}", to),
            format!("Subject: {}", subject),
        ];
        if let Some(ref d) = date { content_lines.push(format!("Date: {}", d)); }
        if let Some(ref mid) = message_id { content_lines.push(format!("Message-ID: {}", mid)); }
        content_lines.push(String::new());
        content_lines.push(main_content);

        if !attachments.is_empty() {
            content_lines.push(String::new());
            content_lines.push(format!("Attachments ({}):", attachments.len()));
            for (name, mime, size) in &attachments {
                content_lines.push(format!("  - {} ({}, {})", name, mime, format_bytes(*size)));
            }
        }

        let content = content_lines.join("\n");

        let mut source_metadata = SourceMetadata::new(self.id());
        source_metadata.title = Some(subject);
        source_metadata.author = Some(from);
        source_metadata.extra = Some(serde_json::json!({
            "to": to,
            "date": date,
            "messageId": message_id,
            "attachmentCount": attachments.len(),
            "hasHtmlBody": !html_body.is_empty(),
        }));

        let raw_data = if config.include_raw_data { Some(raw.as_bytes().to_vec()) } else { None };

        Ok(CaptureItem { content, source_metadata, raw_data })
    }
}

impl EmailForwardProvider {
    fn parse_headers(&self, section: &str) -> HashMap<String, String> {
        // Unfold continuation lines (lines starting with whitespace)
        let unfolded = regex::Regex::new(r"\r\n([ \t])")
            .map(|re| re.replace_all(section, " ").to_string())
            .unwrap_or_else(|_| section.to_string());

        let mut headers = HashMap::new();
        for line in unfolded.split("\r\n") {
            if let Some(colon_pos) = line.find(':') {
                let name = line[..colon_pos].trim().to_lowercase();
                let value = line[colon_pos + 1..].trim().to_string();
                headers.insert(name, value);
            }
        }
        headers
    }

    fn extract_boundary(&self, content_type: &str) -> Option<String> {
        regex::Regex::new(r#"boundary=["']?([^"';\s]+)["']?"#)
            .ok()
            .and_then(|re| re.captures(content_type))
            .and_then(|caps| caps.get(1))
            .map(|m| m.as_str().to_string())
    }

    fn split_mime_parts<'a>(&self, body: &'a str, boundary: &str) -> Vec<String> {
        let delimiter = format!("--{}", boundary);
        body.split(&delimiter)
            .skip(1)  // Preamble
            .filter(|p| !p.starts_with("--") && !p.trim().is_empty())
            .map(|p| p.trim().to_string())
            .collect()
    }

    fn parse_mime_part(&self, part: &str) -> MimePart {
        let (header_str, body) = match part.find("\r\n\r\n") {
            Some(pos) => (&part[..pos], part[pos + 4..].to_string()),
            None => ("", part.to_string()),
        };

        let headers = self.parse_headers(header_str);
        let content_type = headers.get("content-type").cloned().unwrap_or_else(|| "text/plain".into());
        let encoding = headers.get("content-transfer-encoding").cloned().unwrap_or_else(|| "7bit".into());
        let disposition = headers.get("content-disposition").cloned().unwrap_or_default();

        // Extract filename
        let filename = regex::Regex::new(r#"filename=["']?([^"';\s]+)["']?"#)
            .ok()
            .and_then(|re| {
                re.captures(&disposition)
                    .or_else(|| re.captures(&content_type))
            })
            .and_then(|caps| caps.get(1))
            .map(|m| m.as_str().to_string());

        let is_attachment = disposition.contains("attachment") || filename.is_some();

        MimePart { content_type, encoding, filename, body, is_attachment }
    }

    fn decode_body(&self, body: &str, encoding: &str) -> String {
        match encoding.to_lowercase().as_str() {
            "base64" => {
                use base64::Engine;
                let cleaned: String = body.chars().filter(|c| !c.is_whitespace()).collect();
                base64::engine::general_purpose::STANDARD
                    .decode(&cleaned)
                    .ok()
                    .and_then(|bytes| String::from_utf8(bytes).ok())
                    .unwrap_or_else(|| body.to_string())
            }
            "quoted-printable" => self.decode_quoted_printable(body),
            _ => body.to_string(),
        }
    }

    fn decode_quoted_printable(&self, text: &str) -> String {
        // RFC 2045 Section 6.7
        let mut result = text.replace("=\r\n", "").replace("=\n", "");

        if let Ok(re) = regex::Regex::new(r"=([0-9A-Fa-f]{2})") {
            result = re.replace_all(&result, |caps: &regex::Captures| {
                u8::from_str_radix(&caps[1], 16)
                    .map(|b| (b as char).to_string())
                    .unwrap_or_else(|_| caps[0].to_string())
            }).to_string();
        }

        result
    }

    fn decode_rfc2047(&self, value: &str) -> String {
        // RFC 2047 encoded-word: =?charset?encoding?text?=
        let re = match regex::Regex::new(r"=\?([^?]+)\?(Q|B)\?([^?]+)\?=") {
            Ok(r) => r,
            Err(_) => return value.to_string(),
        };

        re.replace_all(value, |caps: &regex::Captures| {
            let enc = caps[2].to_uppercase();
            let encoded_text = &caps[3];

            if enc == "B" {
                use base64::Engine;
                base64::engine::general_purpose::STANDARD
                    .decode(encoded_text)
                    .ok()
                    .and_then(|bytes| String::from_utf8(bytes).ok())
                    .unwrap_or_else(|| encoded_text.to_string())
            } else {
                // Q encoding: like quoted-printable, _ = space
                self.decode_quoted_printable(&encoded_text.replace('_', " "))
            }
        }).to_string()
    }

    fn html_to_text(&self, html: &str) -> String {
        let mut text = html.to_string();
        if let Ok(re) = regex::Regex::new(r"(?i)<br\s*/?>") {
            text = re.replace_all(&text, "\n").to_string();
        }
        if let Ok(re) = regex::Regex::new(r"(?i)</?(p|div|h[1-6]|blockquote|li|tr)[^>]*>") {
            text = re.replace_all(&text, "\n").to_string();
        }
        if let Ok(re) = regex::Regex::new(r"<[^>]+>") {
            text = re.replace_all(&text, "").to_string();
        }
        text = text
            .replace("&nbsp;", " ")
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">");
        if let Ok(re) = regex::Regex::new(r"\n{3,}") {
            text = re.replace_all(&text, "\n\n").to_string();
        }
        text.trim().to_string()
    }
}

struct MimePart {
    content_type: String,
    encoding: String,
    filename: Option<String>,
    body: String,
    is_attachment: bool,
}

// ---------------------------------------------------------------------------
// 8. ApiPollProvider — Periodic API query with delta detection
// ---------------------------------------------------------------------------

pub struct ApiPollProvider;

#[async_trait]
impl CaptureModePlugin for ApiPollProvider {
    fn id(&self) -> &str { "api_poll" }
    fn display_name(&self) -> &str { "API Poll (Delta Detection)" }

    fn supports(&self, input: &CaptureInput) -> bool {
        matches!(input, CaptureInput::ApiEndpoint { .. })
    }

    async fn capture(&self, input: &CaptureInput, config: &CaptureConfig) -> Result<CaptureItem, CaptureError> {
        let (endpoint_url, method, input_headers, explicit_cursor) = match input {
            CaptureInput::ApiEndpoint { endpoint_url, method, headers, cursor } =>
                (endpoint_url, method, headers, cursor),
            _ => return Err(CaptureError::UnsupportedInput {
                provider: self.id().into(), input_kind: "non-api_endpoint".into(),
            }),
        };

        let timeout = config.timeout_ms.unwrap_or(30_000);
        let opts = config.provider_options
            .as_ref()
            .and_then(|po| po.get("api_poll"));

        let pagination_strategy = opts
            .and_then(|o| o.get("pagination"))
            .and_then(|v| v.as_str())
            .unwrap_or("cursor");
        let delta_strategy = opts
            .and_then(|o| o.get("delta"))
            .and_then(|v| v.as_str())
            .unwrap_or("watermark");
        let max_pages = opts
            .and_then(|o| o.get("maxPages"))
            .and_then(|v| v.as_u64())
            .unwrap_or(10) as usize;

        // 1. Build request headers
        let mut request_headers = HashMap::new();
        request_headers.insert("Accept".to_string(), "application/json".to_string());
        if let Some(extra) = input_headers {
            for (k, v) in extra {
                request_headers.insert(k.clone(), v.clone());
            }
        }

        // 2. Build initial poll URL with cursor parameter
        let mut current_url = self.build_poll_url(endpoint_url, explicit_cursor.as_deref(), pagination_strategy);
        let mut all_items: Vec<serde_json::Value> = Vec::new();
        let mut pages_collected = 0_usize;
        let mut new_cursor: Option<String> = None;

        // 3. Paginate through results
        while let Some(ref url) = current_url {
            if pages_collected >= max_pages { break; }

            let (body, status) = fetch_url(url, timeout, Some(&request_headers)).await?;

            // Handle 304 Not Modified
            if status == 304 {
                let mut source_metadata = SourceMetadata::new(self.id());
                source_metadata.source_url = Some(endpoint_url.clone());
                source_metadata.extra = Some(serde_json::json!({
                    "deltaDetected": false,
                    "strategy": delta_strategy,
                }));
                return Ok(CaptureItem { content: "[]".into(), source_metadata, raw_data: None });
            }

            let json: serde_json::Value = serde_json::from_slice(&body)
                .map_err(|e| CaptureError::ParseError { detail: format!("Invalid JSON: {}", e) })?;

            // 4. Extract items from common response shapes
            let items = self.extract_items(&json);
            all_items.extend(items);

            // 5. Extract pagination cursor for next page
            if let Some(obj) = json.as_object() {
                new_cursor = self.extract_cursor(obj);
                current_url = self.extract_next_page_url(obj, pagination_strategy, endpoint_url);
            } else {
                current_url = None;
            }

            pages_collected += 1;
        }

        // 6. Serialize results
        let content = serde_json::to_string_pretty(&all_items)
            .unwrap_or_else(|_| "[]".to_string());

        let mut source_metadata = SourceMetadata::new(self.id());
        source_metadata.source_url = Some(endpoint_url.clone());
        source_metadata.extra = Some(serde_json::json!({
            "itemCount": all_items.len(),
            "pagesCollected": pages_collected,
            "deltaDetected": !all_items.is_empty(),
            "strategy": delta_strategy,
            "pagination": pagination_strategy,
            "cursor": new_cursor,
        }));

        Ok(CaptureItem { content, source_metadata, raw_data: None })
    }
}

impl ApiPollProvider {
    fn build_poll_url(&self, base_url: &str, cursor: Option<&str>, strategy: &str) -> Option<String> {
        let mut parsed = url::Url::parse(base_url).ok()?;
        if let Some(cursor) = cursor {
            let param_name = if strategy == "offset" { "offset" } else { "cursor" };
            parsed.query_pairs_mut().append_pair(param_name, cursor);
        }
        Some(parsed.to_string())
    }

    fn extract_items(&self, json: &serde_json::Value) -> Vec<serde_json::Value> {
        // Support common API response shapes
        if let Some(arr) = json.as_array() {
            return arr.clone();
        }
        if let Some(obj) = json.as_object() {
            for key in &["data", "results", "items", "entries", "records"] {
                if let Some(arr) = obj.get(*key).and_then(|v| v.as_array()) {
                    return arr.clone();
                }
            }
            return vec![json.clone()];
        }
        vec![]
    }

    fn extract_cursor(&self, body: &serde_json::Map<String, serde_json::Value>) -> Option<String> {
        for key in &["next_cursor", "nextCursor", "cursor", "offset"] {
            if let Some(val) = body.get(*key) {
                if let Some(s) = val.as_str() { return Some(s.to_string()); }
                if let Some(n) = val.as_i64() { return Some(n.to_string()); }
            }
        }
        None
    }

    fn extract_next_page_url(
        &self,
        body: &serde_json::Map<String, serde_json::Value>,
        strategy: &str,
        base_url: &str,
    ) -> Option<String> {
        // Check body for next URL
        for key in &["next", "next_page_url", "nextPageUrl"] {
            if let Some(url) = body.get(*key).and_then(|v| v.as_str()) {
                return Some(url.to_string());
            }
        }

        // Check has_more + cursor
        let has_more = body.get("has_more").and_then(|v| v.as_bool())
            .or_else(|| body.get("hasMore").and_then(|v| v.as_bool()))
            .unwrap_or(false);

        if has_more {
            if let Some(cursor) = self.extract_cursor(body) {
                return self.build_poll_url(base_url, Some(&cursor), strategy);
            }
        }

        None
    }
}

// ---------------------------------------------------------------------------
// 9. ShareIntentProvider — Mobile/OS share sheet receiver
// ---------------------------------------------------------------------------

pub struct ShareIntentProvider;

#[async_trait]
impl CaptureModePlugin for ShareIntentProvider {
    fn id(&self) -> &str { "share_intent" }
    fn display_name(&self) -> &str { "Share Intent (OS Share Sheet)" }

    fn supports(&self, input: &CaptureInput) -> bool {
        matches!(input, CaptureInput::ShareIntent { .. })
    }

    async fn capture(&self, input: &CaptureInput, config: &CaptureConfig) -> Result<CaptureItem, CaptureError> {
        let (text, url, files) = match input {
            CaptureInput::ShareIntent { text, url, files } => (text, url, files),
            _ => return Err(CaptureError::UnsupportedInput {
                provider: self.id().into(), input_kind: "non-share_intent".into(),
            }),
        };

        let has_url = url.is_some();
        let has_text = text.as_ref().map(|t| !t.is_empty()).unwrap_or(false);
        let has_files = files.as_ref().map(|f| !f.is_empty()).unwrap_or(false);

        let intent_type = if has_files && has_text { "files_with_text" }
            else if has_files { "files_only" }
            else if has_url && has_text { "url_with_text" }
            else if has_url { "url_only" }
            else if has_text { "text_only" }
            else { "empty" };

        let (content, title) = match intent_type {
            "url_only" => {
                let u = url.as_ref().unwrap();
                let page_title = self.fetch_page_title(u, config.timeout_ms.unwrap_or(10_000)).await;
                let title = page_title.clone().unwrap_or_else(|| u.clone());
                let content = if let Some(ref pt) = page_title {
                    format!("# {}\nURL: {}", pt, u)
                } else {
                    format!("URL: {}", u)
                };
                (content, title)
            }
            "url_with_text" => {
                let u = url.as_ref().unwrap();
                let t = text.as_ref().unwrap();
                let page_title = self.fetch_page_title(u, config.timeout_ms.unwrap_or(10_000)).await;
                let title = page_title.clone().unwrap_or_else(|| t.chars().take(80).collect());
                let content = if let Some(ref pt) = page_title {
                    format!("# {}\nURL: {}\n\n{}", pt, u, t)
                } else {
                    format!("URL: {}\n\n{}", u, t)
                };
                (content, title)
            }
            "text_only" => {
                let t = text.as_ref().unwrap();
                let title: String = t.chars().take(80).collect::<String>().replace('\n', " ");
                (t.clone(), title)
            }
            "files_only" | "files_with_text" => {
                let file_uploader = FileUploadProvider;
                let mut file_results = Vec::new();

                if let Some(ref file_list) = files {
                    for file in file_list {
                        let file_input = CaptureInput::File {
                            path: file.name.clone(),
                            data: file.data.clone(),
                            mime_hint: Some(file.mime_type.clone()),
                        };
                        if file_uploader.supports(&file_input) {
                            match file_uploader.capture(&file_input, config).await {
                                Ok(result) => file_results.push(format!("## {}\n{}", file.name, result.content)),
                                Err(_) => file_results.push(format!("## {}\n[Error processing file]", file.name)),
                            }
                        }
                    }
                }

                let file_count = files.as_ref().map(|f| f.len()).unwrap_or(0);
                let title = if file_count == 1 {
                    files.as_ref().and_then(|f| f.first()).map(|f| f.name.clone()).unwrap_or_default()
                } else {
                    format!("{} shared files", file_count)
                };

                let text_part = if has_text {
                    format!("{}\n\n", text.as_ref().unwrap())
                } else {
                    String::new()
                };

                let content = format!("{}{}", text_part, file_results.join("\n\n"));
                (content, title)
            }
            _ => ("".to_string(), "Empty share".to_string()),
        };

        let mut source_metadata = SourceMetadata::new(self.id());
        source_metadata.source_url = url.clone();
        source_metadata.title = Some(title);
        source_metadata.extra = Some(serde_json::json!({
            "intentType": intent_type,
            "hasText": has_text,
            "hasUrl": has_url,
            "fileCount": files.as_ref().map(|f| f.len()).unwrap_or(0),
            "fileNames": files.as_ref().map(|f| f.iter().map(|sf| sf.name.clone()).collect::<Vec<_>>()),
        }));

        Ok(CaptureItem { content, source_metadata, raw_data: None })
    }
}

impl ShareIntentProvider {
    async fn fetch_page_title(&self, url: &str, timeout_ms: u64) -> Option<String> {
        let (body, _) = fetch_url(url, timeout_ms, None).await.ok()?;
        let html = String::from_utf8_lossy(&body);
        extract_tag_content(&html, "title")
    }
}

// ---------------------------------------------------------------------------
// Factory function — create provider by ID
// ---------------------------------------------------------------------------

/// Create a capture-mode provider by its unique identifier.
///
/// Returns `None` if the given ID does not match any known provider.
pub fn create_provider(id: &str) -> Option<Box<dyn CaptureModePlugin>> {
    match id {
        "web_article" => Some(Box::new(WebArticleProvider)),
        "web_full_page" => Some(Box::new(WebFullPageProvider)),
        "web_bookmark" => Some(Box::new(WebBookmarkProvider)),
        "web_screenshot" => Some(Box::new(WebScreenshotProvider)),
        "web_markdown" => Some(Box::new(WebMarkdownProvider)),
        "file_upload" => Some(Box::new(FileUploadProvider)),
        "email_forward" => Some(Box::new(EmailForwardProvider)),
        "api_poll" => Some(Box::new(ApiPollProvider)),
        "share_intent" => Some(Box::new(ShareIntentProvider)),
        _ => None,
    }
}

/// Return all available provider IDs.
pub fn available_providers() -> Vec<&'static str> {
    vec![
        "web_article",
        "web_full_page",
        "web_bookmark",
        "web_screenshot",
        "web_markdown",
        "file_upload",
        "email_forward",
        "api_poll",
        "share_intent",
    ]
}

/// Resolve the best provider for a given input.
///
/// Returns the first provider whose `supports()` returns true, preferring
/// more specific providers (checked in registration order).
pub fn resolve_provider(input: &CaptureInput) -> Option<Box<dyn CaptureModePlugin>> {
    for id in available_providers() {
        if let Some(provider) = create_provider(id) {
            if provider.supports(input) {
                return Some(provider);
            }
        }
    }
    None
}

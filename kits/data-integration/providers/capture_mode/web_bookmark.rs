// Data Integration Kit - Web Bookmark Capture Provider
// Lightweight metadata-only capture via OpenGraph, Twitter Card, and HTML meta tags

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "web_bookmark";
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
            CaptureError::MissingUrl => write!(f, "web_bookmark capture requires a URL"),
            CaptureError::FetchError(e) => write!(f, "Fetch error: {}", e),
            CaptureError::ParseError(e) => write!(f, "Parse error: {}", e),
        }
    }
}

#[derive(Debug, Default, Clone)]
struct BookmarkData {
    title: Option<String>,
    description: Option<String>,
    image: Option<String>,
    favicon: Option<String>,
    canonical_url: Option<String>,
    site_name: Option<String>,
    twitter_card: Option<String>,
    author: Option<String>,
    og_type: Option<String>,
}

const MAX_HEAD_BYTES: usize = 16384;

fn extract_meta_tag(html: &str, property: &str) -> Option<String> {
    let patterns = [
        format!(r#"(?i)<meta[^>]+(?:property|name)=["']{}["'][^>]+content=["']([^"']+)["']"#, regex::escape(property)),
        format!(r#"(?i)<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']{}["']"#, regex::escape(property)),
    ];
    for pat in &patterns {
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

fn extract_opengraph(html: &str) -> BookmarkData {
    BookmarkData {
        title: extract_meta_tag(html, "og:title"),
        description: extract_meta_tag(html, "og:description"),
        image: extract_meta_tag(html, "og:image"),
        site_name: extract_meta_tag(html, "og:site_name"),
        og_type: extract_meta_tag(html, "og:type"),
        canonical_url: extract_meta_tag(html, "og:url"),
        ..Default::default()
    }
}

fn extract_twitter_card(html: &str) -> BookmarkData {
    BookmarkData {
        twitter_card: extract_meta_tag(html, "twitter:card"),
        title: extract_meta_tag(html, "twitter:title"),
        description: extract_meta_tag(html, "twitter:description"),
        image: extract_meta_tag(html, "twitter:image"),
        ..Default::default()
    }
}

fn extract_html_title(html: &str) -> Option<String> {
    regex::Regex::new(r"(?i)<title>([^<]+)</title>").ok()
        .and_then(|re| re.captures(html))
        .and_then(|caps| caps.get(1).map(|m| m.as_str().trim().to_string()))
}

fn extract_favicon(html: &str, base_url: &str) -> Option<String> {
    let patterns = [
        r#"(?i)<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']"#,
        r#"(?i)<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']"#,
        r#"(?i)<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']"#,
    ];
    for pat in &patterns {
        if let Ok(re) = regex::Regex::new(pat) {
            if let Some(caps) = re.captures(html) {
                if let Some(m) = caps.get(1) {
                    return Some(m.as_str().to_string());
                }
            }
        }
    }
    // Default favicon path
    if let Some(idx) = base_url.find("://") {
        if let Some(slash_idx) = base_url[idx + 3..].find('/') {
            let origin = &base_url[..idx + 3 + slash_idx];
            return Some(format!("{}/favicon.ico", origin));
        }
    }
    Some(format!("{}/favicon.ico", base_url))
}

fn extract_canonical(html: &str) -> Option<String> {
    regex::Regex::new(r#"(?i)<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']"#).ok()
        .and_then(|re| re.captures(html))
        .and_then(|caps| caps.get(1).map(|m| m.as_str().trim().to_string()))
}

fn merge_bookmark(og: BookmarkData, twitter: BookmarkData, html_meta: BookmarkData) -> BookmarkData {
    BookmarkData {
        title: og.title.or(twitter.title).or(html_meta.title),
        description: og.description.or(twitter.description).or(html_meta.description),
        image: og.image.or(twitter.image).or(html_meta.image),
        favicon: html_meta.favicon,
        canonical_url: og.canonical_url.or(html_meta.canonical_url),
        site_name: og.site_name,
        twitter_card: twitter.twitter_card,
        author: html_meta.author,
        og_type: og.og_type,
    }
}

pub struct WebBookmarkCaptureProvider;

impl WebBookmarkCaptureProvider {
    pub fn new() -> Self { Self }

    pub fn capture(&self, input: &CaptureInput, config: &CaptureConfig) -> Result<CaptureItem, CaptureError> {
        let url = input.url.as_ref().ok_or(CaptureError::MissingUrl)?;
        let html = http_get_partial(url, MAX_HEAD_BYTES)
            .map_err(|e| CaptureError::FetchError(e.to_string()))?;

        let og = extract_opengraph(&html);
        let twitter = extract_twitter_card(&html);
        let html_meta = BookmarkData {
            title: extract_html_title(&html),
            description: extract_meta_tag(&html, "description"),
            canonical_url: extract_canonical(&html),
            favicon: extract_favicon(&html, url),
            author: extract_meta_tag(&html, "author"),
            ..Default::default()
        };

        let bookmark = merge_bookmark(og, twitter, html_meta);
        let title = bookmark.title.clone().unwrap_or_else(|| "Untitled Bookmark".to_string());

        let mut content_parts = vec![format!("# {}", title)];
        if let Some(ref desc) = bookmark.description { content_parts.push(desc.clone()); }
        if let Some(ref site) = bookmark.site_name { content_parts.push(format!("Site: {}", site)); }
        if let Some(ref author) = bookmark.author { content_parts.push(format!("Author: {}", author)); }
        if let Some(ref image) = bookmark.image { content_parts.push(format!("Image: {}", image)); }
        if let Some(ref favicon) = bookmark.favicon { content_parts.push(format!("Favicon: {}", favicon)); }

        Ok(CaptureItem {
            content: content_parts.join("\n"),
            source_metadata: SourceMetadata {
                title,
                url: Some(bookmark.canonical_url.unwrap_or_else(|| url.clone())),
                captured_at: chrono::Utc::now().to_rfc3339(),
                content_type: "application/x-bookmark".to_string(),
                author: bookmark.author,
                tags: Some(vec!["bookmark".to_string(), bookmark.og_type.unwrap_or_else(|| "webpage".to_string())]),
                source: Some("web_bookmark".to_string()),
            },
            raw_data: None,
        })
    }

    pub fn supports(&self, input: &CaptureInput) -> bool {
        input.url.as_ref().map_or(false, |u| {
            u.starts_with("http://") || u.starts_with("https://")
        })
    }
}

fn http_get_partial(url: &str, _max_bytes: usize) -> Result<String, CaptureError> {
    Err(CaptureError::FetchError(format!("HTTP client not configured for: {}", url)))
}

// Data Integration Kit - Web Full Page Capture Provider
// Full HTML snapshot with inlined styles and base64-encoded images

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "web_full_page";
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
            CaptureError::MissingUrl => write!(f, "web_full_page capture requires a URL"),
            CaptureError::FetchError(e) => write!(f, "Fetch error: {}", e),
            CaptureError::ParseError(e) => write!(f, "Parse error: {}", e),
        }
    }
}

fn resolve_url(base: &str, relative: &str) -> String {
    if relative.starts_with("http://") || relative.starts_with("https://") || relative.starts_with("data:") {
        return relative.to_string();
    }
    if relative.starts_with('/') {
        if let Some(origin) = base.find("://").and_then(|i| base[i + 3..].find('/').map(|j| &base[..i + 3 + j])) {
            return format!("{}{}", origin, relative);
        }
        return format!("{}{}", base, relative);
    }
    let base_dir = base.rfind('/').map(|i| &base[..=i]).unwrap_or(base);
    format!("{}{}", base_dir, relative)
}

fn extract_stylesheet_urls(html: &str, base_url: &str) -> Vec<String> {
    let re = regex::Regex::new(r#"(?i)<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>"#).unwrap();
    re.captures_iter(html)
        .filter_map(|caps| caps.get(1).map(|m| resolve_url(base_url, m.as_str())))
        .collect()
}

fn extract_image_sources(html: &str, base_url: &str) -> Vec<(String, String)> {
    let re = regex::Regex::new(r#"(?i)<img[^>]+src=["']([^"']+)["'][^>]*>"#).unwrap();
    re.captures_iter(html)
        .filter_map(|caps| {
            let original = caps.get(1)?.as_str();
            if original.starts_with("data:") { return None; }
            Some((original.to_string(), resolve_url(base_url, original)))
        })
        .collect()
}

fn resolve_all_relative_urls(html: &str, base_url: &str) -> String {
    let re = regex::Regex::new(r#"(href|src|action)=["']([^"'#][^"']*)["']"#).unwrap();
    re.replace_all(html, |caps: &regex::Captures| {
        let attr = &caps[1];
        let url = &caps[2];
        if url.starts_with("data:") || url.starts_with("javascript:") || url.starts_with('#') {
            return caps[0].to_string();
        }
        format!("{}=\"{}\"", attr, resolve_url(base_url, url))
    }).to_string()
}

fn inline_stylesheets(html: &str, base_url: &str, css_fetcher: &dyn Fn(&str) -> Option<String>) -> String {
    let urls = extract_stylesheet_urls(html, base_url);
    let mut result = html.to_string();
    for css_url in &urls {
        if let Some(css_text) = css_fetcher(css_url) {
            let resolved_css = regex::Regex::new(r#"url\(["']?([^"')]+)["']?\)"#).unwrap()
                .replace_all(&css_text, |caps: &regex::Captures| {
                    format!("url(\"{}\")", resolve_url(css_url, &caps[1]))
                }).to_string();
            let style_tag = format!("<style data-original-href=\"{}\">\n{}\n</style>", css_url, resolved_css);
            let escaped = regex::escape(css_url);
            let link_pattern = format!(r#"(?i)<link[^>]+href=["']{}["'][^>]*>"#, escaped);
            if let Ok(re) = regex::Regex::new(&link_pattern) {
                result = re.replace(&result, style_tag.as_str()).to_string();
            }
        }
    }
    result
}

fn inline_images(html: &str, base_url: &str, img_fetcher: &dyn Fn(&str) -> Option<(String, Vec<u8>)>) -> String {
    let sources = extract_image_sources(html, base_url);
    let mut result = html.to_string();
    for (original, absolute) in &sources {
        if let Some((content_type, bytes)) = img_fetcher(absolute) {
            use base64::Engine;
            let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
            let data_uri = format!("data:{};base64,{}", content_type, b64);
            result = result.replace(original.as_str(), &data_uri);
        }
    }
    result
}

pub struct WebFullPageCaptureProvider;

impl WebFullPageCaptureProvider {
    pub fn new() -> Self { Self }

    pub fn capture(&self, input: &CaptureInput, config: &CaptureConfig) -> Result<CaptureItem, CaptureError> {
        let url = input.url.as_ref().ok_or(CaptureError::MissingUrl)?;
        let html = http_get(url).map_err(|e| CaptureError::FetchError(e.to_string()))?;

        let title = regex::Regex::new(r"(?i)<title>([^<]*)</title>")
            .ok().and_then(|re| re.captures(&html))
            .and_then(|caps| caps.get(1).map(|m| m.as_str().trim().to_string()))
            .unwrap_or_else(|| "Untitled Page".to_string());

        let mut result_html = resolve_all_relative_urls(&html, url);

        let inline_css = config.options.as_ref()
            .and_then(|o| o.get("inlineStyles"))
            .and_then(|v| v.as_bool())
            .unwrap_or(true);
        let inline_imgs = config.options.as_ref()
            .and_then(|o| o.get("inlineImages"))
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        if inline_css {
            result_html = inline_stylesheets(&result_html, url, &|css_url| {
                http_get(css_url).ok()
            });
        }
        if inline_imgs {
            result_html = inline_images(&result_html, url, &|img_url| {
                http_get_bytes(img_url).ok()
            });
        }

        let timestamp = chrono::Utc::now().to_rfc3339();
        let snapshot = format!("<!-- Full page snapshot captured from {} at {} -->\n{}", url, timestamp, result_html);

        Ok(CaptureItem {
            content: snapshot,
            source_metadata: SourceMetadata {
                title,
                url: Some(url.clone()),
                captured_at: timestamp,
                content_type: "text/html".to_string(),
                author: None,
                tags: Some(vec!["full-page".to_string(), "snapshot".to_string()]),
                source: Some("web_full_page".to_string()),
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

fn http_get(url: &str) -> Result<String, CaptureError> {
    Err(CaptureError::FetchError(format!("HTTP client not configured for: {}", url)))
}

fn http_get_bytes(url: &str) -> Result<(String, Vec<u8>), CaptureError> {
    Err(CaptureError::FetchError(format!("HTTP client not configured for: {}", url)))
}

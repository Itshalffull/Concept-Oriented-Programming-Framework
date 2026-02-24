// Data Integration Kit - Share Intent Capture Provider
// Mobile/OS share sheet receiver normalizing across iOS NSItemProvider and Android Intent extras

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "share_intent";
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
    MissingShareData,
    ParseError(String),
}

impl std::fmt::Display for CaptureError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CaptureError::MissingShareData => write!(f, "share_intent capture requires shareData"),
            CaptureError::ParseError(e) => write!(f, "Parse error: {}", e),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum SharePlatform {
    Ios,
    Android,
    Web,
    Desktop,
    Unknown,
}

impl SharePlatform {
    fn as_str(&self) -> &str {
        match self {
            SharePlatform::Ios => "ios",
            SharePlatform::Android => "android",
            SharePlatform::Web => "web",
            SharePlatform::Desktop => "desktop",
            SharePlatform::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum ShareContentType {
    Text,
    Url,
    Image,
    File,
    Mixed,
}

impl ShareContentType {
    fn as_str(&self) -> &str {
        match self {
            ShareContentType::Text => "text",
            ShareContentType::Url => "url",
            ShareContentType::Image => "image",
            ShareContentType::File => "file",
            ShareContentType::Mixed => "mixed",
        }
    }

    fn mime_type(&self) -> &str {
        match self {
            ShareContentType::Image => "image/*",
            ShareContentType::Url => "text/uri-list",
            ShareContentType::File => "application/octet-stream",
            _ => "text/plain",
        }
    }
}

#[derive(Debug, Clone)]
pub struct SharedImage {
    pub mime_type: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

#[derive(Debug, Clone)]
pub struct SharedFile {
    pub mime_type: String,
    pub filename: String,
    pub size: usize,
}

#[derive(Debug, Clone)]
pub struct NormalizedShareData {
    pub text: Option<String>,
    pub url: Option<String>,
    pub title: Option<String>,
    pub images: Vec<SharedImage>,
    pub files: Vec<SharedFile>,
    pub platform: SharePlatform,
    pub content_type: ShareContentType,
}

fn detect_platform(data: &serde_json::Value) -> SharePlatform {
    let obj = match data.as_object() {
        Some(o) => o,
        None => return SharePlatform::Unknown,
    };

    // iOS NSItemProvider pattern
    if obj.contains_key("itemProviders") || obj.contains_key("NSExtensionItem") || obj.contains_key("UTType") {
        return SharePlatform::Ios;
    }
    // Android Intent pattern
    if obj.contains_key("action") || obj.contains_key("EXTRA_TEXT") || obj.contains_key("EXTRA_STREAM") {
        return SharePlatform::Android;
    }
    // Web Share API
    if obj.contains_key("title") && (obj.contains_key("text") || obj.contains_key("url")) {
        if !obj.contains_key("action") && !obj.contains_key("itemProviders") {
            return SharePlatform::Web;
        }
    }
    // Desktop clipboard/drag-drop
    if obj.contains_key("clipboardData") || obj.contains_key("dataTransfer") {
        return SharePlatform::Desktop;
    }
    SharePlatform::Unknown
}

fn is_url(s: &str) -> bool {
    s.starts_with("http://") || s.starts_with("https://")
}

fn normalize_ios(data: &serde_json::Value) -> NormalizedShareData {
    let mut result = NormalizedShareData {
        text: None, url: None, title: None,
        images: Vec::new(), files: Vec::new(),
        platform: SharePlatform::Ios, content_type: ShareContentType::Text,
    };

    if let Some(ext) = data.get("NSExtensionItem").and_then(|v| v.as_object()) {
        if let Some(t) = ext.get("attributedTitle").and_then(|v| v.as_str()) {
            result.title = Some(t.to_string());
        }
    }

    let items = data.get("itemProviders").or_else(|| data.get("items"))
        .and_then(|v| v.as_array());

    if let Some(items) = items {
        for item in items {
            let uti = item.get("UTType").or_else(|| item.get("typeIdentifier"))
                .and_then(|v| v.as_str()).unwrap_or("");
            let data_str = item.get("data").and_then(|v| v.as_str()).unwrap_or("");

            if uti.contains("public.url") || uti.contains("public.plain-text") {
                if is_url(data_str) {
                    result.url = Some(data_str.to_string());
                    result.content_type = ShareContentType::Url;
                } else {
                    result.text = Some(data_str.to_string());
                }
            } else if uti.contains("public.image") {
                let mime = if uti.contains("png") { "image/png" } else { "image/jpeg" };
                result.images.push(SharedImage { mime_type: mime.to_string(), width: None, height: None });
                result.content_type = if result.url.is_some() || result.text.is_some() {
                    ShareContentType::Mixed
                } else { ShareContentType::Image };
            } else if uti.contains("public.file-url") || uti.contains("public.data") {
                let mime = item.get("mimeType").and_then(|v| v.as_str())
                    .unwrap_or("application/octet-stream");
                let name = item.get("suggestedName").or_else(|| item.get("filename"))
                    .and_then(|v| v.as_str()).unwrap_or("shared-file");
                result.files.push(SharedFile {
                    mime_type: mime.to_string(),
                    filename: name.to_string(),
                    size: data_str.len(),
                });
                result.content_type = ShareContentType::File;
            }
        }
    }
    result
}

fn normalize_android(data: &serde_json::Value) -> NormalizedShareData {
    let mut result = NormalizedShareData {
        text: None, url: None, title: None,
        images: Vec::new(), files: Vec::new(),
        platform: SharePlatform::Android, content_type: ShareContentType::Text,
    };

    if let Some(text) = data.get("EXTRA_TEXT").and_then(|v| v.as_str()) {
        if is_url(text) {
            result.url = Some(text.to_string());
            result.content_type = ShareContentType::Url;
        } else {
            result.text = Some(text.to_string());
        }
    }
    if let Some(subject) = data.get("EXTRA_SUBJECT").and_then(|v| v.as_str()) {
        result.title = Some(subject.to_string());
    }
    if result.text.is_none() {
        if let Some(html) = data.get("EXTRA_HTML_TEXT").and_then(|v| v.as_str()) {
            result.text = Some(html.to_string());
        }
    }

    let mime_type = data.get("type").and_then(|v| v.as_str()).unwrap_or("application/octet-stream");
    if let Some(streams) = data.get("EXTRA_STREAM") {
        let stream_list = if streams.is_array() {
            streams.as_array().unwrap().clone()
        } else {
            vec![streams.clone()]
        };

        for stream in &stream_list {
            if mime_type.starts_with("image/") {
                result.images.push(SharedImage { mime_type: mime_type.to_string(), width: None, height: None });
                result.content_type = if result.text.is_some() || result.url.is_some() {
                    ShareContentType::Mixed
                } else { ShareContentType::Image };
            } else {
                let name = stream.get("displayName").and_then(|v| v.as_str())
                    .unwrap_or("shared-file");
                result.files.push(SharedFile {
                    mime_type: mime_type.to_string(),
                    filename: name.to_string(),
                    size: 0,
                });
                result.content_type = ShareContentType::File;
            }
        }
    }
    result
}

fn normalize_web(data: &serde_json::Value) -> NormalizedShareData {
    let mut result = NormalizedShareData {
        text: None, url: None, title: None,
        images: Vec::new(), files: Vec::new(),
        platform: SharePlatform::Web, content_type: ShareContentType::Text,
    };

    if let Some(t) = data.get("title").and_then(|v| v.as_str()) { result.title = Some(t.to_string()); }
    if let Some(t) = data.get("text").and_then(|v| v.as_str()) { result.text = Some(t.to_string()); }
    if let Some(u) = data.get("url").and_then(|v| v.as_str()) {
        result.url = Some(u.to_string());
        result.content_type = ShareContentType::Url;
    }

    if let Some(files) = data.get("files").and_then(|v| v.as_array()) {
        for file in files {
            let name = file.get("name").and_then(|v| v.as_str()).unwrap_or("shared-file");
            let mime = file.get("type").and_then(|v| v.as_str()).unwrap_or("application/octet-stream");
            let size = file.get("size").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
            result.files.push(SharedFile { mime_type: mime.to_string(), filename: name.to_string(), size });
        }
        if !result.files.is_empty() {
            result.content_type = if result.url.is_some() || result.text.is_some() {
                ShareContentType::Mixed
            } else { ShareContentType::File };
        }
    }
    result
}

fn normalize_share_data(share_data: &serde_json::Value) -> NormalizedShareData {
    let platform = detect_platform(share_data);
    match platform {
        SharePlatform::Ios => normalize_ios(share_data),
        SharePlatform::Android => normalize_android(share_data),
        SharePlatform::Web => normalize_web(share_data),
        _ => {
            let text = share_data.get("text").and_then(|v| v.as_str()).map(String::from);
            let url = share_data.get("url").and_then(|v| v.as_str()).map(String::from);
            let title = share_data.get("title").and_then(|v| v.as_str()).map(String::from);
            NormalizedShareData {
                text, url, title,
                images: Vec::new(), files: Vec::new(),
                platform, content_type: ShareContentType::Text,
            }
        }
    }
}

fn extract_hostname(url: &str) -> String {
    url.find("://")
        .and_then(|i| {
            let rest = &url[i + 3..];
            let end = rest.find('/').unwrap_or(rest.len());
            Some(rest[..end].to_string())
        })
        .unwrap_or_else(|| url.to_string())
}

pub struct ShareIntentCaptureProvider;

impl ShareIntentCaptureProvider {
    pub fn new() -> Self { Self }

    pub fn capture(&self, input: &CaptureInput, config: &CaptureConfig) -> Result<CaptureItem, CaptureError> {
        let share_data = input.share_data.as_ref().ok_or(CaptureError::MissingShareData)?;
        let normalized = normalize_share_data(share_data);

        let mut content_parts: Vec<String> = Vec::new();
        if let Some(ref title) = normalized.title { content_parts.push(format!("# {}", title)); }
        if let Some(ref url) = normalized.url { content_parts.push(format!("URL: {}", url)); }
        if let Some(ref text) = normalized.text { content_parts.push(text.clone()); }
        if !normalized.images.is_empty() {
            content_parts.push(format!("\nImages: {} shared", normalized.images.len()));
            for (i, img) in normalized.images.iter().enumerate() {
                let dim_info = img.width.map(|w| format!(" {}x{}", w, img.height.unwrap_or(0))).unwrap_or_default();
                content_parts.push(format!("  [{}] {}{}", i + 1, img.mime_type, dim_info));
            }
        }
        if !normalized.files.is_empty() {
            content_parts.push(format!("\nFiles: {} shared", normalized.files.len()));
            for (i, file) in normalized.files.iter().enumerate() {
                content_parts.push(format!("  [{}] {} ({}, {} bytes)", i + 1, file.filename, file.mime_type, file.size));
            }
        }

        let title = normalized.title.clone()
            .or_else(|| normalized.url.as_ref().map(|u| format!("Shared: {}", extract_hostname(u))))
            .unwrap_or_else(|| "Shared Content".to_string());

        let content = if content_parts.is_empty() {
            "(empty share)".to_string()
        } else {
            content_parts.join("\n")
        };

        let mut tags = vec![
            "share-intent".to_string(),
            normalized.platform.as_str().to_string(),
            normalized.content_type.as_str().to_string(),
        ];
        if !normalized.images.is_empty() { tags.push("has-images".to_string()); }
        if !normalized.files.is_empty() { tags.push("has-files".to_string()); }

        Ok(CaptureItem {
            content,
            source_metadata: SourceMetadata {
                title,
                url: normalized.url,
                captured_at: chrono::Utc::now().to_rfc3339(),
                content_type: normalized.content_type.mime_type().to_string(),
                author: None,
                tags: Some(tags),
                source: Some("share_intent".to_string()),
            },
            raw_data: None,
        })
    }

    pub fn supports(&self, input: &CaptureInput) -> bool {
        input.share_data.is_some()
    }
}

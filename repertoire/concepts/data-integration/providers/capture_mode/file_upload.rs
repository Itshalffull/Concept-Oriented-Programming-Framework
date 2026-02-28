// Data Integration Kit - File Upload Capture Provider
// Direct file ingestion with MIME detection via magic bytes and metadata extraction

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "file_upload";
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
    pub raw_data: Option<Vec<u8>>,
}

#[derive(Debug)]
pub enum CaptureError {
    MissingFile,
    InvalidFile(String),
}

impl std::fmt::Display for CaptureError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CaptureError::MissingFile => write!(f, "file_upload capture requires a file buffer"),
            CaptureError::InvalidFile(e) => write!(f, "Invalid file: {}", e),
        }
    }
}

struct MagicSignature {
    bytes: &'static [u8],
    offset: usize,
    mime_type: &'static str,
    extension: &'static str,
}

const MAGIC_SIGNATURES: &[MagicSignature] = &[
    MagicSignature { bytes: &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0, mime_type: "image/png", extension: "png" },
    MagicSignature { bytes: &[0xFF, 0xD8, 0xFF], offset: 0, mime_type: "image/jpeg", extension: "jpg" },
    MagicSignature { bytes: &[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], offset: 0, mime_type: "image/gif", extension: "gif" },
    MagicSignature { bytes: &[0x47, 0x49, 0x46, 0x38, 0x39, 0x61], offset: 0, mime_type: "image/gif", extension: "gif" },
    MagicSignature { bytes: &[0x25, 0x50, 0x44, 0x46], offset: 0, mime_type: "application/pdf", extension: "pdf" },
    MagicSignature { bytes: &[0x50, 0x4B, 0x03, 0x04], offset: 0, mime_type: "application/zip", extension: "zip" },
    MagicSignature { bytes: &[0x52, 0x49, 0x46, 0x46], offset: 0, mime_type: "image/webp", extension: "webp" },
    MagicSignature { bytes: &[0x42, 0x4D], offset: 0, mime_type: "image/bmp", extension: "bmp" },
    MagicSignature { bytes: &[0x49, 0x44, 0x33], offset: 0, mime_type: "audio/mpeg", extension: "mp3" },
    MagicSignature { bytes: &[0x66, 0x4C, 0x61, 0x43], offset: 0, mime_type: "audio/flac", extension: "flac" },
    MagicSignature { bytes: &[0x4F, 0x67, 0x67, 0x53], offset: 0, mime_type: "audio/ogg", extension: "ogg" },
    MagicSignature { bytes: &[0x1A, 0x45, 0xDF, 0xA3], offset: 0, mime_type: "video/webm", extension: "webm" },
];

#[derive(Debug, Clone)]
pub struct ImageDimensions {
    pub width: u32,
    pub height: u32,
}

fn detect_mime_type(data: &[u8]) -> (&'static str, &'static str) {
    for sig in MAGIC_SIGNATURES {
        if data.len() < sig.offset + sig.bytes.len() { continue; }
        let slice = &data[sig.offset..sig.offset + sig.bytes.len()];
        if slice == sig.bytes {
            return (sig.mime_type, sig.extension);
        }
    }

    // Check text-based formats
    let header = std::str::from_utf8(&data[..std::cmp::min(data.len(), 512)]).unwrap_or("");
    let trimmed = header.trim_start();
    if trimmed.starts_with("<?xml") || trimmed.starts_with("<svg") {
        return ("image/svg+xml", "svg");
    }
    if trimmed.starts_with("<!DOCTYPE html") || trimmed.starts_with("<html") {
        return ("text/html", "html");
    }
    if trimmed.starts_with('{') || trimmed.starts_with('[') {
        return ("application/json", "json");
    }
    // Check if valid UTF-8 text
    if std::str::from_utf8(data).is_ok() {
        return ("text/plain", "txt");
    }
    ("application/octet-stream", "bin")
}

fn extract_png_dimensions(data: &[u8]) -> Option<ImageDimensions> {
    if data.len() < 24 { return None; }
    if data[0] != 0x89 || data[1] != 0x50 { return None; }
    let width = u32::from_be_bytes([data[16], data[17], data[18], data[19]]);
    let height = u32::from_be_bytes([data[20], data[21], data[22], data[23]]);
    Some(ImageDimensions { width, height })
}

fn extract_jpeg_dimensions(data: &[u8]) -> Option<ImageDimensions> {
    let mut offset = 2usize;
    while offset + 8 < data.len() {
        if data[offset] != 0xFF { offset += 1; continue; }
        let marker = data[offset + 1];
        if marker == 0xC0 || marker == 0xC2 {
            let height = u16::from_be_bytes([data[offset + 5], data[offset + 6]]) as u32;
            let width = u16::from_be_bytes([data[offset + 7], data[offset + 8]]) as u32;
            return Some(ImageDimensions { width, height });
        }
        let seg_len = u16::from_be_bytes([data[offset + 2], data[offset + 3]]) as usize;
        offset += 2 + seg_len;
    }
    None
}

fn extract_gif_dimensions(data: &[u8]) -> Option<ImageDimensions> {
    if data.len() < 10 { return None; }
    let width = u16::from_le_bytes([data[6], data[7]]) as u32;
    let height = u16::from_le_bytes([data[8], data[9]]) as u32;
    Some(ImageDimensions { width, height })
}

fn extract_image_dimensions(data: &[u8], mime_type: &str) -> Option<ImageDimensions> {
    match mime_type {
        "image/png" => extract_png_dimensions(data),
        "image/jpeg" => extract_jpeg_dimensions(data),
        "image/gif" => extract_gif_dimensions(data),
        _ => None,
    }
}

fn format_file_size(bytes: usize) -> String {
    if bytes < 1024 { return format!("{} B", bytes); }
    if bytes < 1048576 { return format!("{:.1} KB", bytes as f64 / 1024.0); }
    if bytes < 1073741824 { return format!("{:.1} MB", bytes as f64 / 1048576.0); }
    format!("{:.1} GB", bytes as f64 / 1073741824.0)
}

pub struct FileUploadCaptureProvider;

impl FileUploadCaptureProvider {
    pub fn new() -> Self { Self }

    pub fn capture(&self, input: &CaptureInput, config: &CaptureConfig) -> Result<CaptureItem, CaptureError> {
        let file_data = input.file.as_ref().ok_or(CaptureError::MissingFile)?;
        if file_data.is_empty() { return Err(CaptureError::MissingFile); }

        let (mime_type, extension) = detect_mime_type(file_data);
        let file_size = file_data.len();
        let filename = config.options.as_ref()
            .and_then(|o| o.get("filename"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("upload.{}", extension));

        let dimensions = if mime_type.starts_with("image/") {
            extract_image_dimensions(file_data, mime_type)
        } else {
            None
        };

        let mut summary = vec![
            format!("File: {}", filename),
            format!("Type: {}", mime_type),
            format!("Size: {}", format_file_size(file_size)),
        ];
        if let Some(ref dims) = dimensions {
            summary.push(format!("Dimensions: {}x{}", dims.width, dims.height));
        }

        let is_text = mime_type.starts_with("text/") || mime_type == "application/json";
        let content = if is_text && file_size < 1048576 {
            String::from_utf8_lossy(file_data).to_string()
        } else {
            summary.join("\n")
        };

        let mut tags = vec![extension.to_string(), mime_type.split('/').next().unwrap_or("file").to_string()];
        if let Some(ref dims) = dimensions {
            tags.push(format!("{}x{}", dims.width, dims.height));
        }

        Ok(CaptureItem {
            content,
            source_metadata: SourceMetadata {
                title: filename,
                url: None,
                captured_at: chrono::Utc::now().to_rfc3339(),
                content_type: mime_type.to_string(),
                author: None,
                tags: Some(tags),
                source: Some("file_upload".to_string()),
            },
            raw_data: None,
        })
    }

    pub fn supports(&self, input: &CaptureInput) -> bool {
        input.file.as_ref().map_or(false, |f| !f.is_empty())
    }
}

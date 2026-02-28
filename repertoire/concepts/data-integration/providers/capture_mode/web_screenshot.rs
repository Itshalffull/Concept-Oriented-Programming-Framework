// Data Integration Kit - Web Screenshot Capture Provider
// Visual screenshot capture via headless browser (Puppeteer/Playwright pattern)

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "web_screenshot";
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
    MissingUrl,
    BrowserError(String),
    TimeoutError(String),
    SelectorError(String),
}

impl std::fmt::Display for CaptureError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CaptureError::MissingUrl => write!(f, "web_screenshot capture requires a URL"),
            CaptureError::BrowserError(e) => write!(f, "Browser error: {}", e),
            CaptureError::TimeoutError(e) => write!(f, "Timeout error: {}", e),
            CaptureError::SelectorError(e) => write!(f, "Selector error: {}", e),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ScreenshotOptions {
    pub width: u32,
    pub height: u32,
    pub full_page: bool,
    pub selector: Option<String>,
    pub device_scale_factor: f64,
    pub format: ImageFormat,
    pub quality: Option<u8>,
    pub wait_until: WaitCondition,
    pub timeout_ms: u64,
    pub delay_ms: u64,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ImageFormat { Png, Jpeg }

#[derive(Debug, Clone)]
pub enum WaitCondition { Load, DomContentLoaded, NetworkIdle }

impl Default for ScreenshotOptions {
    fn default() -> Self {
        Self {
            width: 1280,
            height: 720,
            full_page: false,
            selector: None,
            device_scale_factor: 2.0,
            format: ImageFormat::Png,
            quality: None,
            wait_until: WaitCondition::NetworkIdle,
            timeout_ms: 30000,
            delay_ms: 0,
        }
    }
}

fn parse_options(config: &CaptureConfig) -> ScreenshotOptions {
    let opts = config.options.as_ref();
    let mut result = ScreenshotOptions::default();

    if let Some(opts) = opts {
        if let Some(w) = opts.get("width").and_then(|v| v.as_u64()) { result.width = w as u32; }
        if let Some(h) = opts.get("height").and_then(|v| v.as_u64()) { result.height = h as u32; }
        if let Some(fp) = opts.get("fullPage").and_then(|v| v.as_bool()) { result.full_page = fp; }
        if let Some(sel) = opts.get("selector").and_then(|v| v.as_str()) { result.selector = Some(sel.to_string()); }
        if let Some(dsf) = opts.get("deviceScaleFactor").and_then(|v| v.as_f64()) { result.device_scale_factor = dsf; }
        if let Some(fmt) = opts.get("format").and_then(|v| v.as_str()) {
            result.format = if fmt == "jpeg" { ImageFormat::Jpeg } else { ImageFormat::Png };
        }
        if result.format == ImageFormat::Jpeg {
            result.quality = Some(opts.get("quality").and_then(|v| v.as_u64()).unwrap_or(80) as u8);
        }
        if let Some(wu) = opts.get("waitUntil").and_then(|v| v.as_str()) {
            result.wait_until = match wu {
                "load" => WaitCondition::Load,
                "domcontentloaded" => WaitCondition::DomContentLoaded,
                _ => WaitCondition::NetworkIdle,
            };
        }
        if let Some(t) = opts.get("timeout").and_then(|v| v.as_u64()) { result.timeout_ms = t; }
        if let Some(d) = opts.get("delay").and_then(|v| v.as_u64()) { result.delay_ms = d; }
    }
    result
}

fn build_data_uri(bytes: &[u8], format: &ImageFormat) -> String {
    use base64::Engine;
    let mime = match format {
        ImageFormat::Png => "image/png",
        ImageFormat::Jpeg => "image/jpeg",
    };
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    format!("data:{};base64,{}", mime, encoded)
}

/// Represents a headless browser abstraction for screenshot capture
pub trait HeadlessBrowser {
    fn navigate(&self, url: &str, timeout_ms: u64) -> Result<(), CaptureError>;
    fn set_viewport(&self, width: u32, height: u32, scale: f64) -> Result<(), CaptureError>;
    fn get_title(&self) -> Result<String, CaptureError>;
    fn capture_viewport(&self, format: &ImageFormat, quality: Option<u8>) -> Result<Vec<u8>, CaptureError>;
    fn capture_full_page(&self, format: &ImageFormat, quality: Option<u8>) -> Result<Vec<u8>, CaptureError>;
    fn capture_element(&self, selector: &str, format: &ImageFormat, quality: Option<u8>) -> Result<Vec<u8>, CaptureError>;
    fn wait(&self, ms: u64) -> Result<(), CaptureError>;
}

pub struct WebScreenshotCaptureProvider;

impl WebScreenshotCaptureProvider {
    pub fn new() -> Self { Self }

    pub fn capture(&self, input: &CaptureInput, config: &CaptureConfig) -> Result<CaptureItem, CaptureError> {
        let url = input.url.as_ref().ok_or(CaptureError::MissingUrl)?;
        let options = parse_options(config);

        let browser = create_browser()
            .map_err(|e| CaptureError::BrowserError(e.to_string()))?;

        browser.set_viewport(options.width, options.height, options.device_scale_factor)?;
        browser.navigate(url, options.timeout_ms)?;

        if options.delay_ms > 0 {
            browser.wait(options.delay_ms)?;
        }

        let title = browser.get_title().unwrap_or_else(|_| "Screenshot".to_string());

        let screenshot_bytes = if let Some(ref selector) = options.selector {
            browser.capture_element(selector, &options.format, options.quality)?
        } else if options.full_page {
            browser.capture_full_page(&options.format, options.quality)?
        } else {
            browser.capture_viewport(&options.format, options.quality)?
        };

        let data_uri = build_data_uri(&screenshot_bytes, &options.format);
        let mime = match options.format {
            ImageFormat::Png => "image/png",
            ImageFormat::Jpeg => "image/jpeg",
        };

        let viewport_tag = if options.full_page {
            "full-page".to_string()
        } else {
            "viewport".to_string()
        };

        Ok(CaptureItem {
            content: data_uri,
            source_metadata: SourceMetadata {
                title,
                url: Some(url.clone()),
                captured_at: chrono::Utc::now().to_rfc3339(),
                content_type: mime.to_string(),
                author: None,
                tags: Some(vec![
                    "screenshot".to_string(),
                    viewport_tag,
                    format!("{}x{}", options.width, options.height),
                ]),
                source: Some("web_screenshot".to_string()),
            },
            raw_data: Some(screenshot_bytes),
        })
    }

    pub fn supports(&self, input: &CaptureInput) -> bool {
        input.url.as_ref().map_or(false, |u| {
            u.starts_with("http://") || u.starts_with("https://")
        })
    }
}

fn create_browser() -> Result<Box<dyn HeadlessBrowser>, CaptureError> {
    Err(CaptureError::BrowserError("Headless browser runtime not configured".to_string()))
}

// COPF Data Integration Kit - Local OCR via Tesseract enricher provider
// Shells out to the tesseract binary, parses HOCR output for word-level bounding boxes.

use std::collections::HashMap;
use std::io::Write;
use std::process::Command;

pub const PROVIDER_ID: &str = "ocr_tesseract";
pub const PLUGIN_TYPE: &str = "enricher_plugin";

#[derive(Debug, Clone)]
pub struct ContentItem {
    pub id: String,
    pub content: String,
    pub content_type: String,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone)]
pub struct EnricherConfig {
    pub model: Option<String>,
    pub api_key: Option<String>,
    pub threshold: Option<f64>,
    pub options: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone)]
pub struct EnrichmentResult {
    pub fields: HashMap<String, serde_json::Value>,
    pub confidence: f64,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone)]
pub struct SchemaRef {
    pub name: String,
    pub fields: Option<Vec<String>>,
}

#[derive(Debug, Clone)]
pub struct CostEstimate {
    pub tokens: Option<u64>,
    pub api_calls: Option<u64>,
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct WordBox {
    pub word: String,
    pub x1: u32,
    pub y1: u32,
    pub x2: u32,
    pub y2: u32,
    pub confidence: f64,
}

#[derive(Debug)]
pub enum EnricherError {
    IoError(std::io::Error),
    ProcessError(String),
    ParseError(String),
}

impl From<std::io::Error> for EnricherError {
    fn from(e: std::io::Error) -> Self {
        EnricherError::IoError(e)
    }
}

fn parse_hocr(hocr: &str) -> (String, Vec<WordBox>) {
    let mut word_boxes = Vec::new();
    let mut full_text_parts: Vec<String> = Vec::new();

    // Parse ocrx_word spans for bounding boxes and confidence
    // Pattern: <span ... class='ocrx_word' ... title='bbox X1 Y1 X2 Y2; x_wconf NN'>WORD</span>
    let mut search_pos = 0;
    while let Some(span_start) = hocr[search_pos..].find("ocrx_word") {
        let abs_start = search_pos + span_start;

        // Find the title attribute containing bbox coordinates
        let title_region = &hocr[abs_start..std::cmp::min(abs_start + 500, hocr.len())];
        if let Some(title_start) = title_region.find("title='") {
            let title_content_start = abs_start + title_start + 7;
            if let Some(title_end) = hocr[title_content_start..].find('\'') {
                let title = &hocr[title_content_start..title_content_start + title_end];

                // Extract bbox coordinates
                let mut x1 = 0u32;
                let mut y1 = 0u32;
                let mut x2 = 0u32;
                let mut y2 = 0u32;
                let mut conf = 0u32;

                if let Some(bbox_start) = title.find("bbox ") {
                    let bbox_str = &title[bbox_start + 5..];
                    let coords: Vec<&str> = bbox_str.split_whitespace().collect();
                    if coords.len() >= 4 {
                        x1 = coords[0].trim_end_matches(';').parse().unwrap_or(0);
                        y1 = coords[1].trim_end_matches(';').parse().unwrap_or(0);
                        x2 = coords[2].trim_end_matches(';').parse().unwrap_or(0);
                        y2 = coords[3].trim_end_matches(';').parse().unwrap_or(0);
                    }
                }
                if let Some(wconf_start) = title.find("x_wconf ") {
                    let wconf_str = &title[wconf_start + 8..];
                    conf = wconf_str.split_whitespace().next()
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(0);
                }

                // Extract the word text between > and </span>
                let after_title = &hocr[title_content_start + title_end..];
                if let Some(gt) = after_title.find('>') {
                    let after_gt = &after_title[gt + 1..];
                    if let Some(lt) = after_gt.find('<') {
                        let word = after_gt[..lt].trim().to_string();
                        if !word.is_empty() {
                            full_text_parts.push(word.clone());
                            word_boxes.push(WordBox {
                                word,
                                x1,
                                y1,
                                x2,
                                y2,
                                confidence: conf as f64 / 100.0,
                            });
                        }
                    }
                }
            }
        }
        search_pos = abs_start + 10;
        if search_pos >= hocr.len() {
            break;
        }
    }

    let text = full_text_parts.join(" ");
    (text, word_boxes)
}

pub struct OcrTesseractEnricherProvider;

impl OcrTesseractEnricherProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn enrich(
        &self,
        item: &ContentItem,
        config: &EnricherConfig,
    ) -> Result<EnrichmentResult, EnricherError> {
        let opts = config.options.as_ref();
        let language = opts
            .and_then(|o| o.get("language"))
            .and_then(|v| v.as_str())
            .unwrap_or("eng");
        let psm = opts
            .and_then(|o| o.get("psm"))
            .and_then(|v| v.as_u64())
            .unwrap_or(3);
        let dpi = opts
            .and_then(|o| o.get("dpi"))
            .and_then(|v| v.as_u64())
            .unwrap_or(300);

        // Decode base64 image content and write to temp file
        let image_bytes = base64_decode(&item.content)
            .map_err(|e| EnricherError::ParseError(format!("Base64 decode failed: {}", e)))?;

        let tmp_path = std::env::temp_dir().join(format!("copf_ocr_{}_{}.png", item.id, std::process::id()));
        {
            let mut file = std::fs::File::create(&tmp_path)?;
            file.write_all(&image_bytes)?;
        }

        let result = Command::new("tesseract")
            .args([
                tmp_path.to_str().unwrap_or(""),
                "stdout",
                "-l", language,
                "--psm", &psm.to_string(),
                "--dpi", &dpi.to_string(),
                "hocr",
            ])
            .output();

        // Cleanup temp file
        let _ = std::fs::remove_file(&tmp_path);

        let output = result?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(EnricherError::ProcessError(format!("Tesseract failed: {}", stderr)));
        }

        let hocr = String::from_utf8_lossy(&output.stdout).to_string();
        let (text, word_boxes) = parse_hocr(&hocr);

        let avg_confidence = if word_boxes.is_empty() {
            0.0
        } else {
            word_boxes.iter().map(|w| w.confidence).sum::<f64>() / word_boxes.len() as f64
        };

        let word_count = word_boxes.len();
        let mut fields = HashMap::new();
        fields.insert("extracted_text".to_string(), serde_json::json!(text));
        fields.insert("word_boxes".to_string(), serde_json::json!(word_boxes));
        fields.insert("word_count".to_string(), serde_json::json!(word_count));

        let mut metadata = HashMap::new();
        metadata.insert("provider".to_string(), serde_json::json!(PROVIDER_ID));
        metadata.insert("language".to_string(), serde_json::json!(language));
        metadata.insert("psm".to_string(), serde_json::json!(psm));
        metadata.insert("dpi".to_string(), serde_json::json!(dpi));

        Ok(EnrichmentResult {
            fields,
            confidence: avg_confidence,
            metadata: Some(metadata),
        })
    }

    pub fn applies_to(&self, schema: &SchemaRef) -> bool {
        let image_schemas = ["image", "document_scan", "scanned_page", "photo"];
        let name_lower = schema.name.to_lowercase();
        image_schemas.iter().any(|s| name_lower.contains(s))
    }

    pub fn cost_estimate(&self, item: &ContentItem) -> CostEstimate {
        let size_kb = item.content.len() as f64 * 3.0 / 4.0 / 1024.0;
        let estimated_ms = (size_kb * 2.0).max(500.0).min(30000.0);
        CostEstimate {
            tokens: None,
            api_calls: Some(0),
            duration_ms: Some(estimated_ms as u64),
        }
    }
}

fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    // Minimal base64 decoding without external crate dependency
    let table: Vec<u8> = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
        .iter().copied().collect();
    let mut output = Vec::new();
    let chars: Vec<u8> = input.bytes().filter(|b| !b.is_ascii_whitespace()).collect();
    for chunk in chars.chunks(4) {
        let mut buf = [0u8; 4];
        let mut count = 0;
        for (i, &byte) in chunk.iter().enumerate() {
            if byte == b'=' {
                break;
            }
            buf[i] = table.iter().position(|&c| c == byte)
                .ok_or_else(|| format!("Invalid base64 char: {}", byte as char))? as u8;
            count = i + 1;
        }
        if count >= 2 { output.push((buf[0] << 2) | (buf[1] >> 4)); }
        if count >= 3 { output.push((buf[1] << 4) | (buf[2] >> 2)); }
        if count >= 4 { output.push((buf[2] << 6) | buf[3]); }
    }
    Ok(output)
}

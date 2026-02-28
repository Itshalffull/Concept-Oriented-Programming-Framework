// Clef Data Integration Kit - Cloud OCR enricher provider (AWS Textract, Google Vision, Azure)
// Builds HTTP requests to cloud OCR APIs, parses structured responses with tables/forms/key-value pairs.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpStream;

pub const PROVIDER_ID: &str = "ocr_cloud";
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
pub struct TableCell {
    pub row: usize,
    pub col: usize,
    pub text: String,
    pub confidence: f64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct FormField {
    pub key: String,
    pub value: String,
    pub confidence: f64,
}

#[derive(Debug)]
pub enum EnricherError {
    NetworkError(String),
    ApiError(String),
    ParseError(String),
    ConfigError(String),
}

#[derive(Debug, Clone, PartialEq)]
pub enum CloudProvider {
    Textract,
    Vision,
    Azure,
}

impl CloudProvider {
    fn from_str(s: &str) -> Result<Self, EnricherError> {
        match s.to_lowercase().as_str() {
            "textract" => Ok(CloudProvider::Textract),
            "vision" => Ok(CloudProvider::Vision),
            "azure" => Ok(CloudProvider::Azure),
            _ => Err(EnricherError::ConfigError(format!("Unknown provider: {}", s))),
        }
    }
}

struct HttpRequest {
    hostname: String,
    path: String,
    headers: Vec<(String, String)>,
    body: String,
}

fn build_textract_request(image_b64: &str, region: &str, api_key: &str) -> HttpRequest {
    let body = format!(
        r#"{{"Document":{{"Bytes":"{}"}},"FeatureTypes":["TABLES","FORMS"]}}"#,
        image_b64
    );
    let host = format!("textract.{}.amazonaws.com", region);
    HttpRequest {
        hostname: host.clone(),
        path: "/".to_string(),
        headers: vec![
            ("Host".to_string(), host),
            ("Content-Type".to_string(), "application/x-amz-json-1.1".to_string()),
            ("X-Amz-Target".to_string(), "Textract.AnalyzeDocument".to_string()),
            ("Authorization".to_string(), format!("AWS4-HMAC-SHA256 Credential={}", api_key)),
            ("Content-Length".to_string(), body.len().to_string()),
        ],
        body,
    }
}

fn build_vision_request(image_b64: &str, api_key: &str) -> HttpRequest {
    let body = format!(
        r#"{{"requests":[{{"image":{{"content":"{}"}},"features":[{{"type":"DOCUMENT_TEXT_DETECTION","maxResults":50}},{{"type":"TEXT_DETECTION","maxResults":50}}]}}]}}"#,
        image_b64
    );
    HttpRequest {
        hostname: "vision.googleapis.com".to_string(),
        path: format!("/v1/images:annotate?key={}", api_key),
        headers: vec![
            ("Host".to_string(), "vision.googleapis.com".to_string()),
            ("Content-Type".to_string(), "application/json".to_string()),
            ("Content-Length".to_string(), body.len().to_string()),
        ],
        body,
    }
}

fn build_azure_request(image_b64: &str, api_key: &str, region: &str) -> HttpRequest {
    let body = format!(r#"{{"url":"data:image/png;base64,{}"}}"#, image_b64);
    let host = format!("{}.api.cognitive.microsoft.com", region);
    HttpRequest {
        hostname: host.clone(),
        path: "/vision/v3.2/read/analyze?readingOrder=natural".to_string(),
        headers: vec![
            ("Host".to_string(), host),
            ("Content-Type".to_string(), "application/json".to_string()),
            ("Ocp-Apim-Subscription-Key".to_string(), api_key.to_string()),
            ("Content-Length".to_string(), body.len().to_string()),
        ],
        body,
    }
}

fn parse_textract_response(json: &serde_json::Value) -> (String, Vec<TableCell>, Vec<FormField>, f64) {
    let blocks = json.get("Blocks").and_then(|b| b.as_array());
    let empty_vec = vec![];
    let blocks = blocks.unwrap_or(&empty_vec);

    // Extract LINE blocks for full text
    let mut lines: Vec<String> = Vec::new();
    let mut total_conf = 0.0;
    let mut conf_count = 0usize;

    for block in blocks {
        let block_type = block.get("BlockType").and_then(|b| b.as_str()).unwrap_or("");
        if block_type == "LINE" {
            if let Some(text) = block.get("Text").and_then(|t| t.as_str()) {
                lines.push(text.to_string());
            }
            if let Some(c) = block.get("Confidence").and_then(|c| c.as_f64()) {
                total_conf += c / 100.0;
                conf_count += 1;
            }
        }
    }

    // Parse TABLE blocks
    let mut tables: Vec<TableCell> = Vec::new();
    for block in blocks {
        let block_type = block.get("BlockType").and_then(|b| b.as_str()).unwrap_or("");
        if block_type == "CELL" {
            let row = block.get("RowIndex").and_then(|r| r.as_u64()).unwrap_or(0) as usize;
            let col = block.get("ColumnIndex").and_then(|c| c.as_u64()).unwrap_or(0) as usize;
            let conf = block.get("Confidence").and_then(|c| c.as_f64()).unwrap_or(0.0) / 100.0;
            // Resolve child WORD blocks for cell text
            let child_ids: Vec<&str> = block.get("Relationships")
                .and_then(|r| r.as_array())
                .unwrap_or(&empty_vec)
                .iter()
                .filter(|r| r.get("Type").and_then(|t| t.as_str()) == Some("CHILD"))
                .flat_map(|r| r.get("Ids").and_then(|ids| ids.as_array()).unwrap_or(&empty_vec))
                .filter_map(|id| id.as_str())
                .collect();

            let cell_text: String = child_ids.iter()
                .filter_map(|cid| {
                    blocks.iter().find(|b| b.get("Id").and_then(|i| i.as_str()) == Some(cid))
                })
                .filter_map(|b| b.get("Text").and_then(|t| t.as_str()))
                .collect::<Vec<&str>>()
                .join(" ");

            tables.push(TableCell { row, col, text: cell_text, confidence: conf });
        }
    }

    // Parse KEY_VALUE_SET blocks for form fields
    let mut forms: Vec<FormField> = Vec::new();
    for block in blocks {
        let block_type = block.get("BlockType").and_then(|b| b.as_str()).unwrap_or("");
        let entity_types = block.get("EntityTypes").and_then(|e| e.as_array());
        let is_key = entity_types.map_or(false, |et| {
            et.iter().any(|v| v.as_str() == Some("KEY"))
        });

        if block_type == "KEY_VALUE_SET" && is_key {
            let conf = block.get("Confidence").and_then(|c| c.as_f64()).unwrap_or(0.0) / 100.0;
            let key_text = resolve_block_text(block, blocks, "CHILD");
            let value_text = resolve_block_text(block, blocks, "VALUE");
            forms.push(FormField { key: key_text, value: value_text, confidence: conf });
        }
    }

    let avg_conf = if conf_count > 0 { total_conf / conf_count as f64 } else { 0.0 };
    (lines.join("\n"), tables, forms, avg_conf)
}

fn resolve_block_text(block: &serde_json::Value, all_blocks: &[serde_json::Value], rel_type: &str) -> String {
    let empty = vec![];
    let relationships = block.get("Relationships").and_then(|r| r.as_array()).unwrap_or(&empty);
    let ids: Vec<&str> = relationships.iter()
        .filter(|r| r.get("Type").and_then(|t| t.as_str()) == Some(rel_type))
        .flat_map(|r| r.get("Ids").and_then(|ids| ids.as_array()).unwrap_or(&empty))
        .filter_map(|id| id.as_str())
        .collect();

    ids.iter()
        .filter_map(|id| all_blocks.iter().find(|b| b.get("Id").and_then(|i| i.as_str()) == Some(id)))
        .filter_map(|b| b.get("Text").and_then(|t| t.as_str()))
        .collect::<Vec<&str>>()
        .join(" ")
}

fn parse_vision_response(json: &serde_json::Value) -> (String, Vec<TableCell>, Vec<FormField>, f64) {
    let text = json.pointer("/responses/0/fullTextAnnotation/text")
        .and_then(|t| t.as_str())
        .unwrap_or("")
        .to_string();

    let mut total_conf = 0.0;
    let mut count = 0usize;
    if let Some(pages) = json.pointer("/responses/0/fullTextAnnotation/pages").and_then(|p| p.as_array()) {
        for page in pages {
            if let Some(blocks) = page.get("blocks").and_then(|b| b.as_array()) {
                for block in blocks {
                    if let Some(c) = block.get("confidence").and_then(|c| c.as_f64()) {
                        total_conf += c;
                        count += 1;
                    }
                }
            }
        }
    }

    let confidence = if count > 0 { total_conf / count as f64 } else { 0.0 };
    (text, vec![], vec![], confidence)
}

pub struct OcrCloudEnricherProvider;

impl OcrCloudEnricherProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn enrich(
        &self,
        item: &ContentItem,
        config: &EnricherConfig,
    ) -> Result<EnrichmentResult, EnricherError> {
        let opts = config.options.as_ref();
        let provider_str = opts
            .and_then(|o| o.get("provider"))
            .and_then(|v| v.as_str())
            .unwrap_or("textract");
        let provider = CloudProvider::from_str(provider_str)?;
        let api_key = config.api_key.as_deref().unwrap_or("");
        let region = opts
            .and_then(|o| o.get("region"))
            .and_then(|v| v.as_str())
            .unwrap_or("us-east-1");

        let request = match provider {
            CloudProvider::Textract => build_textract_request(&item.content, region, api_key),
            CloudProvider::Vision => build_vision_request(&item.content, api_key),
            CloudProvider::Azure => build_azure_request(&item.content, api_key, region),
        };

        // Execute HTTPS request (simplified — production would use TLS)
        let http_body = format!(
            "POST {} HTTP/1.1\r\nHost: {}\r\n{}\r\n\r\n{}",
            request.path,
            request.hostname,
            request.headers.iter()
                .map(|(k, v)| format!("{}: {}", k, v))
                .collect::<Vec<_>>()
                .join("\r\n"),
            request.body
        );

        let addr = format!("{}:443", request.hostname);
        let mut stream = TcpStream::connect(&addr)
            .map_err(|e| EnricherError::NetworkError(format!("Connection failed: {}", e)))?;
        stream.write_all(http_body.as_bytes())
            .map_err(|e| EnricherError::NetworkError(format!("Write failed: {}", e)))?;

        let mut response_buf = Vec::new();
        stream.read_to_end(&mut response_buf)
            .map_err(|e| EnricherError::NetworkError(format!("Read failed: {}", e)))?;

        let response_str = String::from_utf8_lossy(&response_buf);
        let body_start = response_str.find("\r\n\r\n").unwrap_or(0) + 4;
        let json_body = &response_str[body_start..];
        let json: serde_json::Value = serde_json::from_str(json_body)
            .map_err(|e| EnricherError::ParseError(format!("JSON parse error: {}", e)))?;

        let (text, tables, forms, confidence) = match provider {
            CloudProvider::Textract => parse_textract_response(&json),
            CloudProvider::Vision => parse_vision_response(&json),
            CloudProvider::Azure => {
                let azure_text = json.pointer("/analyzeResult/readResults")
                    .and_then(|r| r.as_array())
                    .map(|results| {
                        results.iter()
                            .flat_map(|r| r.get("lines").and_then(|l| l.as_array()).unwrap_or(&vec![]).iter())
                            .filter_map(|l| l.get("text").and_then(|t| t.as_str()))
                            .collect::<Vec<&str>>()
                            .join("\n")
                    })
                    .unwrap_or_default();
                (azure_text, vec![], vec![], 0.9)
            }
        };

        let mut fields = HashMap::new();
        fields.insert("structured_text".to_string(), serde_json::json!(text));
        fields.insert("tables".to_string(), serde_json::json!(tables));
        fields.insert("forms".to_string(), serde_json::json!(forms));

        let mut metadata = HashMap::new();
        metadata.insert("provider".to_string(), serde_json::json!(PROVIDER_ID));
        metadata.insert("cloudProvider".to_string(), serde_json::json!(provider_str));
        metadata.insert("region".to_string(), serde_json::json!(region));

        Ok(EnrichmentResult {
            fields,
            confidence,
            metadata: Some(metadata),
        })
    }

    pub fn applies_to(&self, schema: &SchemaRef) -> bool {
        let applicable = ["image", "document", "scan", "receipt", "invoice", "form"];
        let name_lower = schema.name.to_lowercase();
        applicable.iter().any(|s| name_lower.contains(s))
    }

    pub fn cost_estimate(&self, item: &ContentItem) -> CostEstimate {
        let size_kb = item.content.len() as f64 * 3.0 / 4.0 / 1024.0;
        let pages = (size_kb / 200.0).ceil().max(1.0) as u64;
        CostEstimate {
            tokens: None,
            api_calls: Some(1),
            duration_ms: Some(1500 + pages * 500),
        }
    }
}

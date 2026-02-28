// Clef Data Integration Kit - Vision-Language Model captioning enricher provider
// Sends image to VLM API endpoint, receives caption + detailed description + detected objects.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpStream;

pub const PROVIDER_ID: &str = "vlm_caption";
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

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DetectedObject {
    pub label: String,
    pub confidence: f64,
    pub bbox: BoundingBox,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BoundingBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug)]
pub enum EnricherError {
    NetworkError(String),
    ApiError(String),
    ParseError(String),
}

const DEFAULT_CAPTION_PROMPT: &str = r#"Analyze this image and provide:
1. A concise caption (1 sentence)
2. A detailed description (2-4 sentences)
3. A list of detected objects with confidence scores

Respond in JSON format:
{
  "caption": "...",
  "description": "...",
  "detected_objects": [{"label": "...", "confidence": 0.0-1.0, "bbox": {"x": 0, "y": 0, "width": 0, "height": 0}}]
}"#;

struct ApiEndpoint {
    hostname: String,
    path: String,
}

fn determine_api_endpoint(model: &str) -> ApiEndpoint {
    if model.starts_with("gpt-4") {
        ApiEndpoint {
            hostname: "api.openai.com".to_string(),
            path: "/v1/chat/completions".to_string(),
        }
    } else if model.starts_with("claude") {
        ApiEndpoint {
            hostname: "api.anthropic.com".to_string(),
            path: "/v1/messages".to_string(),
        }
    } else if model.starts_with("gemini") {
        ApiEndpoint {
            hostname: "generativelanguage.googleapis.com".to_string(),
            path: format!("/v1/models/{}:generateContent", model),
        }
    } else {
        ApiEndpoint {
            hostname: "api.openai.com".to_string(),
            path: "/v1/chat/completions".to_string(),
        }
    }
}

fn build_vlm_request_body(image_b64: &str, model: &str, max_tokens: u64, prompt: &str) -> String {
    if model.starts_with("claude") {
        format!(
            r#"{{"model":"{}","max_tokens":{},"messages":[{{"role":"user","content":[{{"type":"image","source":{{"type":"base64","media_type":"image/png","data":"{}"}}}},{{"type":"text","text":"{}"}}]}}]}}"#,
            model, max_tokens,
            image_b64,
            prompt.replace('"', r#"\""#).replace('\n', "\\n")
        )
    } else {
        format!(
            r#"{{"model":"{}","max_tokens":{},"messages":[{{"role":"user","content":[{{"type":"image_url","image_url":{{"url":"data:image/png;base64,{}"}}}},{{"type":"text","text":"{}"}}]}}]}}"#,
            model, max_tokens,
            image_b64,
            prompt.replace('"', r#"\""#).replace('\n', "\\n")
        )
    }
}

fn parse_vlm_response(json: &serde_json::Value, model: &str) -> (String, String, Vec<DetectedObject>) {
    // Extract text content based on API format
    let text_content = if model.starts_with("claude") {
        json.pointer("/content/0/text")
            .and_then(|t| t.as_str())
            .unwrap_or("")
    } else if model.starts_with("gemini") {
        json.pointer("/candidates/0/content/parts/0/text")
            .and_then(|t| t.as_str())
            .unwrap_or("")
    } else {
        json.pointer("/choices/0/message/content")
            .and_then(|t| t.as_str())
            .unwrap_or("")
    };

    // Extract JSON from possible markdown code block
    let json_str = if let Some(start) = text_content.find("```") {
        let after_backticks = &text_content[start + 3..];
        let content_start = after_backticks.find('\n').map(|i| i + 1).unwrap_or(0);
        let content = &after_backticks[content_start..];
        if let Some(end) = content.find("```") {
            content[..end].trim()
        } else {
            text_content
        }
    } else {
        text_content
    };

    // Parse the structured JSON response
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(json_str) {
        let caption = parsed.get("caption").and_then(|c| c.as_str()).unwrap_or("").to_string();
        let description = parsed.get("description").and_then(|d| d.as_str()).unwrap_or("").to_string();

        let detected_objects: Vec<DetectedObject> = parsed.get("detected_objects")
            .and_then(|arr| arr.as_array())
            .map(|arr| {
                arr.iter().filter_map(|obj| {
                    let label = obj.get("label").and_then(|l| l.as_str())?.to_string();
                    let confidence = obj.get("confidence").and_then(|c| c.as_f64()).unwrap_or(0.5);
                    let bbox_val = obj.get("bbox")?;
                    let bbox = BoundingBox {
                        x: bbox_val.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0),
                        y: bbox_val.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0),
                        width: bbox_val.get("width").and_then(|v| v.as_f64()).unwrap_or(0.0),
                        height: bbox_val.get("height").and_then(|v| v.as_f64()).unwrap_or(0.0),
                    };
                    Some(DetectedObject { label, confidence, bbox })
                }).collect()
            })
            .unwrap_or_default();

        (caption, description, detected_objects)
    } else {
        // Fallback: use raw text as caption
        let truncated = if text_content.len() > 200 {
            &text_content[..200]
        } else {
            text_content
        };
        (truncated.to_string(), text_content.to_string(), vec![])
    }
}

pub struct VlmCaptionEnricherProvider;

impl VlmCaptionEnricherProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn enrich(
        &self,
        item: &ContentItem,
        config: &EnricherConfig,
    ) -> Result<EnrichmentResult, EnricherError> {
        let model = config.model.as_deref().unwrap_or("gpt-4o");
        let api_key = config.api_key.as_deref().unwrap_or("");
        let opts = config.options.as_ref();
        let max_tokens = opts
            .and_then(|o| o.get("maxTokens"))
            .and_then(|v| v.as_u64())
            .unwrap_or(1024);
        let prompt = opts
            .and_then(|o| o.get("promptTemplate"))
            .and_then(|v| v.as_str())
            .unwrap_or(DEFAULT_CAPTION_PROMPT);

        let endpoint = determine_api_endpoint(model);
        let body = build_vlm_request_body(&item.content, model, max_tokens, prompt);

        // Build HTTP request with appropriate auth headers
        let auth_header = if model.starts_with("claude") {
            format!("x-api-key: {}\r\nanthropic-version: 2023-06-01", api_key)
        } else {
            format!("Authorization: Bearer {}", api_key)
        };

        let http_request = format!(
            "POST {} HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n{}\r\n\r\n{}",
            endpoint.path, endpoint.hostname, body.len(), auth_header, body
        );

        let addr = format!("{}:443", endpoint.hostname);
        let mut stream = TcpStream::connect(&addr)
            .map_err(|e| EnricherError::NetworkError(format!("Connection failed: {}", e)))?;
        stream.write_all(http_request.as_bytes())
            .map_err(|e| EnricherError::NetworkError(format!("Write failed: {}", e)))?;

        let mut response_buf = Vec::new();
        stream.read_to_end(&mut response_buf)
            .map_err(|e| EnricherError::NetworkError(format!("Read failed: {}", e)))?;

        let response_str = String::from_utf8_lossy(&response_buf);
        let body_start = response_str.find("\r\n\r\n").unwrap_or(0) + 4;
        let json_body = &response_str[body_start..];
        let response_json: serde_json::Value = serde_json::from_str(json_body)
            .map_err(|e| EnricherError::ParseError(format!("JSON parse error: {}", e)))?;

        let (caption, description, detected_objects) = parse_vlm_response(&response_json, model);

        let obj_confidence = if detected_objects.is_empty() {
            0.7
        } else {
            detected_objects.iter().map(|o| o.confidence).sum::<f64>() / detected_objects.len() as f64
        };
        let overall_confidence = if !caption.is_empty() {
            ((obj_confidence + 0.8) / 2.0).min(1.0)
        } else {
            0.3
        };

        let mut fields = HashMap::new();
        fields.insert("caption".to_string(), serde_json::json!(caption));
        fields.insert("description".to_string(), serde_json::json!(description));
        fields.insert("detected_objects".to_string(), serde_json::json!(detected_objects));
        fields.insert("object_count".to_string(), serde_json::json!(detected_objects.len()));

        let mut metadata = HashMap::new();
        metadata.insert("provider".to_string(), serde_json::json!(PROVIDER_ID));
        metadata.insert("model".to_string(), serde_json::json!(model));

        Ok(EnrichmentResult {
            fields,
            confidence: overall_confidence,
            metadata: Some(metadata),
        })
    }

    pub fn applies_to(&self, schema: &SchemaRef) -> bool {
        let image_schemas = ["image", "photo", "screenshot", "figure", "diagram", "visual"];
        let name_lower = schema.name.to_lowercase();
        image_schemas.iter().any(|s| name_lower.contains(s))
    }

    pub fn cost_estimate(&self, item: &ContentItem) -> CostEstimate {
        let image_size_kb = item.content.len() as f64 * 3.0 / 4.0 / 1024.0;
        let estimated_tiles = (image_size_kb / 100.0).ceil().max(1.0) as u64;
        let image_tokens = estimated_tiles * 85;
        let output_tokens = 500;

        CostEstimate {
            tokens: Some(image_tokens + output_tokens),
            api_calls: Some(1),
            duration_ms: Some(3000 + estimated_tiles * 200),
        }
    }
}

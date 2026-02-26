// Clef Data Integration Kit - LLM structured data extraction enricher provider
// Builds prompt with target schema + content, calls LLM API, parses JSON response.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpStream;

pub const PROVIDER_ID: &str = "llm_structured_extract";
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
pub struct TargetSchemaField {
    pub name: String,
    #[serde(rename = "type")]
    pub field_type: String,
    pub description: Option<String>,
    pub required: Option<bool>,
    #[serde(rename = "enum")]
    pub enum_values: Option<Vec<String>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TargetSchema {
    pub name: String,
    pub fields: Vec<TargetSchemaField>,
}

#[derive(Debug)]
pub enum EnricherError {
    NetworkError(String),
    ApiError(String),
    ParseError(String),
    ConfigError(String),
}

fn build_extraction_prompt(content: &str, schema: &TargetSchema, instructions: &str) -> String {
    let schema_desc: String = schema.fields.iter().map(|f| {
        let mut desc = format!("  \"{}\": {}", f.name, f.field_type);
        if let Some(ref d) = f.description { desc += &format!(" // {}", d); }
        if f.required.unwrap_or(false) { desc += " (REQUIRED)"; }
        if let Some(ref e) = f.enum_values { desc += &format!(" (one of: {})", e.join(", ")); }
        desc
    }).collect::<Vec<_>>().join("\n");

    let json_template: String = schema.fields.iter().map(|f| {
        let default = match f.field_type.as_str() {
            "string" => "\"\"",
            "number" | "integer" => "0",
            "boolean" => "false",
            "array" => "[]",
            _ => "null",
        };
        format!("  \"{}\": {}", f.name, default)
    }).collect::<Vec<_>>().join(",\n");

    let truncated_content = if content.len() > 12000 { &content[..12000] } else { content };
    let instr = if instructions.is_empty() {
        "Extract all relevant fields from the content. Use null for fields that cannot be determined."
    } else { instructions };

    format!(
r#"Extract structured data from the following content according to the target schema.

## Target Schema: {}
Fields:
{}

## Expected JSON Output Format:
{{
{}
}}

## Additional Instructions:
{}

## Important:
- Return ONLY valid JSON matching the schema above.
- For each field, also provide a confidence score (0.0-1.0) in a separate "_confidence" object.
- Your response MUST be valid JSON with two top-level keys: "data" and "_confidence".

Example response format:
{{
  "data": {{ ... extracted fields ... }},
  "_confidence": {{ "field1": 0.95, "field2": 0.7, ... }}
}}

## Content to Extract From:
{}"#,
        schema.name, schema_desc, json_template, instr, truncated_content
    )
}

fn get_api_endpoint(model: &str) -> (&'static str, &'static str) {
    if model.starts_with("claude") {
        ("api.anthropic.com", "/v1/messages")
    } else {
        ("api.openai.com", "/v1/chat/completions")
    }
}

fn build_api_request_body(model: &str, prompt: &str, max_tokens: u64) -> String {
    let escaped_prompt = prompt.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t");

    if model.starts_with("claude") {
        format!(
            r#"{{"model":"{}","max_tokens":{},"messages":[{{"role":"user","content":"{}"}}]}}"#,
            model, max_tokens, escaped_prompt
        )
    } else {
        format!(
            r#"{{"model":"{}","max_tokens":{},"messages":[{{"role":"system","content":"You are a precise data extraction assistant. Always respond with valid JSON."}},{{"role":"user","content":"{}"}}],"response_format":{{"type":"json_object"}}}}"#,
            model, max_tokens, escaped_prompt
        )
    }
}

fn parse_extracted_data(
    json: &serde_json::Value,
    model: &str,
    schema: &TargetSchema,
) -> (HashMap<String, serde_json::Value>, HashMap<String, f64>) {
    let text_content = if model.starts_with("claude") {
        json.pointer("/content/0/text").and_then(|t| t.as_str()).unwrap_or("")
    } else {
        json.pointer("/choices/0/message/content").and_then(|t| t.as_str()).unwrap_or("")
    };

    // Strip markdown code blocks
    let json_str = if let Some(start) = text_content.find("```") {
        let after = &text_content[start + 3..];
        let content_start = after.find('\n').map(|i| i + 1).unwrap_or(0);
        let c = &after[content_start..];
        if let Some(end) = c.find("```") { c[..end].trim() } else { text_content }
    } else { text_content };

    let parsed: serde_json::Value = match serde_json::from_str(json_str) {
        Ok(v) => v,
        Err(_) => return (HashMap::new(), HashMap::new()),
    };

    // Handle data + _confidence format
    if let Some(data_obj) = parsed.get("data").and_then(|d| d.as_object()) {
        let data: HashMap<String, serde_json::Value> = data_obj.iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect();

        let confidence: HashMap<String, f64> = parsed.get("_confidence")
            .and_then(|c| c.as_object())
            .map(|obj| obj.iter()
                .map(|(k, v)| (k.clone(), v.as_f64().unwrap_or(0.5)))
                .collect())
            .unwrap_or_default();

        return (data, confidence);
    }

    // Fallback: flat structure
    let data: HashMap<String, serde_json::Value> = parsed.as_object()
        .map(|obj| obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
        .unwrap_or_default();

    let confidence: HashMap<String, f64> = schema.fields.iter().map(|f| {
        let conf = if data.get(&f.name).is_some_and(|v| !v.is_null()) { 0.7 } else { 0.0 };
        (f.name.clone(), conf)
    }).collect();

    (data, confidence)
}

fn validate_against_schema(
    data: &HashMap<String, serde_json::Value>,
    schema: &TargetSchema,
) -> (bool, Vec<String>, f64) {
    let mut errors = Vec::new();
    let mut filled = 0usize;

    for field in &schema.fields {
        let value = data.get(&field.name);
        if field.required.unwrap_or(false) && (value.is_none() || value.map_or(false, |v| v.is_null())) {
            errors.push(format!("Required field \"{}\" is missing", field.name));
            continue;
        }
        if value.is_none() || value.map_or(false, |v| v.is_null()) { continue; }
        filled += 1;

        let v = value.unwrap();
        match field.field_type.as_str() {
            "string" if !v.is_string() => errors.push(format!("Field \"{}\" should be string", field.name)),
            "number" | "integer" if !v.is_number() => errors.push(format!("Field \"{}\" should be {}", field.name, field.field_type)),
            "boolean" if !v.is_boolean() => errors.push(format!("Field \"{}\" should be boolean", field.name)),
            "array" if !v.is_array() => errors.push(format!("Field \"{}\" should be array", field.name)),
            _ => {}
        }

        if let Some(ref enum_vals) = field.enum_values {
            let str_val = v.as_str().unwrap_or("");
            if !enum_vals.contains(&str_val.to_string()) {
                errors.push(format!("Field \"{}\" value not in allowed values", field.name));
            }
        }
    }

    let completeness = if schema.fields.is_empty() { 0.0 } else { filled as f64 / schema.fields.len() as f64 };
    (errors.is_empty(), errors, completeness)
}

pub struct LlmStructuredExtractEnricherProvider;

impl LlmStructuredExtractEnricherProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn enrich(
        &self,
        item: &ContentItem,
        config: &EnricherConfig,
    ) -> Result<EnrichmentResult, EnricherError> {
        let model = config.model.as_deref().unwrap_or("gpt-4o-mini");
        let api_key = config.api_key.as_deref().unwrap_or("");
        let opts = config.options.as_ref();

        let target_schema: TargetSchema = opts.and_then(|o| o.get("targetSchema"))
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or(TargetSchema {
                name: "generic".to_string(),
                fields: vec![
                    TargetSchemaField { name: "summary".to_string(), field_type: "string".to_string(), description: None, required: None, enum_values: None },
                    TargetSchemaField { name: "entities".to_string(), field_type: "array".to_string(), description: None, required: None, enum_values: None },
                ],
            });

        let instructions = opts.and_then(|o| o.get("instructions"))
            .and_then(|v| v.as_str()).unwrap_or("");
        let auto_accept_threshold = opts.and_then(|o| o.get("autoAcceptThreshold"))
            .and_then(|v| v.as_f64()).unwrap_or(0.8);
        let max_tokens = opts.and_then(|o| o.get("maxTokens"))
            .and_then(|v| v.as_u64()).unwrap_or(2000);

        let prompt = build_extraction_prompt(&item.content, &target_schema, instructions);
        let (hostname, path) = get_api_endpoint(model);
        let body = build_api_request_body(model, &prompt, max_tokens);

        let auth_header = if model.starts_with("claude") {
            format!("x-api-key: {}\r\nanthropic-version: 2023-06-01", api_key)
        } else {
            format!("Authorization: Bearer {}", api_key)
        };

        let http_request = format!(
            "POST {} HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n{}\r\n\r\n{}",
            path, hostname, body.len(), auth_header, body
        );

        let addr = format!("{}:443", hostname);
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

        let (data, confidence) = parse_extracted_data(&response_json, model, &target_schema);
        let (valid, errors, completeness) = validate_against_schema(&data, &target_schema);

        let field_results: Vec<serde_json::Value> = target_schema.fields.iter().map(|f| {
            serde_json::json!({
                "field": f.name,
                "value": data.get(&f.name),
                "confidence": confidence.get(&f.name).copied().unwrap_or(0.0),
                "source": if data.get(&f.name).is_some_and(|v| !v.is_null()) { "extracted" } else { "missing" },
            })
        }).collect();

        let avg_field_conf: f64 = if field_results.is_empty() { 0.0 } else {
            field_results.iter()
                .filter_map(|r| r.get("confidence").and_then(|c| c.as_f64()))
                .sum::<f64>() / field_results.len() as f64
        };

        let validity_factor = if valid { 1.0 } else { 0.7 };
        let overall_confidence = avg_field_conf * validity_factor * completeness;
        let auto_accepted = overall_confidence >= auto_accept_threshold;

        let mut fields = HashMap::new();
        fields.insert("extracted".to_string(), serde_json::json!(data));
        fields.insert("field_confidence".to_string(), serde_json::json!(confidence));
        fields.insert("field_results".to_string(), serde_json::json!(field_results));
        fields.insert("validation".to_string(), serde_json::json!({
            "valid": valid, "errors": errors,
            "completeness": (completeness * 100.0).round() / 100.0,
        }));
        fields.insert("auto_accepted".to_string(), serde_json::json!(auto_accepted));

        let mut metadata = HashMap::new();
        metadata.insert("provider".to_string(), serde_json::json!(PROVIDER_ID));
        metadata.insert("model".to_string(), serde_json::json!(model));
        metadata.insert("schemaName".to_string(), serde_json::json!(target_schema.name));
        metadata.insert("fieldCount".to_string(), serde_json::json!(target_schema.fields.len()));
        metadata.insert("autoAcceptThreshold".to_string(), serde_json::json!(auto_accept_threshold));

        Ok(EnrichmentResult {
            fields,
            confidence: (overall_confidence * 1000.0).round() / 1000.0,
            metadata: Some(metadata),
        })
    }

    pub fn applies_to(&self, _schema: &SchemaRef) -> bool {
        true // LLM extraction applies to any content type
    }

    pub fn cost_estimate(&self, item: &ContentItem) -> CostEstimate {
        let word_count = item.content.split_whitespace().count() as u64;
        let input_tokens = (word_count as f64 * 1.3) as u64 + 500;
        let output_tokens = 1000;
        CostEstimate {
            tokens: Some(input_tokens + output_tokens),
            api_calls: Some(1),
            duration_ms: Some(2000 + input_tokens / 100),
        }
    }
}

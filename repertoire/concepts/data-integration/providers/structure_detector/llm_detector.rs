// LLM-based structure detector — uses language model API for arbitrary structure detection
// Builds prompts from content + hint, parses structured JSON response from LLM

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

pub const PROVIDER_ID: &str = "llm_detector";
pub const PLUGIN_TYPE: &str = "structure_detector";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectorConfig {
    pub options: Option<HashMap<String, Value>>,
    pub confidence_threshold: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Detection {
    pub field: String,
    pub value: Value,
    pub r#type: String,
    pub confidence: f64,
    pub evidence: String,
}

#[derive(Debug)]
pub enum DetectorError {
    ParseError(String),
    RegexError(String),
    ApiError(String),
    ConfigError(String),
}

impl std::fmt::Display for DetectorError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DetectorError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            DetectorError::RegexError(msg) => write!(f, "Regex error: {}", msg),
            DetectorError::ApiError(msg) => write!(f, "API error: {}", msg),
            DetectorError::ConfigError(msg) => write!(f, "Config error: {}", msg),
        }
    }
}

fn get_option_str<'a>(options: &'a HashMap<String, Value>, key: &str) -> Option<&'a str> {
    options.get(key).and_then(|v| v.as_str())
}

fn get_option_u64(options: &HashMap<String, Value>, key: &str) -> Option<u64> {
    options.get(key).and_then(|v| v.as_u64())
}

fn build_prompt(content: &str, hint: Option<&str>) -> String {
    let mut prompt = String::from(
        "You are a structure detection assistant. Analyze the following content and extract structured data.\n\
         Return a JSON object with a \"detections\" array. Each detection must have:\n\
         - \"field\": string (the name of the detected structure)\n\
         - \"value\": any (the extracted value)\n\
         - \"type\": string (the data type)\n\
         - \"confidence\": number between 0 and 1\n\
         - \"evidence\": string (the text that supports this detection)\n\n\
         Return ONLY valid JSON, no markdown or explanation."
    );

    if let Some(h) = hint {
        prompt.push_str(&format!(
            "\n\nDetection hint: {}\nFocus your analysis on finding structures related to this hint.", h
        ));
    }

    let truncated = if content.len() > 4000 {
        format!("{}\n... [truncated]", &content[..4000])
    } else {
        content.to_string()
    };

    prompt.push_str(&format!("\n\nContent to analyze:\n---\n{}\n---", truncated));
    prompt
}

fn parse_json_response(response: &str) -> Option<Vec<Value>> {
    // Try direct parse
    if let Ok(val) = serde_json::from_str::<Value>(response) {
        if let Some(arr) = val.get("detections").and_then(|d| d.as_array()) {
            return Some(arr.clone());
        }
    }

    // Try extracting from markdown code block
    let code_block_re = Regex::new(r"```(?:json)?\s*\n?([\s\S]*?)\n?```").unwrap();
    if let Some(cap) = code_block_re.captures(response) {
        if let Ok(val) = serde_json::from_str::<Value>(&cap[1]) {
            if let Some(arr) = val.get("detections").and_then(|d| d.as_array()) {
                return Some(arr.clone());
            }
        }
    }

    // Try finding JSON object in response
    let json_re = Regex::new(r#"\{[\s\S]*"detections"\s*:\s*\[[\s\S]*\][\s\S]*\}"#).unwrap();
    if let Some(mat) = json_re.find(response) {
        if let Ok(val) = serde_json::from_str::<Value>(mat.as_str()) {
            if let Some(arr) = val.get("detections").and_then(|d| d.as_array()) {
                return Some(arr.clone());
            }
        }
    }

    None
}

fn build_api_request_body(prompt: &str, model: &str, max_tokens: u64, temperature: f64) -> Value {
    serde_json::json!({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "response_format": {"type": "json_object"}
    })
}

pub struct LlmDetectorProvider;

impl LlmDetectorProvider {
    pub fn new() -> Self { Self }

    /// Synchronous detect — returns empty since LLM calls require async.
    /// Use detect_async for actual LLM-based detection.
    pub fn detect(
        &self,
        _content: &str,
        _existing: &HashMap<String, Value>,
        _config: &DetectorConfig,
    ) -> Result<Vec<Detection>, DetectorError> {
        Ok(vec![])
    }

    /// Prepare the prompt and request body for an LLM API call.
    /// Returns (endpoint, headers, body_json) for the caller to execute.
    pub fn prepare_request(
        &self,
        content: &str,
        _existing: &HashMap<String, Value>,
        config: &DetectorConfig,
    ) -> Result<(String, HashMap<String, String>, String), DetectorError> {
        let options = config.options.as_ref()
            .ok_or_else(|| DetectorError::ConfigError("No options configured".into()))?;

        let api_key = get_option_str(options, "apiKey")
            .or_else(|| get_option_str(options, "api_key"));
        let endpoint = get_option_str(options, "apiEndpoint")
            .or_else(|| get_option_str(options, "api_endpoint"))
            .unwrap_or("https://api.openai.com/v1/chat/completions");
        let model = get_option_str(options, "model").unwrap_or("gpt-4o-mini");
        let max_tokens = get_option_u64(options, "maxTokens")
            .or_else(|| get_option_u64(options, "max_tokens"))
            .unwrap_or(2000);
        let hint = get_option_str(options, "hint");

        let prompt = build_prompt(content, hint);
        let body = build_api_request_body(&prompt, model, max_tokens, 0.1);
        let body_str = serde_json::to_string(&body)
            .map_err(|e| DetectorError::ParseError(e.to_string()))?;

        let mut headers = HashMap::new();
        headers.insert("Content-Type".to_string(), "application/json".to_string());
        if let Some(key) = api_key {
            headers.insert("Authorization".to_string(), format!("Bearer {}", key));
        }

        Ok((endpoint.to_string(), headers, body_str))
    }

    /// Parse an LLM API response into Detection objects.
    pub fn parse_response(
        &self,
        response_text: &str,
        config: &DetectorConfig,
    ) -> Result<Vec<Detection>, DetectorError> {
        let threshold = config.confidence_threshold.unwrap_or(0.5);

        // Extract the content from OpenAI-style response
        let content_str = if let Ok(val) = serde_json::from_str::<Value>(response_text) {
            val.get("choices")
                .and_then(|c| c.get(0))
                .and_then(|c| c.get("message"))
                .and_then(|m| m.get("content"))
                .and_then(|c| c.as_str())
                .unwrap_or(response_text)
                .to_string()
        } else {
            response_text.to_string()
        };

        let raw_detections = parse_json_response(&content_str)
            .ok_or_else(|| DetectorError::ParseError("Failed to parse LLM response".into()))?;

        let detections = raw_detections.iter().filter_map(|d| {
            let field = d.get("field").and_then(|f| f.as_str()).unwrap_or("unknown").to_string();
            let value = d.get("value").cloned().unwrap_or(Value::Null);
            let dtype = d.get("type").and_then(|t| t.as_str()).unwrap_or("unknown").to_string();
            let confidence = d.get("confidence").and_then(|c| c.as_f64()).unwrap_or(0.5).min(0.95);
            let evidence = d.get("evidence").and_then(|e| e.as_str()).unwrap_or("Detected by LLM").to_string();

            if confidence < threshold { return None; }

            Some(Detection { field, value, r#type: dtype, confidence, evidence })
        }).collect();

        Ok(detections)
    }

    pub fn applies_to(&self, _content_type: &str) -> bool {
        true // LLM detector can handle any content type
    }
}

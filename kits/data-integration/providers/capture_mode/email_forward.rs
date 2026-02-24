// Data Integration Kit - Email Forward Capture Provider
// Parses forwarded email via RFC 2822 headers and MIME multipart decoding

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "email_forward";
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
    MissingEmail,
    ParseError(String),
}

impl std::fmt::Display for CaptureError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CaptureError::MissingEmail => write!(f, "email_forward capture requires email content"),
            CaptureError::ParseError(e) => write!(f, "Parse error: {}", e),
        }
    }
}

#[derive(Debug, Clone, Default)]
struct EmailHeaders {
    from: String,
    to: String,
    subject: String,
    date: String,
    message_id: String,
    content_type: String,
    boundary: Option<String>,
    transfer_encoding: Option<String>,
}

#[derive(Debug, Clone)]
struct MimePart {
    content_type: String,
    encoding: Option<String>,
    body: String,
    filename: Option<String>,
}

fn split_headers_body(raw: &str) -> (&str, &str) {
    if let Some(pos) = raw.find("\n\n") {
        (&raw[..pos], raw[pos + 2..].trim())
    } else if let Some(pos) = raw.find("\r\n\r\n") {
        (&raw[..pos], raw[pos + 4..].trim())
    } else {
        (raw, "")
    }
}

fn parse_headers(raw: &str) -> EmailHeaders {
    // Unfold continuation lines
    let unfolded = regex::Regex::new(r"\r?\n[ \t]+").unwrap()
        .replace_all(raw, " ");

    let mut headers: HashMap<String, String> = HashMap::new();
    for line in unfolded.lines() {
        if let Some(colon_idx) = line.find(':') {
            let name = line[..colon_idx].trim().to_lowercase();
            let value = line[colon_idx + 1..].trim().to_string();
            headers.insert(name, value);
        }
    }

    let ct = headers.get("content-type").cloned().unwrap_or_else(|| "text/plain".to_string());
    let boundary = regex::Regex::new(r#"(?i)boundary=["']?([^"';\s]+)["']?"#).ok()
        .and_then(|re| re.captures(&ct))
        .map(|caps| caps[1].to_string());

    EmailHeaders {
        from: headers.get("from").cloned().unwrap_or_default(),
        to: headers.get("to").cloned().unwrap_or_default(),
        subject: headers.get("subject").cloned().unwrap_or_else(|| "(No Subject)".to_string()),
        date: headers.get("date").cloned().unwrap_or_default(),
        message_id: headers.get("message-id").cloned().unwrap_or_default(),
        content_type: ct,
        boundary,
        transfer_encoding: headers.get("content-transfer-encoding").cloned(),
    }
}

fn decode_quoted_printable(input: &str) -> String {
    let soft_removed = regex::Regex::new(r"=\r?\n").unwrap().replace_all(input, "");
    let hex_re = regex::Regex::new(r"=([0-9A-Fa-f]{2})").unwrap();
    hex_re.replace_all(&soft_removed, |caps: &regex::Captures| {
        let byte = u8::from_str_radix(&caps[1], 16).unwrap_or(b'?');
        String::from(byte as char)
    }).to_string()
}

fn decode_base64(input: &str) -> String {
    use base64::Engine;
    let cleaned: String = input.chars().filter(|c| !c.is_whitespace()).collect();
    base64::engine::general_purpose::STANDARD.decode(&cleaned)
        .ok()
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .unwrap_or_else(|| input.to_string())
}

fn decode_body(body: &str, encoding: Option<&str>) -> String {
    match encoding.map(|e| e.to_lowercase()).as_deref() {
        Some("quoted-printable") => decode_quoted_printable(body),
        Some("base64") => decode_base64(body),
        _ => body.to_string(),
    }
}

fn parse_multipart(body: &str, boundary: &str) -> Vec<MimePart> {
    let delimiter = format!("--{}", boundary);
    let segments: Vec<&str> = body.split(&delimiter).collect();
    let mut parts = Vec::new();

    for segment in segments {
        let trimmed = segment.trim();
        if trimmed.is_empty() || trimmed == "--" { continue; }

        let header_end = if let Some(pos) = trimmed.find("\n\n") {
            pos
        } else if let Some(pos) = trimmed.find("\r\n\r\n") {
            pos
        } else {
            continue;
        };

        let header_section = &trimmed[..header_end];
        let body_section = trimmed[header_end..].trim();

        let mut part_headers: HashMap<String, String> = HashMap::new();
        let unfolded = regex::Regex::new(r"\r?\n[ \t]+").unwrap()
            .replace_all(header_section, " ");
        for line in unfolded.lines() {
            if let Some(colon_idx) = line.find(':') {
                let name = line[..colon_idx].trim().to_lowercase();
                let value = line[colon_idx + 1..].trim().to_string();
                part_headers.insert(name, value);
            }
        }

        let ct = part_headers.get("content-type")
            .map(|s| s.split(';').next().unwrap_or("text/plain").trim().to_string())
            .unwrap_or_else(|| "text/plain".to_string());
        let encoding = part_headers.get("content-transfer-encoding").cloned();
        let disposition = part_headers.get("content-disposition").cloned().unwrap_or_default();
        let filename = regex::Regex::new(r#"(?i)filename=["']?([^"';\s]+)["']?"#).ok()
            .and_then(|re| re.captures(&disposition))
            .map(|caps| caps[1].to_string());

        parts.push(MimePart {
            content_type: ct,
            encoding: encoding.clone(),
            body: decode_body(body_section, encoding.as_deref()),
            filename,
        });
    }
    parts
}

fn extract_forward_chain(body: &str) -> Vec<String> {
    let re = regex::Regex::new(r"[-]+\s*(?:Forwarded|Original)\s+[Mm]essage\s*[-]+").unwrap();
    let segments: Vec<&str> = re.split(body).collect();
    segments.iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

pub struct EmailForwardCaptureProvider;

impl EmailForwardCaptureProvider {
    pub fn new() -> Self { Self }

    pub fn capture(&self, input: &CaptureInput, config: &CaptureConfig) -> Result<CaptureItem, CaptureError> {
        let raw_email = input.email.as_ref().ok_or(CaptureError::MissingEmail)?;
        if raw_email.is_empty() { return Err(CaptureError::MissingEmail); }

        let (header_section, body_section) = split_headers_body(raw_email);
        let headers = parse_headers(header_section);

        let mut text_content = String::new();
        let mut html_content = String::new();
        let mut attachments: Vec<MimePart> = Vec::new();

        if let Some(ref boundary) = headers.boundary {
            let parts = parse_multipart(body_section, boundary);
            for part in parts {
                if part.filename.is_some() {
                    attachments.push(part);
                } else if part.content_type == "text/plain" && text_content.is_empty() {
                    text_content = part.body;
                } else if part.content_type == "text/html" && html_content.is_empty() {
                    html_content = part.body;
                }
            }
        } else {
            text_content = decode_body(body_section, headers.transfer_encoding.as_deref());
        }

        let primary = if text_content.is_empty() { &html_content } else { &text_content };
        let forward_chain = extract_forward_chain(primary);

        let mut content_parts = vec![
            format!("Subject: {}", headers.subject),
            format!("From: {}", headers.from),
            format!("To: {}", headers.to),
            format!("Date: {}", headers.date),
        ];
        if !headers.message_id.is_empty() {
            content_parts.push(format!("Message-ID: {}", headers.message_id));
        }
        if !attachments.is_empty() {
            let names: Vec<String> = attachments.iter()
                .filter_map(|a| a.filename.clone())
                .collect();
            content_parts.push(format!("Attachments: {}", names.join(", ")));
        }
        content_parts.push("---".to_string());
        content_parts.push(primary.clone());

        let mut tags = vec!["email".to_string()];
        tags.push(if forward_chain.len() > 1 { "forwarded" } else { "direct" }.to_string());
        tags.push(if attachments.is_empty() { "no-attachments" } else { "has-attachments" }.to_string());

        Ok(CaptureItem {
            content: content_parts.join("\n"),
            source_metadata: SourceMetadata {
                title: headers.subject,
                url: None,
                captured_at: chrono::Utc::now().to_rfc3339(),
                content_type: "message/rfc822".to_string(),
                author: Some(headers.from),
                tags: Some(tags),
                source: Some("email_forward".to_string()),
            },
            raw_data: None,
        })
    }

    pub fn supports(&self, input: &CaptureInput) -> bool {
        input.email.as_ref().map_or(false, |e| !e.is_empty())
    }
}

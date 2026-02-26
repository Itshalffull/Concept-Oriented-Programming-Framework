// Transform Plugin Provider: date_format
// Parse and reformat dates with timezone support and auto-detection.
// See Architecture doc for transform plugin interface contract.

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "date_format";
pub const PLUGIN_TYPE: &str = "transform_plugin";

#[derive(Debug, Clone)]
pub enum Value {
    String(String),
    Number(f64),
    Integer(i64),
    Boolean(bool),
    Null,
    Array(Vec<Value>),
    Object(HashMap<String, Value>),
}

#[derive(Debug, Clone)]
pub struct TransformConfig {
    pub options: HashMap<String, Value>,
}

#[derive(Debug, Clone)]
pub struct TypeSpec {
    pub type_name: String,
    pub nullable: bool,
}

#[derive(Debug)]
pub enum TransformError {
    InvalidInput(String),
    ParseError(String),
}

impl std::fmt::Display for TransformError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransformError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            TransformError::ParseError(msg) => write!(f, "Parse error: {}", msg),
        }
    }
}

/// Simplified date components for formatting.
#[derive(Debug, Clone)]
struct DateParts {
    year: i32,
    month: u32,
    day: u32,
    hour: u32,
    minute: u32,
    second: u32,
}

pub struct DateFormatTransformProvider;

impl DateFormatTransformProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        if let Value::Null = value {
            return Ok(Value::Null);
        }

        let output_format = match config.options.get("outputFormat") {
            Some(Value::String(s)) => s.clone(),
            _ => "iso8601".to_string(),
        };

        let input_format = match config.options.get("inputFormat") {
            Some(Value::String(s)) => Some(s.clone()),
            _ => None,
        };

        let parts = self.parse_date(value, input_format.as_deref())?;
        let formatted = self.format_date(&parts, &output_format);

        Ok(Value::String(formatted))
    }

    fn parse_date(&self, value: &Value, input_format: Option<&str>) -> Result<DateParts, TransformError> {
        match value {
            Value::Number(n) => {
                // Assume Unix timestamp; detect seconds vs milliseconds
                let ts = if *n < 1e12 { *n } else { *n / 1000.0 };
                Ok(self.timestamp_to_parts(ts as i64))
            }
            Value::Integer(n) => {
                let ts = if *n < 1_000_000_000_000 { *n } else { *n / 1000 };
                Ok(self.timestamp_to_parts(ts))
            }
            Value::String(s) => {
                let trimmed = s.trim();

                if let Some(fmt) = input_format {
                    return self.parse_with_format(trimmed, fmt);
                }

                // Unix timestamp as string (10 digits = seconds, 13 digits = milliseconds)
                if trimmed.len() == 10 && trimmed.chars().all(|c| c.is_ascii_digit()) {
                    let ts: i64 = trimmed.parse().unwrap();
                    return Ok(self.timestamp_to_parts(ts));
                }
                if trimmed.len() == 13 && trimmed.chars().all(|c| c.is_ascii_digit()) {
                    let ts: i64 = trimmed.parse::<i64>().unwrap() / 1000;
                    return Ok(self.timestamp_to_parts(ts));
                }

                // ISO 8601: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
                if trimmed.len() >= 10 && trimmed.as_bytes()[4] == b'-' && trimmed.as_bytes()[7] == b'-' {
                    return self.parse_iso8601(trimmed);
                }

                // MM/DD/YYYY
                if let Some(parts) = self.parse_us_date(trimmed) {
                    return Ok(parts);
                }

                Err(TransformError::ParseError(
                    format!("Cannot parse date from: \"{}\"", trimmed)
                ))
            }
            _ => Err(TransformError::InvalidInput("Unsupported value type for date parsing".to_string())),
        }
    }

    fn parse_iso8601(&self, s: &str) -> Result<DateParts, TransformError> {
        let date_part = &s[..10];
        let parts: Vec<&str> = date_part.split('-').collect();
        if parts.len() != 3 {
            return Err(TransformError::ParseError("Invalid ISO 8601 date".to_string()));
        }

        let year: i32 = parts[0].parse().map_err(|_| TransformError::ParseError("Invalid year".to_string()))?;
        let month: u32 = parts[1].parse().map_err(|_| TransformError::ParseError("Invalid month".to_string()))?;
        let day: u32 = parts[2].parse().map_err(|_| TransformError::ParseError("Invalid day".to_string()))?;

        let mut hour = 0u32;
        let mut minute = 0u32;
        let mut second = 0u32;

        if s.len() > 10 && (s.as_bytes()[10] == b'T' || s.as_bytes()[10] == b' ') {
            let time_str = &s[11..];
            let time_part = time_str.split(|c| c == 'Z' || c == '+' || c == '-').next().unwrap_or("");
            let time_parts: Vec<&str> = time_part.split(':').collect();
            if time_parts.len() >= 2 {
                hour = time_parts[0].parse().unwrap_or(0);
                minute = time_parts[1].parse().unwrap_or(0);
                if time_parts.len() >= 3 {
                    let sec_str = time_parts[2].split('.').next().unwrap_or("0");
                    second = sec_str.parse().unwrap_or(0);
                }
            }
        }

        Ok(DateParts { year, month, day, hour, minute, second })
    }

    fn parse_us_date(&self, s: &str) -> Option<DateParts> {
        let parts: Vec<&str> = s.split('/').collect();
        if parts.len() == 3 {
            let month: u32 = parts[0].parse().ok()?;
            let day: u32 = parts[1].parse().ok()?;
            let year: i32 = parts[2].parse().ok()?;
            if month >= 1 && month <= 12 && day >= 1 && day <= 31 {
                return Some(DateParts { year, month, day, hour: 0, minute: 0, second: 0 });
            }
        }
        None
    }

    fn parse_with_format(&self, s: &str, format: &str) -> Result<DateParts, TransformError> {
        let mut parts = DateParts { year: 2000, month: 1, day: 1, hour: 0, minute: 0, second: 0 };

        // Simple positional parsing based on format tokens
        let mut fmt_idx = 0;
        let mut str_idx = 0;
        let fmt_chars: Vec<char> = format.chars().collect();
        let str_chars: Vec<char> = s.chars().collect();

        while fmt_idx < fmt_chars.len() && str_idx < str_chars.len() {
            if fmt_idx + 3 < fmt_chars.len() && &format[fmt_idx..fmt_idx + 4] == "YYYY" {
                let num_str: String = str_chars[str_idx..str_idx + 4].iter().collect();
                parts.year = num_str.parse().map_err(|_| TransformError::ParseError("Invalid year".to_string()))?;
                fmt_idx += 4;
                str_idx += 4;
            } else if fmt_idx + 1 < fmt_chars.len() && &format[fmt_idx..fmt_idx + 2] == "MM" {
                let num_str: String = str_chars[str_idx..str_idx + 2].iter().collect();
                parts.month = num_str.parse().map_err(|_| TransformError::ParseError("Invalid month".to_string()))?;
                fmt_idx += 2;
                str_idx += 2;
            } else if fmt_idx + 1 < fmt_chars.len() && &format[fmt_idx..fmt_idx + 2] == "DD" {
                let num_str: String = str_chars[str_idx..str_idx + 2].iter().collect();
                parts.day = num_str.parse().map_err(|_| TransformError::ParseError("Invalid day".to_string()))?;
                fmt_idx += 2;
                str_idx += 2;
            } else if fmt_idx + 1 < fmt_chars.len() && &format[fmt_idx..fmt_idx + 2] == "HH" {
                let num_str: String = str_chars[str_idx..str_idx + 2].iter().collect();
                parts.hour = num_str.parse().map_err(|_| TransformError::ParseError("Invalid hour".to_string()))?;
                fmt_idx += 2;
                str_idx += 2;
            } else if fmt_idx + 1 < fmt_chars.len() && &format[fmt_idx..fmt_idx + 2] == "mm" {
                let num_str: String = str_chars[str_idx..str_idx + 2].iter().collect();
                parts.minute = num_str.parse().map_err(|_| TransformError::ParseError("Invalid minute".to_string()))?;
                fmt_idx += 2;
                str_idx += 2;
            } else if fmt_idx + 1 < fmt_chars.len() && &format[fmt_idx..fmt_idx + 2] == "ss" {
                let num_str: String = str_chars[str_idx..str_idx + 2].iter().collect();
                parts.second = num_str.parse().map_err(|_| TransformError::ParseError("Invalid second".to_string()))?;
                fmt_idx += 2;
                str_idx += 2;
            } else {
                // Skip separator characters
                fmt_idx += 1;
                str_idx += 1;
            }
        }

        Ok(parts)
    }

    fn timestamp_to_parts(&self, timestamp: i64) -> DateParts {
        // Simplified conversion from Unix timestamp to date parts
        let days = timestamp / 86400;
        let time_of_day = (timestamp % 86400 + 86400) % 86400;

        let hour = (time_of_day / 3600) as u32;
        let minute = ((time_of_day % 3600) / 60) as u32;
        let second = (time_of_day % 60) as u32;

        // Calculate date from days since epoch (1970-01-01)
        let (year, month, day) = self.days_to_ymd(days);

        DateParts { year, month, day, hour, minute, second }
    }

    fn days_to_ymd(&self, days_since_epoch: i64) -> (i32, u32, u32) {
        // Algorithm from Howard Hinnant's date library
        let z = days_since_epoch + 719468;
        let era = if z >= 0 { z } else { z - 146096 } / 146097;
        let doe = (z - era * 146097) as u32;
        let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        let y = yoe as i64 + era * 400;
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        let mp = (5 * doy + 2) / 153;
        let d = doy - (153 * mp + 2) / 5 + 1;
        let m = if mp < 10 { mp + 3 } else { mp - 9 };
        let year = if m <= 2 { y + 1 } else { y };

        (year as i32, m, d)
    }

    fn format_date(&self, parts: &DateParts, format: &str) -> String {
        match format {
            "iso8601" => format!(
                "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
                parts.year, parts.month, parts.day,
                parts.hour, parts.minute, parts.second
            ),
            "date" => format!("{:04}-{:02}-{:02}", parts.year, parts.month, parts.day),
            "time" => format!("{:02}:{:02}:{:02}", parts.hour, parts.minute, parts.second),
            _ => {
                // Apply format string with token replacement
                let mut result = format.to_string();
                result = result.replace("YYYY", &format!("{:04}", parts.year));
                result = result.replace("MM", &format!("{:02}", parts.month));
                result = result.replace("DD", &format!("{:02}", parts.day));
                result = result.replace("HH", &format!("{:02}", parts.hour));
                result = result.replace("mm", &format!("{:02}", parts.minute));
                result = result.replace("ss", &format!("{:02}", parts.second));
                result
            }
        }
    }

    pub fn input_type(&self) -> TypeSpec {
        TypeSpec { type_name: "any".to_string(), nullable: true }
    }

    pub fn output_type(&self) -> TypeSpec {
        TypeSpec { type_name: "string".to_string(), nullable: true }
    }
}

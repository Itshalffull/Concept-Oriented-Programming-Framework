// Transform Plugin Provider: format
// String formatting and interpolation with printf-style and template-style patterns.
// See Architecture doc for transform plugin interface contract.

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "format";
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
}

impl std::fmt::Display for TransformError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransformError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
        }
    }
}

pub struct FormatTransformProvider;

impl FormatTransformProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        if let Value::Null = value {
            return Ok(Value::Null);
        }

        let template = match config.options.get("template") {
            Some(Value::String(s)) => s.clone(),
            _ => "%s".to_string(),
        };

        let style = match config.options.get("style") {
            Some(Value::String(s)) => s.clone(),
            _ => "auto".to_string(),
        };

        let args = match config.options.get("args") {
            Some(Value::Array(arr)) => arr.clone(),
            _ => Vec::new(),
        };

        let mut all_args = vec![value.clone()];
        all_args.extend(args);

        let named_args = match config.options.get("namedArgs") {
            Some(Value::Object(map)) => {
                let mut m = map.clone();
                m.insert("value".to_string(), value.clone());
                m
            }
            _ => {
                let mut m = HashMap::new();
                m.insert("value".to_string(), value.clone());
                m
            }
        };

        let result = if style == "printf" || (style == "auto" && self.has_printf_tokens(&template)) {
            self.printf_format(&template, &all_args)
        } else if style == "template" || (style == "auto" && self.has_template_tokens(&template)) {
            self.template_format(&template, &all_args, &named_args)
        } else {
            self.printf_format(&template, &all_args)
        };

        Ok(Value::String(result))
    }

    fn has_printf_tokens(&self, template: &str) -> bool {
        template.contains("%s") || template.contains("%d") || template.contains("%f")
    }

    fn has_template_tokens(&self, template: &str) -> bool {
        template.contains('{') && template.contains('}')
    }

    fn printf_format(&self, template: &str, args: &[Value]) -> String {
        let mut result = String::new();
        let mut arg_index = 0;
        let chars: Vec<char> = template.chars().collect();
        let mut i = 0;

        while i < chars.len() {
            if chars[i] == '%' && i + 1 < chars.len() {
                let spec = chars[i + 1];
                match spec {
                    '%' => {
                        result.push('%');
                        i += 2;
                    }
                    's' => {
                        if arg_index < args.len() {
                            result.push_str(&self.value_to_string(&args[arg_index]));
                            arg_index += 1;
                        } else {
                            result.push_str("%s");
                        }
                        i += 2;
                    }
                    'd' => {
                        if arg_index < args.len() {
                            let n = self.value_to_f64(&args[arg_index]);
                            result.push_str(&format!("{}", n.trunc() as i64));
                            arg_index += 1;
                        } else {
                            result.push_str("%d");
                        }
                        i += 2;
                    }
                    'f' => {
                        if arg_index < args.len() {
                            let n = self.value_to_f64(&args[arg_index]);
                            result.push_str(&format!("{:.6}", n));
                            arg_index += 1;
                        } else {
                            result.push_str("%f");
                        }
                        i += 2;
                    }
                    'e' => {
                        if arg_index < args.len() {
                            let n = self.value_to_f64(&args[arg_index]);
                            result.push_str(&format!("{:e}", n));
                            arg_index += 1;
                        } else {
                            result.push_str("%e");
                        }
                        i += 2;
                    }
                    _ => {
                        result.push(chars[i]);
                        i += 1;
                    }
                }
            } else {
                result.push(chars[i]);
                i += 1;
            }
        }

        result
    }

    fn template_format(&self, template: &str, positional: &[Value], named: &HashMap<String, Value>) -> String {
        let mut result = String::new();
        let chars: Vec<char> = template.chars().collect();
        let mut i = 0;

        while i < chars.len() {
            if chars[i] == '{' {
                if let Some(close) = chars[i..].iter().position(|&c| c == '}') {
                    let key = &template[i + 1..i + close];
                    let resolved = if let Ok(idx) = key.parse::<usize>() {
                        if idx < positional.len() {
                            Some(self.value_to_string(&positional[idx]))
                        } else {
                            None
                        }
                    } else if let Some(v) = named.get(key) {
                        Some(self.value_to_string(v))
                    } else {
                        None
                    };

                    match resolved {
                        Some(s) => result.push_str(&s),
                        None => {
                            result.push('{');
                            result.push_str(key);
                            result.push('}');
                        }
                    }
                    i += close + 1;
                } else {
                    result.push(chars[i]);
                    i += 1;
                }
            } else {
                result.push(chars[i]);
                i += 1;
            }
        }

        result
    }

    fn value_to_string(&self, value: &Value) -> String {
        match value {
            Value::String(s) => s.clone(),
            Value::Number(n) => format!("{}", n),
            Value::Integer(n) => format!("{}", n),
            Value::Boolean(b) => format!("{}", b),
            Value::Null => String::new(),
            _ => String::new(),
        }
    }

    fn value_to_f64(&self, value: &Value) -> f64 {
        match value {
            Value::Number(n) => *n,
            Value::Integer(n) => *n as f64,
            Value::String(s) => s.parse::<f64>().unwrap_or(0.0),
            Value::Boolean(b) => if *b { 1.0 } else { 0.0 },
            _ => 0.0,
        }
    }

    pub fn input_type(&self) -> TypeSpec {
        TypeSpec { type_name: "any".to_string(), nullable: true }
    }

    pub fn output_type(&self) -> TypeSpec {
        TypeSpec { type_name: "string".to_string(), nullable: true }
    }
}

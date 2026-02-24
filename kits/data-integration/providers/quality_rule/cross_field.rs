// Quality Rule Provider: Cross-Field Validation
// Evaluates multi-field validation expressions across record fields.
// Dimension: consistency

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "cross_field";
pub const PLUGIN_TYPE: &str = "quality_rule";

#[derive(Debug, Clone)]
pub struct FieldDef {
    pub name: String,
    pub field_type: String,
    pub required: Option<bool>,
    pub constraints: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone)]
pub struct RuleConfig {
    pub options: Option<HashMap<String, serde_json::Value>>,
    pub threshold: Option<f64>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Severity { Error, Warning, Info }

#[derive(Debug, Clone)]
pub struct RuleResult {
    pub valid: bool,
    pub message: Option<String>,
    pub severity: Severity,
}

#[derive(Debug, Clone, PartialEq)]
pub enum QualityDimension {
    Completeness, Uniqueness, Validity, Consistency, Timeliness, Accuracy,
}

pub struct CrossFieldQualityProvider;

impl CrossFieldQualityProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn validate(
        &self,
        _value: &serde_json::Value,
        field: &FieldDef,
        record: &HashMap<String, serde_json::Value>,
        config: &RuleConfig,
    ) -> RuleResult {
        let expression = match config.options.as_ref()
            .and_then(|o| o.get("expression"))
            .and_then(|v| v.as_str())
        {
            Some(e) => e.to_string(),
            None => return RuleResult {
                valid: false,
                message: Some(format!(
                    "Cross-field rule for '{}' is misconfigured: no expression provided.",
                    field.name
                )),
                severity: Severity::Error,
            },
        };

        let fields: Vec<String> = match config.options.as_ref()
            .and_then(|o| o.get("fields"))
            .and_then(|v| v.as_array())
        {
            Some(arr) => arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect(),
            None => return RuleResult {
                valid: false,
                message: Some(format!(
                    "Cross-field rule for '{}' is misconfigured: no fields specified.",
                    field.name
                )),
                severity: Severity::Error,
            },
        };

        if fields.is_empty() {
            return RuleResult {
                valid: false,
                message: Some(format!(
                    "Cross-field rule for '{}' is misconfigured: no fields specified.",
                    field.name
                )),
                severity: Severity::Error,
            };
        }

        match self.evaluate_expression(&expression, &fields, record) {
            Ok(true) => RuleResult { valid: true, message: None, severity: Severity::Error },
            Ok(false) => RuleResult {
                valid: false,
                message: Some(format!(
                    "Cross-field validation failed for '{}': expression '{}' evaluated to false.",
                    field.name, expression
                )),
                severity: Severity::Error,
            },
            Err(err) => RuleResult {
                valid: false,
                message: Some(format!(
                    "Cross-field rule evaluation error for '{}': {}",
                    field.name, err
                )),
                severity: Severity::Error,
            },
        }
    }

    fn evaluate_expression(
        &self,
        expression: &str,
        _fields: &[String],
        record: &HashMap<String, serde_json::Value>,
    ) -> Result<bool, String> {
        // Handle comparison: field_a > field_b, field_a >= field_b, etc.
        let comparison_ops = [">=", "<=", "!=", "==", ">", "<"];
        for op in &comparison_ops {
            if let Some(pos) = expression.find(op) {
                let left_field = expression[..pos].trim();
                let right_field = expression[pos + op.len()..].trim();

                // Check if this is a conditional expression (starts with "if")
                if left_field.starts_with("if ") {
                    continue;
                }

                let left_val = self.resolve_value(record.get(left_field));
                let right_val = self.resolve_value(record.get(right_field));

                match (left_val, right_val) {
                    (Some(l), Some(r)) => {
                        let result = match *op {
                            ">" => l > r,
                            ">=" => l >= r,
                            "<" => l < r,
                            "<=" => l <= r,
                            "==" => (l - r).abs() < f64::EPSILON,
                            "!=" => (l - r).abs() >= f64::EPSILON,
                            _ => return Err(format!("Unknown operator: {}", op)),
                        };
                        return Ok(result);
                    }
                    _ => return Ok(true), // Skip if fields are null
                }
            }
        }

        // Handle: if field_a == "value" then field_b required
        if expression.starts_with("if ") && expression.contains(" then ") {
            let parts: Vec<&str> = expression.splitn(2, " then ").collect();
            if parts.len() == 2 {
                let condition = parts[0].trim_start_matches("if ").trim();
                let action = parts[1].trim();

                // Parse condition: field == "value"
                if let Some(eq_pos) = condition.find("==") {
                    let cond_field = condition[..eq_pos].trim();
                    let cond_value = condition[eq_pos + 2..].trim()
                        .trim_matches('"')
                        .trim_matches('\'');

                    let field_val = record.get(cond_field)
                        .and_then(|v| v.as_str())
                        .unwrap_or("");

                    if field_val == cond_value {
                        // Parse action: field_b required
                        if action.ends_with(" required") {
                            let req_field = action.trim_end_matches(" required").trim();
                            let req_val = record.get(req_field);
                            let is_present = match req_val {
                                None => false,
                                Some(v) => !v.is_null() && v.as_str().map_or(true, |s| !s.is_empty()),
                            };
                            return Ok(is_present);
                        }
                    } else {
                        return Ok(true); // Condition not met, rule passes
                    }
                }
            }
        }

        Err(format!("Unsupported expression format: {}", expression))
    }

    fn resolve_value(&self, val: Option<&serde_json::Value>) -> Option<f64> {
        match val? {
            serde_json::Value::Number(n) => n.as_f64(),
            serde_json::Value::String(s) => {
                // Try as number first, then as date string for comparison
                s.parse::<f64>().ok()
            }
            _ => None,
        }
    }

    pub fn applies_to(&self, _field: &FieldDef) -> bool {
        true
    }

    pub fn dimension(&self) -> QualityDimension {
        QualityDimension::Consistency
    }
}

impl Default for CrossFieldQualityProvider {
    fn default() -> Self {
        Self::new()
    }
}

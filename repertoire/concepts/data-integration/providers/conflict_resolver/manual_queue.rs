// Manual queue conflict resolver — never auto-resolves
// Stores both versions in a queue with side-by-side field comparison,
// generates a human-readable diff, and marks conflicts as pending manual review.

use std::collections::{HashMap, HashSet};

pub const PROVIDER_ID: &str = "manual_queue";
pub const PLUGIN_TYPE: &str = "conflict_resolver";

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Null,
    String(String),
    Number(f64),
    Bool(bool),
    Array(Vec<Value>),
    Object(HashMap<String, Value>),
}

#[derive(Debug, Clone)]
pub struct Conflict {
    pub entity_id: String,
    pub version_a: HashMap<String, Value>,
    pub version_b: HashMap<String, Value>,
    pub ancestor: Option<HashMap<String, Value>>,
    pub field_conflicts: Vec<String>,
    pub timestamp_a: Option<u64>,
    pub timestamp_b: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct ResolverConfig {
    pub options: HashMap<String, Value>,
}

#[derive(Debug, Clone)]
pub struct Resolution {
    pub winner: HashMap<String, Value>,
    pub strategy: String,
    pub details: HashMap<String, Value>,
}

#[derive(Debug)]
pub enum ResolverError {
    QueueFailure(String),
}

impl std::fmt::Display for ResolverError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ResolverError::QueueFailure(msg) => write!(f, "Queue failure: {}", msg),
        }
    }
}

fn format_value(val: Option<&Value>) -> String {
    match val {
        None => "<undefined>".to_string(),
        Some(Value::Null) => "<null>".to_string(),
        Some(Value::String(s)) => s.clone(),
        Some(Value::Number(n)) => n.to_string(),
        Some(Value::Bool(b)) => b.to_string(),
        Some(Value::Array(arr)) => format!("{:?}", arr),
        Some(Value::Object(obj)) => format!("{:?}", obj),
    }
}

struct FieldComparison {
    field: String,
    value_a: Option<Value>,
    value_b: Option<Value>,
    ancestor_value: Option<Value>,
    is_conflicting: bool,
    diff_description: String,
}

fn generate_field_comparison(
    field: &str,
    val_a: Option<&Value>,
    val_b: Option<&Value>,
    val_anc: Option<&Value>,
) -> FieldComparison {
    let a_str = format_value(val_a);
    let b_str = format_value(val_b);
    let is_conflicting = a_str != b_str;

    let diff_description = if !is_conflicting {
        format!("{}: both versions agree = {}", field, a_str)
    } else if val_anc.is_some() {
        format!(
            "{}: ancestor={} | A={} | B={}",
            field,
            format_value(val_anc),
            a_str,
            b_str
        )
    } else {
        format!("{}: A={} | B={}", field, a_str, b_str)
    };

    FieldComparison {
        field: field.to_string(),
        value_a: val_a.cloned(),
        value_b: val_b.cloned(),
        ancestor_value: val_anc.cloned(),
        is_conflicting,
        diff_description,
    }
}

fn generate_human_readable_diff(comparisons: &[FieldComparison]) -> String {
    let mut lines = vec![
        "=== Conflict Review Required ===".to_string(),
        String::new(),
    ];

    let conflicting: Vec<&FieldComparison> = comparisons.iter().filter(|c| c.is_conflicting).collect();
    let agreeing: Vec<&FieldComparison> = comparisons.iter().filter(|c| !c.is_conflicting).collect();

    if !conflicting.is_empty() {
        lines.push(format!("Conflicting fields ({}):", conflicting.len()));
        for comp in &conflicting {
            lines.push(format!("  [!] {}", comp.diff_description));
        }
        lines.push(String::new());
    }

    if !agreeing.is_empty() {
        lines.push(format!("Agreeing fields ({}):", agreeing.len()));
        for comp in &agreeing {
            lines.push(format!("  [=] {}", comp.diff_description));
        }
    }

    lines.join("\n")
}

fn build_conflict_marker_record(comparisons: &[FieldComparison]) -> HashMap<String, Value> {
    let mut merged = HashMap::new();
    for comp in comparisons {
        if comp.is_conflicting {
            let mut marker = HashMap::new();
            marker.insert("__conflict".to_string(), Value::Bool(true));
            marker.insert(
                "version_a".to_string(),
                comp.value_a.clone().unwrap_or(Value::Null),
            );
            marker.insert(
                "version_b".to_string(),
                comp.value_b.clone().unwrap_or(Value::Null),
            );
            marker.insert(
                "ancestor".to_string(),
                comp.ancestor_value.clone().unwrap_or(Value::Null),
            );
            merged.insert(comp.field.clone(), Value::Object(marker));
        } else {
            merged.insert(
                comp.field.clone(),
                comp.value_a.clone().unwrap_or(Value::Null),
            );
        }
    }
    merged
}

pub struct ManualQueueResolverProvider;

impl ManualQueueResolverProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn resolve(
        &self,
        conflict: &Conflict,
        _config: &ResolverConfig,
    ) -> Result<Resolution, ResolverError> {
        let empty = HashMap::new();
        let ancestor = conflict.ancestor.as_ref().unwrap_or(&empty);

        let mut all_fields: HashSet<String> = HashSet::new();
        for key in conflict.version_a.keys().chain(conflict.version_b.keys()).chain(ancestor.keys()) {
            all_fields.insert(key.clone());
        }

        let mut comparisons: Vec<FieldComparison> = Vec::new();
        let mut sorted_fields: Vec<String> = all_fields.into_iter().collect();
        sorted_fields.sort();

        for field in &sorted_fields {
            comparisons.push(generate_field_comparison(
                field,
                conflict.version_a.get(field),
                conflict.version_b.get(field),
                ancestor.get(field),
            ));
        }

        let human_readable_diff = generate_human_readable_diff(&comparisons);
        let marker_record = build_conflict_marker_record(&comparisons);

        let conflicting_fields: Vec<String> = comparisons
            .iter()
            .filter(|c| c.is_conflicting)
            .map(|c| c.field.clone())
            .collect();
        let agreeing_fields: Vec<String> = comparisons
            .iter()
            .filter(|c| !c.is_conflicting)
            .map(|c| c.field.clone())
            .collect();

        let mut details = HashMap::new();
        details.insert(
            "status".to_string(),
            Value::String("pending_manual_review".to_string()),
        );
        details.insert(
            "entity_id".to_string(),
            Value::String(conflict.entity_id.clone()),
        );
        details.insert(
            "human_readable_diff".to_string(),
            Value::String(human_readable_diff),
        );
        details.insert(
            "conflicting_fields".to_string(),
            Value::Array(conflicting_fields.iter().map(|f| Value::String(f.clone())).collect()),
        );
        details.insert(
            "agreeing_fields".to_string(),
            Value::Array(agreeing_fields.iter().map(|f| Value::String(f.clone())).collect()),
        );
        details.insert(
            "total_fields".to_string(),
            Value::Number(sorted_fields.len() as f64),
        );
        details.insert(
            "conflict_count".to_string(),
            Value::Number(conflicting_fields.len() as f64),
        );

        Ok(Resolution {
            winner: marker_record,
            strategy: "manual_queue".to_string(),
            details,
        })
    }

    pub fn can_auto_resolve(&self, _conflict: &Conflict) -> bool {
        false
    }
}

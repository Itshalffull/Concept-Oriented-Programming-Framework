// Three-way merge conflict resolver — diffs both versions against a common ancestor
// Computes diff(ancestor, versionA) and diff(ancestor, versionB), merges non-overlapping
// changes cleanly. For text fields, attempts line-by-line three-way merge similar to git.

use std::collections::{HashMap, HashSet};

pub const PROVIDER_ID: &str = "three_way_merge";
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
    MergeFailure(String),
}

impl std::fmt::Display for ResolverError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ResolverError::MergeFailure(msg) => write!(f, "Merge failure: {}", msg),
        }
    }
}

#[derive(Debug, Clone)]
struct FieldDiff {
    field: String,
    old_value: Option<Value>,
    new_value: Option<Value>,
}

fn compute_diff(ancestor: &HashMap<String, Value>, version: &HashMap<String, Value>) -> Vec<FieldDiff> {
    let mut diffs = Vec::new();
    let mut all_keys: HashSet<String> = HashSet::new();
    for key in ancestor.keys().chain(version.keys()) {
        all_keys.insert(key.clone());
    }

    for key in &all_keys {
        let old_val = ancestor.get(key);
        let new_val = version.get(key);
        if old_val != new_val {
            diffs.push(FieldDiff {
                field: key.clone(),
                old_value: old_val.cloned(),
                new_value: new_val.cloned(),
            });
        }
    }
    diffs
}

fn three_way_text_merge(ancestor: &str, text_a: &str, text_b: &str) -> (String, bool) {
    let ancestor_lines: Vec<&str> = ancestor.split('\n').collect();
    let lines_a: Vec<&str> = text_a.split('\n').collect();
    let lines_b: Vec<&str> = text_b.split('\n').collect();
    let max_len = ancestor_lines.len().max(lines_a.len()).max(lines_b.len());

    let mut merged_lines: Vec<String> = Vec::new();
    let mut has_conflict = false;

    for i in 0..max_len {
        let orig = ancestor_lines.get(i).copied().unwrap_or("");
        let line_a = lines_a.get(i).copied().unwrap_or("");
        let line_b = lines_b.get(i).copied().unwrap_or("");

        let a_changed = orig != line_a;
        let b_changed = orig != line_b;

        if !a_changed && !b_changed {
            merged_lines.push(orig.to_string());
        } else if a_changed && !b_changed {
            merged_lines.push(line_a.to_string());
        } else if !a_changed && b_changed {
            merged_lines.push(line_b.to_string());
        } else if line_a == line_b {
            merged_lines.push(line_a.to_string());
        } else {
            has_conflict = true;
            merged_lines.push("<<<<<<< version_a".to_string());
            merged_lines.push(line_a.to_string());
            merged_lines.push("=======".to_string());
            merged_lines.push(line_b.to_string());
            merged_lines.push(">>>>>>> version_b".to_string());
        }
    }

    (merged_lines.join("\n"), has_conflict)
}

pub struct ThreeWayMergeResolverProvider;

impl ThreeWayMergeResolverProvider {
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

        let diff_a = compute_diff(ancestor, &conflict.version_a);
        let diff_b = compute_diff(ancestor, &conflict.version_b);

        let diff_a_fields: HashSet<String> = diff_a.iter().map(|d| d.field.clone()).collect();
        let diff_b_fields: HashSet<String> = diff_b.iter().map(|d| d.field.clone()).collect();

        let mut merged = ancestor.clone();
        let mut clean_merges: Vec<String> = Vec::new();
        let mut overlapping_conflicts: Vec<String> = Vec::new();
        let mut text_merges: Vec<String> = Vec::new();

        // Apply non-overlapping diffs from A
        for diff in &diff_a {
            if !diff_b_fields.contains(&diff.field) {
                if let Some(val) = &diff.new_value {
                    merged.insert(diff.field.clone(), val.clone());
                } else {
                    merged.remove(&diff.field);
                }
                clean_merges.push(diff.field.clone());
            }
        }

        // Apply non-overlapping diffs from B
        for diff in &diff_b {
            if !diff_a_fields.contains(&diff.field) {
                if let Some(val) = &diff.new_value {
                    merged.insert(diff.field.clone(), val.clone());
                } else {
                    merged.remove(&diff.field);
                }
                clean_merges.push(diff.field.clone());
            }
        }

        // Handle overlapping changes
        for diff in &diff_a {
            if diff_b_fields.contains(&diff.field) {
                let val_a = conflict.version_a.get(&diff.field);
                let val_b = conflict.version_b.get(&diff.field);

                if val_a == val_b {
                    if let Some(v) = val_a {
                        merged.insert(diff.field.clone(), v.clone());
                    }
                    clean_merges.push(diff.field.clone());
                } else if let (Some(Value::String(sa)), Some(Value::String(sb))) = (val_a, val_b) {
                    let ancestor_text = match ancestor.get(&diff.field) {
                        Some(Value::String(s)) => s.as_str(),
                        _ => "",
                    };
                    let (merged_text, has_conflict) = three_way_text_merge(ancestor_text, sa, sb);
                    merged.insert(diff.field.clone(), Value::String(merged_text));
                    if has_conflict {
                        overlapping_conflicts.push(diff.field.clone());
                    } else {
                        text_merges.push(diff.field.clone());
                    }
                } else {
                    // Non-text overlapping conflict, default to version A
                    if let Some(v) = val_a {
                        merged.insert(diff.field.clone(), v.clone());
                    }
                    overlapping_conflicts.push(diff.field.clone());
                }
            }
        }

        let mut details = HashMap::new();
        details.insert("entity_id".to_string(), Value::String(conflict.entity_id.clone()));
        details.insert(
            "diff_set_a".to_string(),
            Value::Array(diff_a.iter().map(|d| Value::String(d.field.clone())).collect()),
        );
        details.insert(
            "diff_set_b".to_string(),
            Value::Array(diff_b.iter().map(|d| Value::String(d.field.clone())).collect()),
        );
        details.insert(
            "clean_merges".to_string(),
            Value::Array(clean_merges.iter().map(|f| Value::String(f.clone())).collect()),
        );
        details.insert(
            "text_merges".to_string(),
            Value::Array(text_merges.iter().map(|f| Value::String(f.clone())).collect()),
        );
        details.insert(
            "overlapping_conflicts".to_string(),
            Value::Array(overlapping_conflicts.iter().map(|f| Value::String(f.clone())).collect()),
        );
        details.insert(
            "has_ancestor".to_string(),
            Value::Bool(conflict.ancestor.is_some()),
        );
        details.insert(
            "fully_resolved".to_string(),
            Value::Bool(overlapping_conflicts.is_empty()),
        );

        Ok(Resolution {
            winner: merged,
            strategy: "three_way_merge".to_string(),
            details,
        })
    }

    pub fn can_auto_resolve(&self, conflict: &Conflict) -> bool {
        let empty = HashMap::new();
        let ancestor = conflict.ancestor.as_ref().unwrap_or(&empty);

        let diff_a = compute_diff(ancestor, &conflict.version_a);
        let diff_b = compute_diff(ancestor, &conflict.version_b);

        let diff_a_fields: HashSet<String> = diff_a.iter().map(|d| d.field.clone()).collect();

        for diff in &diff_b {
            if diff_a_fields.contains(&diff.field) {
                let val_a = conflict.version_a.get(&diff.field);
                let val_b = conflict.version_b.get(&diff.field);
                if val_a != val_b {
                    return false;
                }
            }
        }

        true
    }
}

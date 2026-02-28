// Transform Plugin Provider: migration_lookup
// Resolve IDs from Provenance batch map table for referential integrity.
// See Architecture doc for transform plugin interface contract.

use std::collections::HashMap;

pub const PROVIDER_ID: &str = "migration_lookup";
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
    UnresolvedReference(String),
    NullRequired(String),
}

impl std::fmt::Display for TransformError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TransformError::UnresolvedReference(msg) => write!(f, "Unresolved reference: {}", msg),
            TransformError::NullRequired(msg) => write!(f, "Null required field: {}", msg),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ProvenanceMapEntry {
    pub source_id: String,
    pub dest_id: String,
    pub entity_type: String,
    pub batch_id: String,
}

pub struct MigrationLookupTransformProvider {
    provenance_map: HashMap<String, ProvenanceMapEntry>,
}

impl MigrationLookupTransformProvider {
    pub fn new() -> Self {
        Self {
            provenance_map: HashMap::new(),
        }
    }

    pub fn transform(&self, value: &Value, config: &TransformConfig) -> Result<Value, TransformError> {
        let source_id = match value {
            Value::Null => {
                let required = match config.options.get("required") {
                    Some(Value::Boolean(false)) => false,
                    _ => true,
                };
                if required {
                    return Err(TransformError::NullRequired(
                        "Migration lookup received null for required field".to_string()
                    ));
                }
                return Ok(Value::Null);
            }
            Value::String(s) => s.clone(),
            Value::Integer(n) => format!("{}", n),
            Value::Number(n) => format!("{}", n),
            _ => return Ok(Value::Null),
        };

        let entity_type = match config.options.get("entityType") {
            Some(Value::String(s)) => s.clone(),
            _ => String::new(),
        };

        let batch_id = match config.options.get("batchId") {
            Some(Value::String(s)) => Some(s.clone()),
            _ => None,
        };

        let fallback = match config.options.get("fallback") {
            Some(Value::String(s)) => s.as_str(),
            _ => "error",
        };

        // Look up with batch ID
        let key_with_batch = if let Some(ref bid) = batch_id {
            self.build_lookup_key(&source_id, &entity_type, Some(bid))
        } else {
            String::new()
        };
        let key_without_batch = self.build_lookup_key(&source_id, &entity_type, None);

        let entry = if !key_with_batch.is_empty() {
            self.provenance_map.get(&key_with_batch)
                .or_else(|| self.provenance_map.get(&key_without_batch))
        } else {
            self.provenance_map.get(&key_without_batch)
        };

        if let Some(e) = entry {
            return Ok(Value::String(e.dest_id.clone()));
        }

        // Check inline map
        if let Some(Value::Object(inline_map)) = config.options.get("map") {
            if let Some(v) = inline_map.get(&source_id) {
                return Ok(v.clone());
            }
        }

        // Handle unresolved reference
        match fallback {
            "null" => Ok(Value::Null),
            "passthrough" => Ok(Value::String(source_id)),
            "placeholder" => {
                let placeholder = match config.options.get("placeholder") {
                    Some(Value::String(s)) => s.clone(),
                    _ => format!("__unresolved:{}:{}", entity_type, source_id),
                };
                Ok(Value::String(placeholder))
            }
            _ => Err(TransformError::UnresolvedReference(
                format!(
                    "No destination ID found for source \"{}\" (entity: {}{})",
                    source_id, entity_type,
                    batch_id.map(|b| format!(", batch: {}", b)).unwrap_or_default()
                )
            )),
        }
    }

    pub fn load_provenance_map(&mut self, entries: Vec<ProvenanceMapEntry>) {
        self.provenance_map.clear();
        for entry in entries {
            let key_with = self.build_lookup_key(&entry.source_id, &entry.entity_type, Some(&entry.batch_id));
            let key_without = self.build_lookup_key(&entry.source_id, &entry.entity_type, None);
            self.provenance_map.insert(key_with, entry.clone());
            self.provenance_map.insert(key_without, entry);
        }
    }

    fn build_lookup_key(&self, source_id: &str, entity_type: &str, batch_id: Option<&str>) -> String {
        match batch_id {
            Some(bid) => format!("{}::{}::{}", entity_type, source_id, bid),
            None => format!("{}::{}", entity_type, source_id),
        }
    }

    pub fn input_type(&self) -> TypeSpec {
        TypeSpec { type_name: "string".to_string(), nullable: true }
    }

    pub fn output_type(&self) -> TypeSpec {
        TypeSpec { type_name: "string".to_string(), nullable: true }
    }
}

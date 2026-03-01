// generated: concept_scaffold_gen/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConceptScaffoldGenGenerateInput {
    pub name: String,
    pub type_param: String,
    pub purpose: String,
    pub state_fields: Vec<serde_json::Value>,
    pub actions: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConceptScaffoldGenGenerateOutput {
    Ok {
        files: Vec<serde_json::Value>,
        files_generated: i64,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConceptScaffoldGenPreviewInput {
    pub name: String,
    pub type_param: String,
    pub purpose: String,
    pub state_fields: Vec<serde_json::Value>,
    pub actions: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConceptScaffoldGenPreviewOutput {
    Ok {
        files: Vec<serde_json::Value>,
        would_write: i64,
        would_skip: i64,
    },
    Cached,
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConceptScaffoldGenRegisterInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConceptScaffoldGenRegisterOutput {
    Ok {
        name: String,
        input_kind: String,
        output_kind: String,
        capabilities: Vec<String>,
    },
}


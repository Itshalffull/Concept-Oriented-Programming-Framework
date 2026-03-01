// generated: kit_scaffold_gen/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KitScaffoldGenGenerateInput {
    pub name: String,
    pub description: String,
    pub concepts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum KitScaffoldGenGenerateOutput {
    Ok {
        files: Vec<serde_json::Value>,
        files_generated: i64,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KitScaffoldGenPreviewInput {
    pub name: String,
    pub description: String,
    pub concepts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum KitScaffoldGenPreviewOutput {
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
pub struct KitScaffoldGenRegisterInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum KitScaffoldGenRegisterOutput {
    Ok {
        name: String,
        input_kind: String,
        output_kind: String,
        capabilities: Vec<String>,
    },
}


// generated: sync_scaffold_gen/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncScaffoldGenGenerateInput {
    pub name: String,
    pub trigger: serde_json::Value,
    pub effects: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyncScaffoldGenGenerateOutput {
    Ok {
        files: Vec<serde_json::Value>,
        files_generated: i64,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncScaffoldGenPreviewInput {
    pub name: String,
    pub trigger: serde_json::Value,
    pub effects: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyncScaffoldGenPreviewOutput {
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
pub struct SyncScaffoldGenRegisterInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyncScaffoldGenRegisterOutput {
    Ok {
        name: String,
        input_kind: String,
        output_kind: String,
        capabilities: Vec<String>,
    },
}


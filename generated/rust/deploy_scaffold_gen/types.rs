// generated: deploy_scaffold_gen/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeployScaffoldGenGenerateInput {
    pub app_name: String,
    pub runtimes: Vec<serde_json::Value>,
    pub concepts: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DeployScaffoldGenGenerateOutput {
    Ok {
        files: Vec<serde_json::Value>,
        files_generated: i64,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeployScaffoldGenPreviewInput {
    pub app_name: String,
    pub runtimes: Vec<serde_json::Value>,
    pub concepts: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DeployScaffoldGenPreviewOutput {
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
pub struct DeployScaffoldGenRegisterInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DeployScaffoldGenRegisterOutput {
    Ok {
        name: String,
        input_kind: String,
        output_kind: String,
        capabilities: Vec<String>,
    },
}


// generated: interface_scaffold_gen/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InterfaceScaffoldGenGenerateInput {
    pub name: String,
    pub targets: Vec<String>,
    pub sdks: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InterfaceScaffoldGenGenerateOutput {
    Ok {
        files: Vec<serde_json::Value>,
        files_generated: i64,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InterfaceScaffoldGenPreviewInput {
    pub name: String,
    pub targets: Vec<String>,
    pub sdks: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InterfaceScaffoldGenPreviewOutput {
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
pub struct InterfaceScaffoldGenRegisterInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InterfaceScaffoldGenRegisterOutput {
    Ok {
        name: String,
        input_kind: String,
        output_kind: String,
        capabilities: Vec<String>,
    },
}


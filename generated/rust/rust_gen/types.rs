// generated: rust_gen/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RustGenGenerateInput {
    pub spec: String,
    pub manifest: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RustGenGenerateOutput {
    Ok {
        files: Vec<{ path: String, content: String }>,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RustGenRegisterInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RustGenRegisterOutput {
    Ok {
        name: String,
        input_kind: String,
        output_kind: String,
        capabilities: Vec<String>,
    },
}


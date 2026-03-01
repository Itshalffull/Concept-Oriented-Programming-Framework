// generated: diff/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DiffRegisterProviderInput {
    pub name: String,
    pub content_types: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DiffRegisterProviderOutput {
    Ok {
        provider: serde_json::Value,
    },
    Duplicate {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DiffDiffInput {
    pub content_a: String,
    pub content_b: String,
    pub algorithm: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DiffDiffOutput {
    Identical,
    Diffed {
        edit_script: Vec<u8>,
        distance: i64,
    },
    NoProvider {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DiffPatchInput {
    pub content: String,
    pub edit_script: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DiffPatchOutput {
    Ok {
        result: String,
    },
    Incompatible {
        message: String,
    },
}


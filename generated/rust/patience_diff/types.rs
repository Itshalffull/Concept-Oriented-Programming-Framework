// generated: patience_diff/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PatienceDiffRegisterInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PatienceDiffRegisterOutput {
    Ok {
        name: String,
        category: String,
        content_types: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PatienceDiffComputeInput {
    pub content_a: Vec<u8>,
    pub content_b: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PatienceDiffComputeOutput {
    Ok {
        edit_script: Vec<u8>,
        distance: i64,
    },
    UnsupportedContent {
        message: String,
    },
}


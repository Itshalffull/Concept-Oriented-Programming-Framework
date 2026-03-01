// generated: myers_diff/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MyersDiffRegisterInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MyersDiffRegisterOutput {
    Ok {
        name: String,
        category: String,
        content_types: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MyersDiffComputeInput {
    pub content_a: Vec<u8>,
    pub content_b: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MyersDiffComputeOutput {
    Ok {
        edit_script: Vec<u8>,
        distance: i64,
    },
    UnsupportedContent {
        message: String,
    },
}


// generated: histogram_diff/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HistogramDiffRegisterInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum HistogramDiffRegisterOutput {
    Ok {
        name: String,
        category: String,
        content_types: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HistogramDiffComputeInput {
    pub content_a: Vec<u8>,
    pub content_b: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum HistogramDiffComputeOutput {
    Ok {
        edit_script: Vec<u8>,
        distance: i64,
    },
    UnsupportedContent {
        message: String,
    },
}


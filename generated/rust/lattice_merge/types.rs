// generated: lattice_merge/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LatticeMergeRegisterInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LatticeMergeRegisterOutput {
    Ok {
        name: String,
        category: String,
        content_types: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LatticeMergeExecuteInput {
    pub base: Vec<u8>,
    pub ours: Vec<u8>,
    pub theirs: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LatticeMergeExecuteOutput {
    Clean {
        result: Vec<u8>,
    },
    UnsupportedContent {
        message: String,
    },
}


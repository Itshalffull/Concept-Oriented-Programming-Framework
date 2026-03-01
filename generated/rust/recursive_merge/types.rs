// generated: recursive_merge/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RecursiveMergeRegisterInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RecursiveMergeRegisterOutput {
    Ok {
        name: String,
        category: String,
        content_types: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RecursiveMergeExecuteInput {
    pub base: Vec<u8>,
    pub ours: Vec<u8>,
    pub theirs: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RecursiveMergeExecuteOutput {
    Clean {
        result: Vec<u8>,
    },
    Conflicts {
        regions: Vec<Vec<u8>>,
    },
    UnsupportedContent {
        message: String,
    },
}


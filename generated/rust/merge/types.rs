// generated: merge/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MergeRegisterStrategyInput {
    pub name: String,
    pub content_types: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MergeRegisterStrategyOutput {
    Ok {
        strategy: serde_json::Value,
    },
    Duplicate {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MergeMergeInput {
    pub base: String,
    pub ours: String,
    pub theirs: String,
    pub strategy: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MergeMergeOutput {
    Clean {
        result: String,
    },
    Conflicts {
        merge_id: serde_json::Value,
        conflict_count: i64,
    },
    NoStrategy {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MergeResolveConflictInput {
    pub merge_id: serde_json::Value,
    pub conflict_index: i64,
    pub resolution: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MergeResolveConflictOutput {
    Ok {
        remaining: i64,
    },
    InvalidIndex {
        message: String,
    },
    AlreadyResolved {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MergeFinalizeInput {
    pub merge_id: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MergeFinalizeOutput {
    Ok {
        result: String,
    },
    UnresolvedConflicts {
        count: i64,
    },
}


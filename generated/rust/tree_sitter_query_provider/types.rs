// generated: tree_sitter_query_provider/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TreeSitterQueryProviderInitializeInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TreeSitterQueryProviderInitializeOutput {
    Ok {
        instance: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TreeSitterQueryProviderExecuteInput {
    pub pattern: String,
    pub tree: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TreeSitterQueryProviderExecuteOutput {
    Ok {
        matches: String,
    },
    InvalidPattern {
        message: String,
    },
}


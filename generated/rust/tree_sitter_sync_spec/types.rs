// generated: tree_sitter_sync_spec/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TreeSitterSyncSpecInitializeInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TreeSitterSyncSpecInitializeOutput {
    Ok {
        instance: String,
    },
    LoadError {
        message: String,
    },
}


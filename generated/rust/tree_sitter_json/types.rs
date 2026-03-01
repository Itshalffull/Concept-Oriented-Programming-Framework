// generated: tree_sitter_json/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TreeSitterJsonInitializeInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TreeSitterJsonInitializeOutput {
    Ok {
        instance: String,
    },
    LoadError {
        message: String,
    },
}


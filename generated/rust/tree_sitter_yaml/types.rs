// generated: tree_sitter_yaml/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TreeSitterYamlInitializeInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TreeSitterYamlInitializeOutput {
    Ok {
        instance: String,
    },
    LoadError {
        message: String,
    },
}


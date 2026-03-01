// generated: tree_sitter_theme_spec/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TreeSitterThemeSpecInitializeInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TreeSitterThemeSpecInitializeOutput {
    Ok {
        instance: String,
    },
    LoadError {
        message: String,
    },
}


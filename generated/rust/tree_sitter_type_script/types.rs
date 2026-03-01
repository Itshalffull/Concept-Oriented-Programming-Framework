// generated: tree_sitter_type_script/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TreeSitterTypeScriptInitializeInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TreeSitterTypeScriptInitializeOutput {
    Ok {
        instance: String,
    },
    LoadError {
        message: String,
    },
}


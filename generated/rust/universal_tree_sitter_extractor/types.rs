// generated: universal_tree_sitter_extractor/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UniversalTreeSitterExtractorInitializeInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum UniversalTreeSitterExtractorInitializeOutput {
    Ok {
        instance: String,
    },
    LoadError {
        message: String,
    },
}


// generated: tree_sitter_concept_spec/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TreeSitterConceptSpecInitializeInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TreeSitterConceptSpecInitializeOutput {
    Ok {
        instance: String,
    },
    LoadError {
        message: String,
    },
}


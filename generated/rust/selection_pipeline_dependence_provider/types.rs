// generated: selection_pipeline_dependence_provider/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SelectionPipelineDependenceProviderInitializeInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SelectionPipelineDependenceProviderInitializeOutput {
    Ok {
        instance: String,
    },
    LoadError {
        message: String,
    },
}


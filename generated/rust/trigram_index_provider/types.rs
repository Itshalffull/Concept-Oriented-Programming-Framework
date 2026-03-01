// generated: trigram_index_provider/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TrigramIndexProviderInitializeInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TrigramIndexProviderInitializeOutput {
    Ok {
        instance: String,
    },
    LoadError {
        message: String,
    },
}


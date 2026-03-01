// generated: sync_spec_symbol_extractor/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncSpecSymbolExtractorInitializeInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyncSpecSymbolExtractorInitializeOutput {
    Ok {
        instance: String,
    },
    LoadError {
        message: String,
    },
}


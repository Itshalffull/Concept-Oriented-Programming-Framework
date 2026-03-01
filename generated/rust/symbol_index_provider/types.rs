// generated: symbol_index_provider/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SymbolIndexProviderInitializeInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SymbolIndexProviderInitializeOutput {
    Ok {
        instance: String,
    },
    LoadError {
        message: String,
    },
}


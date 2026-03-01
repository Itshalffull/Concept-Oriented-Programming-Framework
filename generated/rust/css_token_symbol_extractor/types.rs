// generated: css_token_symbol_extractor/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CssTokenSymbolExtractorInitializeInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CssTokenSymbolExtractorInitializeOutput {
    Ok {
        instance: String,
    },
    LoadError {
        message: String,
    },
}


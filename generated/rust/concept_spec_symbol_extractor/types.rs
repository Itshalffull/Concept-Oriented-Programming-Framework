// generated: concept_spec_symbol_extractor/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConceptSpecSymbolExtractorInitializeInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConceptSpecSymbolExtractorInitializeOutput {
    Ok {
        instance: String,
    },
    LoadError {
        message: String,
    },
}


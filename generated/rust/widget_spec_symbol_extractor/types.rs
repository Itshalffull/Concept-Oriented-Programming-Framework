// generated: widget_spec_symbol_extractor/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetSpecSymbolExtractorInitializeInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetSpecSymbolExtractorInitializeOutput {
    Ok {
        instance: String,
    },
    LoadError {
        message: String,
    },
}


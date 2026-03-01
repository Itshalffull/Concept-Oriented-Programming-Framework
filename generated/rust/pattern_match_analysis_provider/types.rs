// generated: pattern_match_analysis_provider/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PatternMatchAnalysisProviderInitializeInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PatternMatchAnalysisProviderInitializeOutput {
    Ok {
        instance: String,
    },
    LoadError {
        message: String,
    },
}


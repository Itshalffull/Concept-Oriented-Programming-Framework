// generated: spec/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SpecEmitInput {
    pub projections: Vec<String>,
    pub format: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SpecEmitOutput {
    Ok {
        document: String,
        content: String,
    },
    FormatError {
        format: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SpecValidateInput {
    pub document: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SpecValidateOutput {
    Ok {
        document: String,
    },
    Invalid {
        document: String,
        errors: Vec<String>,
    },
}


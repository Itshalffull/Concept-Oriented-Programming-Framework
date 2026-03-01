// generated: open_api_target/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OpenApiTargetGenerateInput {
    pub projections: Vec<String>,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum OpenApiTargetGenerateOutput {
    Ok {
        spec: String,
        content: String,
    },
}


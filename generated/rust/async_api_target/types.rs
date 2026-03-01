// generated: async_api_target/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AsyncApiTargetGenerateInput {
    pub projections: Vec<String>,
    pub sync_specs: Vec<String>,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AsyncApiTargetGenerateOutput {
    Ok {
        spec: String,
        content: String,
    },
}


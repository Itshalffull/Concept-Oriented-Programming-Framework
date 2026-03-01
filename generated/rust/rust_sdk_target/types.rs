// generated: rust_sdk_target/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RustSdkTargetGenerateInput {
    pub projection: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RustSdkTargetGenerateOutput {
    Ok {
        crate: String,
        files: Vec<String>,
    },
}


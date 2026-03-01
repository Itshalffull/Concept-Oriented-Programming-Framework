// generated: java_sdk_target/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JavaSdkTargetGenerateInput {
    pub projection: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum JavaSdkTargetGenerateOutput {
    Ok {
        artifact: String,
        files: Vec<String>,
    },
}


// generated: nextjs_gen/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NextjsGenGenerateInput {
    pub spec: String,
    pub manifest: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum NextjsGenGenerateOutput {
    Ok {
        files: Vec<{ path: String, content: String }>,
    },
    Error {
        message: String,
    },
}


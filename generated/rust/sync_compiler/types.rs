// generated: sync_compiler/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncCompilerCompileInput {
    pub sync: String,
    pub ast: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyncCompilerCompileOutput {
    Ok {
        compiled: serde_json::Value,
    },
    Error {
        message: String,
    },
}


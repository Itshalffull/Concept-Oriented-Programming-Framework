// generated: sync_parser/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncParserParseInput {
    pub source: String,
    pub manifests: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyncParserParseOutput {
    Ok {
        sync: String,
        ast: serde_json::Value,
    },
    Error {
        message: String,
        line: i64,
    },
}


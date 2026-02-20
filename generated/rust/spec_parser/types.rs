// generated: spec_parser/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SpecParserParseInput {
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SpecParserParseOutput {
    Ok {
        spec: String,
        ast: serde_json::Value,
    },
    Error {
        message: String,
        line: i64,
    },
}


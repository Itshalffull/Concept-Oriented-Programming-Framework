// generated: dotenv_provider/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DotenvProviderFetchInput {
    pub name: String,
    pub file_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DotenvProviderFetchOutput {
    Ok {
        value: String,
    },
    FileNotFound {
        file_path: String,
    },
    ParseError {
        file_path: String,
        line: i64,
        reason: String,
    },
    VariableNotSet {
        name: String,
        file_path: String,
    },
}


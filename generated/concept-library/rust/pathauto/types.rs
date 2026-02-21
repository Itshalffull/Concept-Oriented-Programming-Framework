// generated: pathauto/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PathautoGenerateAliasInput {
    pub pattern: String,
    pub entity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PathautoGenerateAliasOutput {
    Ok {
        alias: String,
    },
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PathautoBulkGenerateInput {
    pub pattern: String,
    pub entities: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PathautoBulkGenerateOutput {
    Ok {
        aliases: String,
    },
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PathautoCleanStringInput {
    pub input: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PathautoCleanStringOutput {
    Ok {
        cleaned: String,
    },
}


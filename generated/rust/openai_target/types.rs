// generated: openai_target/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OpenaiTargetGenerateInput {
    pub projection: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum OpenaiTargetGenerateOutput {
    Ok {
        functions: Vec<String>,
        files: Vec<String>,
    },
    TooManyFunctions {
        count: i64,
        limit: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OpenaiTargetValidateInput {
    pub function: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum OpenaiTargetValidateOutput {
    Ok {
        function: String,
    },
    MissingDescription {
        function: String,
        function_name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OpenaiTargetListFunctionsInput {
    pub concept: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum OpenaiTargetListFunctionsOutput {
    Ok {
        functions: Vec<String>,
    },
}


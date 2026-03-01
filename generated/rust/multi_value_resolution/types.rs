// generated: multi_value_resolution/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MultiValueResolutionRegisterInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MultiValueResolutionRegisterOutput {
    Ok {
        name: String,
        category: String,
        priority: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MultiValueResolutionAttemptResolveInput {
    pub base: Option<Vec<u8>>,
    pub v1: Vec<u8>,
    pub v2: Vec<u8>,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MultiValueResolutionAttemptResolveOutput {
    Resolved {
        result: Vec<u8>,
    },
    CannotResolve {
        reason: String,
    },
}


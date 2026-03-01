// generated: manual_resolution/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ManualResolutionRegisterInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ManualResolutionRegisterOutput {
    Ok {
        name: String,
        category: String,
        priority: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ManualResolutionAttemptResolveInput {
    pub base: Option<Vec<u8>>,
    pub v1: Vec<u8>,
    pub v2: Vec<u8>,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ManualResolutionAttemptResolveOutput {
    CannotResolve {
        reason: String,
    },
}


// generated: l_w_w_resolution/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LWWResolutionRegisterInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LWWResolutionRegisterOutput {
    Ok {
        name: String,
        category: String,
        priority: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LWWResolutionAttemptResolveInput {
    pub base: Option<Vec<u8>>,
    pub v1: Vec<u8>,
    pub v2: Vec<u8>,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LWWResolutionAttemptResolveOutput {
    Resolved {
        result: Vec<u8>,
    },
    CannotResolve {
        reason: String,
    },
}


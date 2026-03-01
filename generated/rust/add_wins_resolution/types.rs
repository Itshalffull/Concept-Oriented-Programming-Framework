// generated: add_wins_resolution/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AddWinsResolutionRegisterInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AddWinsResolutionRegisterOutput {
    Ok {
        name: String,
        category: String,
        priority: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AddWinsResolutionAttemptResolveInput {
    pub base: Option<Vec<u8>>,
    pub v1: Vec<u8>,
    pub v2: Vec<u8>,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AddWinsResolutionAttemptResolveOutput {
    Resolved {
        result: Vec<u8>,
    },
    CannotResolve {
        reason: String,
    },
}


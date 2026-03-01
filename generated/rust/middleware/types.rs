// generated: middleware/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MiddlewareResolveInput {
    pub traits: Vec<String>,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MiddlewareResolveOutput {
    Ok {
        middlewares: Vec<String>,
        order: Vec<i64>,
    },
    MissingImplementation {
        trait: String,
        target: String,
    },
    IncompatibleTraits {
        trait1: String,
        trait2: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MiddlewareInjectInput {
    pub output: String,
    pub middlewares: Vec<String>,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MiddlewareInjectOutput {
    Ok {
        output: String,
        injected_count: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MiddlewareRegisterInput {
    pub trait: String,
    pub target: String,
    pub implementation: String,
    pub position: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MiddlewareRegisterOutput {
    Ok {
        middleware: String,
    },
    DuplicateRegistration {
        trait: String,
        target: String,
    },
}


// generated: rest_target/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RestTargetGenerateInput {
    pub projection: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RestTargetGenerateOutput {
    Ok {
        routes: Vec<String>,
        files: Vec<String>,
    },
    AmbiguousMapping {
        action: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RestTargetValidateInput {
    pub route: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RestTargetValidateOutput {
    Ok {
        route: String,
    },
    PathConflict {
        route: String,
        conflicting: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RestTargetListRoutesInput {
    pub concept: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RestTargetListRoutesOutput {
    Ok {
        routes: Vec<String>,
        methods: Vec<String>,
    },
}


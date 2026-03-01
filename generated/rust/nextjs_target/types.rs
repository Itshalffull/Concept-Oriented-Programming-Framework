// generated: nextjs_target/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NextjsTargetGenerateInput {
    pub projection: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum NextjsTargetGenerateOutput {
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
pub struct NextjsTargetValidateInput {
    pub route: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum NextjsTargetValidateOutput {
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
pub struct NextjsTargetListRoutesInput {
    pub concept: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum NextjsTargetListRoutesOutput {
    Ok {
        routes: Vec<String>,
        methods: Vec<String>,
    },
}


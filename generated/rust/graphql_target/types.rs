// generated: graphql_target/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GraphqlTargetGenerateInput {
    pub projection: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GraphqlTargetGenerateOutput {
    Ok {
        types: Vec<String>,
        files: Vec<String>,
    },
    FederationConflict {
        type: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GraphqlTargetValidateInput {
    pub type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GraphqlTargetValidateOutput {
    Ok {
        type: String,
    },
    CyclicType {
        type: String,
        cycle: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GraphqlTargetListOperationsInput {
    pub concept: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GraphqlTargetListOperationsOutput {
    Ok {
        queries: Vec<String>,
        mutations: Vec<String>,
        subscriptions: Vec<String>,
    },
}


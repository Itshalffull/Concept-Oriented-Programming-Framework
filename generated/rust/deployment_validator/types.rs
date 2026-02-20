// generated: deployment_validator/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeploymentValidatorParseInput {
    pub raw: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DeploymentValidatorParseOutput {
    Ok {
        manifest: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeploymentValidatorValidateInput {
    pub manifest: String,
    pub concepts: Vec<serde_json::Value>,
    pub syncs: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DeploymentValidatorValidateOutput {
    Ok {
        plan: serde_json::Value,
    },
    Warning {
        plan: serde_json::Value,
        issues: Vec<String>,
    },
    Error {
        issues: Vec<String>,
    },
}


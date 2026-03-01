// generated: env/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EnvResolveInput {
    pub environment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EnvResolveOutput {
    Ok {
        environment: String,
        resolved: String,
    },
    MissingBase {
        environment: String,
    },
    ConflictingOverrides {
        environment: String,
        conflicts: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EnvPromoteInput {
    pub from_env: String,
    pub to_env: String,
    pub kit_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EnvPromoteOutput {
    Ok {
        to_env: String,
        version: String,
    },
    NotValidated {
        from_env: String,
        kit_name: String,
    },
    VersionMismatch {
        from_env: String,
        to_env: String,
        details: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EnvDiffInput {
    pub env_a: String,
    pub env_b: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EnvDiffOutput {
    Ok {
        differences: Vec<String>,
    },
}


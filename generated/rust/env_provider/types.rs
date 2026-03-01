// generated: env_provider/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EnvProviderFetchInput {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EnvProviderFetchOutput {
    Ok {
        value: String,
    },
    VariableNotSet {
        name: String,
    },
}


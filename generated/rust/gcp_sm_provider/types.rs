// generated: gcp_sm_provider/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GcpSmProviderFetchInput {
    pub secret_id: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GcpSmProviderFetchOutput {
    Ok {
        value: String,
        version_id: String,
        project_id: String,
    },
    IamBindingMissing {
        secret_id: String,
        principal: String,
    },
    VersionDisabled {
        secret_id: String,
        version: String,
    },
    SecretNotFound {
        secret_id: String,
        project_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GcpSmProviderRotateInput {
    pub secret_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GcpSmProviderRotateOutput {
    Ok {
        secret_id: String,
        new_version_id: String,
    },
}


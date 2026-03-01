// generated: vault_provider/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VaultProviderFetchInput {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum VaultProviderFetchOutput {
    Ok {
        value: String,
        lease_id: String,
        lease_duration: i64,
    },
    Sealed {
        address: String,
    },
    TokenExpired {
        address: String,
    },
    PathNotFound {
        path: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VaultProviderRenewLeaseInput {
    pub lease_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum VaultProviderRenewLeaseOutput {
    Ok {
        lease_id: String,
        new_duration: i64,
    },
    LeaseExpired {
        lease_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VaultProviderRotateInput {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum VaultProviderRotateOutput {
    Ok {
        new_version: i64,
    },
}


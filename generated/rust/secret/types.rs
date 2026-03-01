// generated: secret/types.rs

use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SecretResolveInput {
    pub name: String,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SecretResolveOutput {
    Ok {
        secret: String,
        version: String,
    },
    NotFound {
        name: String,
        provider: String,
    },
    AccessDenied {
        name: String,
        provider: String,
        reason: String,
    },
    Expired {
        name: String,
        expires_at: DateTime<Utc>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SecretExistsInput {
    pub name: String,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SecretExistsOutput {
    Ok {
        name: String,
        exists: bool,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SecretRotateInput {
    pub name: String,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SecretRotateOutput {
    Ok {
        secret: String,
        new_version: String,
    },
    RotationUnsupported {
        name: String,
        provider: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SecretInvalidateCacheInput {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SecretInvalidateCacheOutput {
    Ok {
        secret: String,
    },
}


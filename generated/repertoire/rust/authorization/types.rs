// generated: authorization/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AuthorizationGrantPermissionInput {
    pub role: String,
    pub permission: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AuthorizationGrantPermissionOutput {
    Ok {
        role: String,
        permission: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AuthorizationRevokePermissionInput {
    pub role: String,
    pub permission: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AuthorizationRevokePermissionOutput {
    Ok {
        role: String,
        permission: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AuthorizationAssignRoleInput {
    pub user: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AuthorizationAssignRoleOutput {
    Ok {
        user: String,
        role: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AuthorizationCheckPermissionInput {
    pub user: String,
    pub permission: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AuthorizationCheckPermissionOutput {
    Ok {
        granted: bool,
    },
}


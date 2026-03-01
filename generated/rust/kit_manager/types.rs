// generated: kit_manager/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KitManagerInitInput {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum KitManagerInitOutput {
    Ok {
        kit: String,
        path: String,
    },
    AlreadyExists {
        name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KitManagerValidateInput {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum KitManagerValidateOutput {
    Ok {
        kit: String,
        concepts: i64,
        syncs: i64,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KitManagerTestInput {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum KitManagerTestOutput {
    Ok {
        kit: String,
        passed: i64,
        failed: i64,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KitManagerListInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum KitManagerListOutput {
    Ok {
        suites: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KitManagerCheckOverridesInput {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum KitManagerCheckOverridesOutput {
    Ok {
        valid: i64,
        warnings: Vec<String>,
    },
    InvalidOverride {
        override: String,
        reason: String,
    },
}


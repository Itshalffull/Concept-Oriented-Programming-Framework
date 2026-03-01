// generated: ref/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RefCreateInput {
    pub name: String,
    pub hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RefCreateOutput {
    Ok {
        ref: String,
    },
    Exists {
        message: String,
    },
    InvalidHash {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RefUpdateInput {
    pub name: String,
    pub new_hash: String,
    pub expected_old_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RefUpdateOutput {
    Ok,
    NotFound {
        message: String,
    },
    Conflict {
        current: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RefDeleteInput {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RefDeleteOutput {
    Ok,
    NotFound {
        message: String,
    },
    Protected {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RefResolveInput {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RefResolveOutput {
    Ok {
        hash: String,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RefLogInput {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RefLogOutput {
    Ok {
        entries: Vec<{ old_hash: String, new_hash: String, timestamp: String, agent: String }>,
    },
    NotFound {
        message: String,
    },
}


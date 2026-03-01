// generated: branch/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BranchCreateInput {
    pub name: String,
    pub from_node: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BranchCreateOutput {
    Ok {
        branch: String,
    },
    Exists {
        message: String,
    },
    UnknownNode {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BranchAdvanceInput {
    pub branch: String,
    pub new_node: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BranchAdvanceOutput {
    Ok,
    NotFound {
        message: String,
    },
    Protected {
        message: String,
    },
    UnknownNode {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BranchDeleteInput {
    pub branch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BranchDeleteOutput {
    Ok,
    NotFound {
        message: String,
    },
    Protected {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BranchProtectInput {
    pub branch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BranchProtectOutput {
    Ok,
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BranchSetUpstreamInput {
    pub branch: String,
    pub upstream: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BranchSetUpstreamOutput {
    Ok,
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BranchDivergencePointInput {
    pub b1: String,
    pub b2: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BranchDivergencePointOutput {
    Ok {
        node_id: String,
    },
    NoDivergence {
        message: String,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BranchArchiveInput {
    pub branch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BranchArchiveOutput {
    Ok,
    NotFound {
        message: String,
    },
}


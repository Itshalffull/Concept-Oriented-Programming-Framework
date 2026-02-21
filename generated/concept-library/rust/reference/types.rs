// generated: reference/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReferenceAddRefInput {
    pub source: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ReferenceAddRefOutput {
    Ok {
        source: String,
        target: String,
    },
    Exists {
        source: String,
        target: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReferenceRemoveRefInput {
    pub source: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ReferenceRemoveRefOutput {
    Ok {
        source: String,
        target: String,
    },
    Notfound {
        source: String,
        target: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReferenceGetRefsInput {
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ReferenceGetRefsOutput {
    Ok {
        targets: String,
    },
    Notfound {
        source: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReferenceResolveTargetInput {
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ReferenceResolveTargetOutput {
    Ok {
        exists: bool,
    },
}


// generated: kind_system/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KindSystemDefineInput {
    pub name: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum KindSystemDefineOutput {
    Ok {
        kind: String,
    },
    Exists {
        kind: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KindSystemConnectInput {
    pub from: String,
    pub to: String,
    pub relation: String,
    pub transform_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum KindSystemConnectOutput {
    Ok,
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KindSystemRouteInput {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum KindSystemRouteOutput {
    Ok {
        path: Vec<{ kind: String, relation: String, transform: Option<String> }>,
    },
    Unreachable {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KindSystemValidateInput {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum KindSystemValidateOutput {
    Ok,
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KindSystemDependentsInput {
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum KindSystemDependentsOutput {
    Ok {
        downstream: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KindSystemProducersInput {
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum KindSystemProducersOutput {
    Ok {
        transforms: Vec<{ from_kind: String, transform_name: Option<String> }>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KindSystemConsumersInput {
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum KindSystemConsumersOutput {
    Ok {
        transforms: Vec<{ to_kind: String, transform_name: Option<String> }>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct KindSystemGraphInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum KindSystemGraphOutput {
    Ok {
        kinds: Vec<{ name: String, category: String }>,
        edges: Vec<{ from: String, to: String, relation: String, transform: Option<String> }>,
    },
}


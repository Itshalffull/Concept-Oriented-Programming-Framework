// generated: relation/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RelationDefineRelationInput {
    pub relation: String,
    pub schema: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RelationDefineRelationOutput {
    Ok {
        relation: String,
    },
    Exists {
        relation: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RelationLinkInput {
    pub relation: String,
    pub source: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RelationLinkOutput {
    Ok {
        relation: String,
        source: String,
        target: String,
    },
    Invalid {
        relation: String,
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RelationUnlinkInput {
    pub relation: String,
    pub source: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RelationUnlinkOutput {
    Ok {
        relation: String,
        source: String,
        target: String,
    },
    Notfound {
        relation: String,
        source: String,
        target: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RelationGetRelatedInput {
    pub relation: String,
    pub entity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RelationGetRelatedOutput {
    Ok {
        related: String,
    },
    Notfound {
        relation: String,
        entity: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RelationDefineRollupInput {
    pub relation: String,
    pub formula: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RelationDefineRollupOutput {
    Ok {
        relation: String,
        formula: String,
    },
    Notfound {
        relation: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RelationComputeRollupInput {
    pub relation: String,
    pub entity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RelationComputeRollupOutput {
    Ok {
        value: String,
    },
    Notfound {
        relation: String,
        entity: String,
    },
}


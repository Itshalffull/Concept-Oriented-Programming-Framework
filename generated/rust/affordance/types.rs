// generated: affordance/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AffordanceDeclareInput {
    pub affordance: String,
    pub widget: String,
    pub interactor: String,
    pub specificity: i64,
    pub conditions: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AffordanceDeclareOutput {
    Ok {
        affordance: String,
    },
    Duplicate {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AffordanceMatchInput {
    pub affordance: String,
    pub interactor: String,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AffordanceMatchOutput {
    Ok {
        matches: String,
    },
    None {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AffordanceExplainInput {
    pub affordance: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AffordanceExplainOutput {
    Ok {
        affordance: String,
        reason: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AffordanceRemoveInput {
    pub affordance: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AffordanceRemoveOutput {
    Ok {
        affordance: String,
    },
    Notfound {
        message: String,
    },
}


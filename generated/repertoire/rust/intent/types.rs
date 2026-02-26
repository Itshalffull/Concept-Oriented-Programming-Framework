// generated: intent/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IntentDefineInput {
    pub intent: String,
    pub target: String,
    pub purpose: String,
    pub operational_principle: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum IntentDefineOutput {
    Ok {
        intent: String,
    },
    Exists {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IntentUpdateInput {
    pub intent: String,
    pub purpose: String,
    pub operational_principle: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum IntentUpdateOutput {
    Ok {
        intent: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IntentVerifyInput {
    pub intent: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum IntentVerifyOutput {
    Ok {
        valid: bool,
        failures: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IntentDiscoverInput {
    pub query: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum IntentDiscoverOutput {
    Ok {
        matches: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IntentSuggestFromDescriptionInput {
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum IntentSuggestFromDescriptionOutput {
    Ok {
        suggested: String,
    },
}


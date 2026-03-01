// generated: slot/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SlotDefineInput {
    pub slot: String,
    pub name: String,
    pub host: String,
    pub position: String,
    pub fallback: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SlotDefineOutput {
    Ok {
        slot: String,
    },
    Duplicate {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SlotFillInput {
    pub slot: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SlotFillOutput {
    Ok {
        slot: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SlotClearInput {
    pub slot: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SlotClearOutput {
    Ok {
        slot: String,
    },
    Notfound {
        message: String,
    },
}


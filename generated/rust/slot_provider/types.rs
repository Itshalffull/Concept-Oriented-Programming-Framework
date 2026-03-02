// generated: slot_provider/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SlotProviderInitializeInput {
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SlotProviderInitializeOutput {
    Ok {
        instance: String,
        plugin_ref: String,
    },
    ConfigError {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SlotProviderDefineInput {
    pub slot_name: String,
    pub accepts: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SlotProviderDefineOutput {
    Ok {
        slot_name: String,
    },
    AlreadyExists {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SlotProviderFillInput {
    pub slot_name: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SlotProviderFillOutput {
    Ok {
        slot_name: String,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SlotProviderClearInput {
    pub slot_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SlotProviderClearOutput {
    Ok {
        slot_name: String,
    },
    NotFound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SlotProviderGetSlotsInput {
    pub filter: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SlotProviderGetSlotsOutput {
    Ok {
        slots: String,
    },
}

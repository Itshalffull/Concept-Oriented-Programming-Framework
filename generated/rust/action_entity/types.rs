// generated: action_entity/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ActionEntityRegisterInput {
    pub concept: String,
    pub name: String,
    pub params: String,
    pub variant_refs: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ActionEntityRegisterOutput {
    Ok {
        action: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ActionEntityFindByConceptInput {
    pub concept: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ActionEntityFindByConceptOutput {
    Ok {
        actions: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ActionEntityTriggeringSyncsInput {
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ActionEntityTriggeringSyncsOutput {
    Ok {
        syncs: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ActionEntityInvokingSyncsInput {
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ActionEntityInvokingSyncsOutput {
    Ok {
        syncs: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ActionEntityImplementationsInput {
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ActionEntityImplementationsOutput {
    Ok {
        symbols: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ActionEntityInterfaceExposuresInput {
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ActionEntityInterfaceExposuresOutput {
    Ok {
        exposures: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ActionEntityGetInput {
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ActionEntityGetOutput {
    Ok {
        action: String,
        concept: String,
        name: String,
        params: String,
        variant_count: i64,
    },
    Notfound,
}


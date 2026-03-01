// generated: anatomy_part_entity/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnatomyPartEntityRegisterInput {
    pub widget: String,
    pub name: String,
    pub role: String,
    pub required: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AnatomyPartEntityRegisterOutput {
    Ok {
        part: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnatomyPartEntityFindByRoleInput {
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AnatomyPartEntityFindByRoleOutput {
    Ok {
        parts: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnatomyPartEntityFindBoundToFieldInput {
    pub field: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AnatomyPartEntityFindBoundToFieldOutput {
    Ok {
        parts: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnatomyPartEntityFindBoundToActionInput {
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AnatomyPartEntityFindBoundToActionOutput {
    Ok {
        parts: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnatomyPartEntityGetInput {
    pub part: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AnatomyPartEntityGetOutput {
    Ok {
        part: String,
        widget: String,
        name: String,
        semantic_role: String,
        required: String,
    },
    Notfound,
}


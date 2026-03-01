// generated: interactor_entity/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InteractorEntityRegisterInput {
    pub name: String,
    pub category: String,
    pub properties: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InteractorEntityRegisterOutput {
    Ok {
        entity: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InteractorEntityFindByCategoryInput {
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InteractorEntityFindByCategoryOutput {
    Ok {
        interactors: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InteractorEntityMatchingWidgetsInput {
    pub interactor: String,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InteractorEntityMatchingWidgetsOutput {
    Ok {
        widgets: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InteractorEntityClassifiedFieldsInput {
    pub interactor: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InteractorEntityClassifiedFieldsOutput {
    Ok {
        fields: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InteractorEntityCoverageReportInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InteractorEntityCoverageReportOutput {
    Ok {
        report: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InteractorEntityGetInput {
    pub interactor: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InteractorEntityGetOutput {
    Ok {
        interactor: String,
        name: String,
        category: String,
        properties: String,
    },
    Notfound,
}


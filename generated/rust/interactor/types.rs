// generated: interactor/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InteractorDefineInput {
    pub interactor: String,
    pub name: String,
    pub category: String,
    pub properties: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InteractorDefineOutput {
    Ok {
        interactor: String,
    },
    Duplicate {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InteractorClassifyInput {
    pub interactor: String,
    pub field_type: String,
    pub constraints: Option<String>,
    pub intent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InteractorClassifyOutput {
    Ok {
        interactor: String,
        confidence: f64,
    },
    Ambiguous {
        interactor: String,
        candidates: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InteractorGetInput {
    pub interactor: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InteractorGetOutput {
    Ok {
        interactor: String,
        name: String,
        category: String,
        properties: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InteractorListInput {
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum InteractorListOutput {
    Ok {
        interactors: String,
    },
}


// generated: state_field/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StateFieldRegisterInput {
    pub concept: String,
    pub name: String,
    pub type_expr: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum StateFieldRegisterOutput {
    Ok {
        field: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StateFieldFindByConceptInput {
    pub concept: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum StateFieldFindByConceptOutput {
    Ok {
        fields: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StateFieldTraceToGeneratedInput {
    pub field: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum StateFieldTraceToGeneratedOutput {
    Ok {
        targets: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StateFieldTraceToStorageInput {
    pub field: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum StateFieldTraceToStorageOutput {
    Ok {
        targets: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StateFieldGetInput {
    pub field: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum StateFieldGetOutput {
    Ok {
        field: String,
        concept: String,
        name: String,
        type_expr: String,
        cardinality: String,
    },
    Notfound,
}


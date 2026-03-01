// generated: u_i_schema/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UISchemaInspectInput {
    pub schema: String,
    pub concept_spec: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum UISchemaInspectOutput {
    Ok {
        schema: String,
    },
    ParseError {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UISchemaOverrideInput {
    pub schema: String,
    pub overrides: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum UISchemaOverrideOutput {
    Ok {
        schema: String,
    },
    Notfound {
        message: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UISchemaGetSchemaInput {
    pub schema: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum UISchemaGetSchemaOutput {
    Ok {
        schema: String,
        ui_schema: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UISchemaGetElementsInput {
    pub schema: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum UISchemaGetElementsOutput {
    Ok {
        elements: String,
    },
    Notfound {
        message: String,
    },
}


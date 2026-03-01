// generated: form_builder/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FormBuilderBuildFormInput {
    pub form: String,
    pub schema: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FormBuilderBuildFormOutput {
    Ok {
        definition: String,
    },
    Error {
        message: String,
    },
}


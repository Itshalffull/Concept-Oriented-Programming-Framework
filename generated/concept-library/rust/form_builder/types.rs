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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FormBuilderValidateInput {
    pub form: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FormBuilderValidateOutput {
    Ok {
        valid: bool,
        errors: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FormBuilderProcessSubmissionInput {
    pub form: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FormBuilderProcessSubmissionOutput {
    Ok {
        result: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FormBuilderRegisterWidgetInput {
    pub form: String,
    pub type: String,
    pub widget: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FormBuilderRegisterWidgetOutput {
    Ok {
        form: String,
    },
    Exists {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FormBuilderGetWidgetInput {
    pub form: String,
    pub type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FormBuilderGetWidgetOutput {
    Ok {
        widget: String,
    },
    Notfound {
        message: String,
    },
}


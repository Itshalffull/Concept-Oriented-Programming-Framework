// generated: template/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TemplateDefineInput {
    pub template: String,
    pub body: String,
    pub variables: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TemplateDefineOutput {
    Ok,
    Exists {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TemplateInstantiateInput {
    pub template: String,
    pub values: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TemplateInstantiateOutput {
    Ok {
        content: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TemplateRegisterTriggerInput {
    pub template: String,
    pub trigger: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TemplateRegisterTriggerOutput {
    Ok,
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TemplateMergePropertiesInput {
    pub template: String,
    pub properties: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TemplateMergePropertiesOutput {
    Ok,
    Notfound {
        message: String,
    },
}


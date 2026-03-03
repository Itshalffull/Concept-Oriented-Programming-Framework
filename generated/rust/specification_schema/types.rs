// generated: specification_schema/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SpecificationSchemaDefineInput {
    pub name: String,
    pub category: String,
    pub pattern_type: String,
    pub template_text: String,
    pub formal_language: String,
    pub parameters: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SpecificationSchemaDefineOutput {
    Ok {
        schema: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SpecificationSchemaInstantiateInput {
    pub schema: String,
    pub parameter_values: Vec<u8>,
    pub target_symbol: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SpecificationSchemaInstantiateOutput {
    Ok {
        property_ref: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SpecificationSchemaValidateInput {
    pub schema: String,
    pub parameter_values: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SpecificationSchemaValidateOutput {
    Ok {
        valid: bool,
        instantiated_preview: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SpecificationSchemaList_by_categoryInput {
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SpecificationSchemaList_by_categoryOutput {
    Ok {
        schemas: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SpecificationSchemaSearchInput {
    pub query: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SpecificationSchemaSearchOutput {
    Ok {
        schemas: Vec<String>,
    },
}

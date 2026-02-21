// generated: schema/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SchemaDefineSchemaInput {
    pub schema: String,
    pub fields: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SchemaDefineSchemaOutput {
    Ok,
    Exists {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SchemaAddFieldInput {
    pub schema: String,
    pub field: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SchemaAddFieldOutput {
    Ok,
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SchemaExtendSchemaInput {
    pub schema: String,
    pub parent: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SchemaExtendSchemaOutput {
    Ok,
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SchemaApplyToInput {
    pub entity: String,
    pub schema: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SchemaApplyToOutput {
    Ok,
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SchemaRemoveFromInput {
    pub entity: String,
    pub schema: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SchemaRemoveFromOutput {
    Ok,
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SchemaGetAssociationsInput {
    pub schema: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SchemaGetAssociationsOutput {
    Ok {
        associations: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SchemaExportInput {
    pub schema: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SchemaExportOutput {
    Ok {
        data: String,
    },
    Notfound {
        message: String,
    },
}


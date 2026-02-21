// generated: alias/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AliasAddAliasInput {
    pub entity: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AliasAddAliasOutput {
    Ok {
        entity: String,
        name: String,
    },
    Exists {
        entity: String,
        name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AliasRemoveAliasInput {
    pub entity: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AliasRemoveAliasOutput {
    Ok {
        entity: String,
        name: String,
    },
    Notfound {
        entity: String,
        name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AliasResolveInput {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AliasResolveOutput {
    Ok {
        entity: String,
    },
    Notfound {
        name: String,
    },
}


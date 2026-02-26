// generated: exposed_filter/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExposedFilterExposeInput {
    pub filter: String,
    pub field_name: String,
    pub operator: String,
    pub default_value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ExposedFilterExposeOutput {
    Ok {
        filter: String,
    },
    Exists {
        filter: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExposedFilterCollectInputInput {
    pub filter: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ExposedFilterCollectInputOutput {
    Ok {
        filter: String,
    },
    Notfound {
        filter: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExposedFilterApplyToQueryInput {
    pub filter: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ExposedFilterApplyToQueryOutput {
    Ok {
        query_mod: String,
    },
    Notfound {
        filter: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExposedFilterResetToDefaultsInput {
    pub filter: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ExposedFilterResetToDefaultsOutput {
    Ok {
        filter: String,
    },
    Notfound {
        filter: String,
    },
}


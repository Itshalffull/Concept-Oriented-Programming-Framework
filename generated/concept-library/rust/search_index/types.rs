// generated: search_index/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SearchIndexCreateIndexInput {
    pub index: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SearchIndexCreateIndexOutput {
    Ok {
        index: String,
    },
    Exists {
        index: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SearchIndexIndexItemInput {
    pub index: String,
    pub item: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SearchIndexIndexItemOutput {
    Ok {
        index: String,
    },
    Notfound {
        index: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SearchIndexRemoveItemInput {
    pub index: String,
    pub item: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SearchIndexRemoveItemOutput {
    Ok {
        index: String,
    },
    Notfound {
        index: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SearchIndexSearchInput {
    pub index: String,
    pub query: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SearchIndexSearchOutput {
    Ok {
        results: String,
    },
    Notfound {
        index: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SearchIndexAddProcessorInput {
    pub index: String,
    pub processor: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SearchIndexAddProcessorOutput {
    Ok {
        index: String,
    },
    Notfound {
        index: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SearchIndexReindexInput {
    pub index: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SearchIndexReindexOutput {
    Ok {
        count: i64,
    },
    Notfound {
        index: String,
    },
}


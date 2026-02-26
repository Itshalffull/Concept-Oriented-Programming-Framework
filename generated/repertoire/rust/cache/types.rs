// generated: cache/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CacheSetInput {
    pub bin: String,
    pub key: String,
    pub data: String,
    pub tags: String,
    pub max_age: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CacheSetOutput {
    Ok,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CacheGetInput {
    pub bin: String,
    pub key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CacheGetOutput {
    Ok {
        data: String,
    },
    Miss,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CacheInvalidateInput {
    pub bin: String,
    pub key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CacheInvalidateOutput {
    Ok,
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CacheInvalidateByTagsInput {
    pub tags: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CacheInvalidateByTagsOutput {
    Ok {
        count: i64,
    },
}


// generated: query/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QueryParseInput {
    pub query: String,
    pub expression: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum QueryParseOutput {
    Ok {
        query: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QueryExecuteInput {
    pub query: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum QueryExecuteOutput {
    Ok {
        results: String,
    },
    Notfound {
        query: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QuerySubscribeInput {
    pub query: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum QuerySubscribeOutput {
    Ok {
        subscription_id: String,
    },
    Notfound {
        query: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QueryAddFilterInput {
    pub query: String,
    pub filter: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum QueryAddFilterOutput {
    Ok {
        query: String,
    },
    Notfound {
        query: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QueryAddSortInput {
    pub query: String,
    pub sort: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum QueryAddSortOutput {
    Ok {
        query: String,
    },
    Notfound {
        query: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QuerySetScopeInput {
    pub query: String,
    pub scope: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum QuerySetScopeOutput {
    Ok {
        query: String,
    },
    Notfound {
        query: String,
    },
}


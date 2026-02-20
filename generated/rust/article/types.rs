// generated: article/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ArticleCreateInput {
    pub article: String,
    pub title: String,
    pub description: String,
    pub body: String,
    pub author: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ArticleCreateOutput {
    Ok {
        article: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ArticleUpdateInput {
    pub article: String,
    pub title: String,
    pub description: String,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ArticleUpdateOutput {
    Ok {
        article: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ArticleDeleteInput {
    pub article: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ArticleDeleteOutput {
    Ok {
        article: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ArticleGetInput {
    pub article: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ArticleGetOutput {
    Ok {
        article: String,
        slug: String,
        title: String,
        description: String,
        body: String,
        author: String,
    },
    Notfound {
        message: String,
    },
}


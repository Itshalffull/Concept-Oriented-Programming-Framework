// generated: profile/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProfileUpdateInput {
    pub user: String,
    pub bio: String,
    pub image: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProfileUpdateOutput {
    Ok {
        user: String,
        bio: String,
        image: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProfileGetInput {
    pub user: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProfileGetOutput {
    Ok {
        user: String,
        bio: String,
        image: String,
    },
    Notfound {
        message: String,
    },
}


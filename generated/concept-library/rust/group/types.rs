// generated: group/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GroupCreateGroupInput {
    pub group: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GroupCreateGroupOutput {
    Ok,
    Exists {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GroupAddMemberInput {
    pub group: String,
    pub user: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GroupAddMemberOutput {
    Ok,
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GroupAssignGroupRoleInput {
    pub group: String,
    pub user: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GroupAssignGroupRoleOutput {
    Ok,
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GroupAddContentInput {
    pub group: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GroupAddContentOutput {
    Ok,
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GroupCheckGroupAccessInput {
    pub group: String,
    pub user: String,
    pub permission: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GroupCheckGroupAccessOutput {
    Ok {
        granted: bool,
    },
    Notfound {
        message: String,
    },
}


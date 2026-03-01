// generated: collection/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CollectionCreateInput {
    pub collection: String,
    pub type: String,
    pub schema: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CollectionCreateOutput {
    Ok,
    Exists,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CollectionAddMemberInput {
    pub collection: String,
    pub member: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CollectionAddMemberOutput {
    Ok,
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CollectionRemoveMemberInput {
    pub collection: String,
    pub member: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CollectionRemoveMemberOutput {
    Ok,
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CollectionGetMembersInput {
    pub collection: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CollectionGetMembersOutput {
    Ok {
        members: String,
    },
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CollectionSetSchemaInput {
    pub collection: String,
    pub schema: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CollectionSetSchemaOutput {
    Ok,
    Notfound,
}


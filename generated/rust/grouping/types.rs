// generated: grouping/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GroupingGroupInput {
    pub items: Vec<String>,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GroupingGroupOutput {
    Ok {
        grouping: String,
        groups: Vec<String>,
        group_count: i64,
    },
    InvalidStrategy {
        strategy: String,
    },
    EmptyInput,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GroupingClassifyInput {
    pub action_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GroupingClassifyOutput {
    Ok {
        crud_role: String,
        intent: String,
        event_producing: bool,
        event_verb: String,
        mcp_type: String,
    },
}


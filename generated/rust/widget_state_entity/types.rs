// generated: widget_state_entity/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetStateEntityRegisterInput {
    pub widget: String,
    pub name: String,
    pub initial: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetStateEntityRegisterOutput {
    Ok {
        widget_state: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetStateEntityFindByWidgetInput {
    pub widget: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetStateEntityFindByWidgetOutput {
    Ok {
        states: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetStateEntityReachableFromInput {
    pub widget_state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetStateEntityReachableFromOutput {
    Ok {
        reachable: String,
        via: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetStateEntityUnreachableStatesInput {
    pub widget: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetStateEntityUnreachableStatesOutput {
    Ok {
        unreachable: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetStateEntityTraceEventInput {
    pub widget: String,
    pub event: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetStateEntityTraceEventOutput {
    Ok {
        paths: String,
    },
    Unhandled {
        in_states: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetStateEntityGetInput {
    pub widget_state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetStateEntityGetOutput {
    Ok {
        widget_state: String,
        widget: String,
        name: String,
        initial: String,
        transition_count: i64,
    },
    Notfound,
}


// generated: widget_prop_entity/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetPropEntityRegisterInput {
    pub widget: String,
    pub name: String,
    pub type_expr: String,
    pub default_value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetPropEntityRegisterOutput {
    Ok {
        prop: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetPropEntityFindByWidgetInput {
    pub widget: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetPropEntityFindByWidgetOutput {
    Ok {
        props: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetPropEntityTraceToFieldInput {
    pub prop: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetPropEntityTraceToFieldOutput {
    Ok {
        field: String,
        concept: String,
        via_binding: String,
    },
    NoBinding,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetPropEntityGetInput {
    pub prop: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetPropEntityGetOutput {
    Ok {
        prop: String,
        widget: String,
        name: String,
        type_expr: String,
        default_value: String,
    },
    Notfound,
}


// generated: widget_resolver/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetResolverResolveInput {
    pub resolver: String,
    pub element: String,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetResolverResolveOutput {
    Ok {
        resolver: String,
        widget: String,
        score: f64,
        reason: String,
    },
    Ambiguous {
        resolver: String,
        candidates: String,
    },
    None {
        resolver: String,
        element: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetResolverResolveAllInput {
    pub resolver: String,
    pub elements: String,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetResolverResolveAllOutput {
    Ok {
        resolver: String,
        resolutions: String,
    },
    Partial {
        resolver: String,
        resolved: String,
        unresolved: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetResolverOverrideInput {
    pub resolver: String,
    pub element: String,
    pub widget: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetResolverOverrideOutput {
    Ok {
        resolver: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetResolverSetWeightsInput {
    pub resolver: String,
    pub weights: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetResolverSetWeightsOutput {
    Ok {
        resolver: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetResolverExplainInput {
    pub resolver: String,
    pub element: String,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetResolverExplainOutput {
    Ok {
        resolver: String,
        explanation: String,
    },
    Notfound {
        message: String,
    },
}


// generated: widget_entity/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetEntityRegisterInput {
    pub name: String,
    pub source: String,
    pub ast: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetEntityRegisterOutput {
    Ok {
        entity: String,
    },
    AlreadyRegistered {
        existing: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetEntityGetInput {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetEntityGetOutput {
    Ok {
        entity: String,
    },
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetEntityFindByAffordanceInput {
    pub interactor: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetEntityFindByAffordanceOutput {
    Ok {
        widgets: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetEntityFindComposingInput {
    pub widget: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetEntityFindComposingOutput {
    Ok {
        parents: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetEntityFindComposedByInput {
    pub widget: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetEntityFindComposedByOutput {
    Ok {
        children: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetEntityGeneratedComponentsInput {
    pub widget: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetEntityGeneratedComponentsOutput {
    Ok {
        components: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetEntityAccessibilityAuditInput {
    pub widget: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetEntityAccessibilityAuditOutput {
    Ok {
        report: String,
    },
    Incomplete {
        missing: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WidgetEntityTraceToConceptInput {
    pub widget: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WidgetEntityTraceToConceptOutput {
    Ok {
        concepts: String,
    },
    NoConceptBinding,
}


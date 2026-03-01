// generated: automation_rule/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AutomationRuleDefineInput {
    pub rule: String,
    pub trigger: String,
    pub conditions: String,
    pub actions: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AutomationRuleDefineOutput {
    Ok,
    Exists {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AutomationRuleEnableInput {
    pub rule: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AutomationRuleEnableOutput {
    Ok,
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AutomationRuleDisableInput {
    pub rule: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AutomationRuleDisableOutput {
    Ok,
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AutomationRuleExecuteInput {
    pub rule: String,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AutomationRuleExecuteOutput {
    Ok {
        result: String,
    },
    Notfound {
        message: String,
    },
}


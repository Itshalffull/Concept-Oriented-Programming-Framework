// generated: webhook_inbox/types.rs
// Inbound webhook event correlation and delivery to waiting process instances.
// See Architecture doc Sections 16.11, 16.12

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WebhookInboxRegisterInput {
    pub run_ref: String,
    pub step_ref: String,
    pub event_type: String,
    pub correlation_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WebhookInboxRegisterOutput {
    Ok {
        hook_id: String,
        run_ref: String,
        status: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WebhookInboxReceiveInput {
    pub correlation_key: String,
    pub event_type: String,
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WebhookInboxReceiveOutput {
    Ok {
        hook_id: String,
        run_ref: String,
        step_ref: String,
        payload: serde_json::Value,
    },
    NoMatch {
        correlation_key: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WebhookInboxExpireInput {
    pub hook_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WebhookInboxExpireOutput {
    Ok {
        hook_id: String,
        run_ref: String,
        step_ref: String,
    },
    NotWaiting {
        hook_id: String,
        current_status: String,
    },
    NotFound {
        hook_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WebhookInboxAckInput {
    pub hook_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WebhookInboxAckOutput {
    Ok {
        hook_id: String,
    },
    NotReceived {
        hook_id: String,
        current_status: String,
    },
    NotFound {
        hook_id: String,
    },
}

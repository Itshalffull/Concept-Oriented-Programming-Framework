// WorkItem concept types
// Models human-assigned work items with lifecycle: create, claim, start, complete, reject, delegate, release.

use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WorkItemCreateInput {
    pub title: String,
    pub description: String,
    pub priority: String,
    pub assigned_to: Option<String>,
    pub due_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WorkItemCreateOutput {
    Ok {
        work_item_id: String,
        status: String,
    },
    ValidationError {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WorkItemClaimInput {
    pub work_item_id: String,
    pub claimed_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WorkItemClaimOutput {
    Ok {
        work_item_id: String,
        claimed_by: String,
    },
    AlreadyClaimed {
        work_item_id: String,
        current_owner: String,
    },
    NotFound {
        work_item_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WorkItemStartInput {
    pub work_item_id: String,
    pub started_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WorkItemStartOutput {
    Ok {
        work_item_id: String,
        status: String,
    },
    NotClaimed {
        work_item_id: String,
        message: String,
    },
    NotFound {
        work_item_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WorkItemCompleteInput {
    pub work_item_id: String,
    pub completed_by: String,
    pub result: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WorkItemCompleteOutput {
    Ok {
        work_item_id: String,
        status: String,
    },
    InvalidState {
        work_item_id: String,
        current_status: String,
        message: String,
    },
    NotFound {
        work_item_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WorkItemRejectInput {
    pub work_item_id: String,
    pub rejected_by: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WorkItemRejectOutput {
    Ok {
        work_item_id: String,
        status: String,
    },
    InvalidState {
        work_item_id: String,
        current_status: String,
        message: String,
    },
    NotFound {
        work_item_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WorkItemDelegateInput {
    pub work_item_id: String,
    pub delegated_by: String,
    pub delegate_to: String,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WorkItemDelegateOutput {
    Ok {
        work_item_id: String,
        delegated_to: String,
    },
    NotOwner {
        work_item_id: String,
        message: String,
    },
    NotFound {
        work_item_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WorkItemReleaseInput {
    pub work_item_id: String,
    pub released_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum WorkItemReleaseOutput {
    Ok {
        work_item_id: String,
        status: String,
    },
    NotOwner {
        work_item_id: String,
        message: String,
    },
    NotFound {
        work_item_id: String,
    },
}

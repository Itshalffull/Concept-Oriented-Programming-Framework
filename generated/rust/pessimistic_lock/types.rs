// generated: pessimistic_lock/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PessimisticLockCheckOutInput {
    pub resource: String,
    pub holder: String,
    pub duration: Option<i64>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PessimisticLockCheckOutOutput {
    Ok {
        lock_id: String,
    },
    AlreadyLocked {
        holder: String,
        expires: Option<String>,
    },
    Queued {
        position: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PessimisticLockCheckInInput {
    pub lock_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PessimisticLockCheckInOutput {
    Ok,
    NotFound {
        message: String,
    },
    NotHolder {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PessimisticLockBreakLockInput {
    pub lock_id: String,
    pub breaker: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PessimisticLockBreakLockOutput {
    Ok {
        previous_holder: String,
    },
    NotFound {
        message: String,
    },
    Unauthorized {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PessimisticLockRenewInput {
    pub lock_id: String,
    pub additional_duration: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PessimisticLockRenewOutput {
    Ok {
        new_expires: String,
    },
    NotFound {
        message: String,
    },
    NotHolder {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PessimisticLockQueryLocksInput {
    pub resource: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PessimisticLockQueryLocksOutput {
    Ok {
        locks: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PessimisticLockQueryQueueInput {
    pub resource: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PessimisticLockQueryQueueOutput {
    Ok {
        waiters: Vec<{ requester: String, requested: String }>,
    },
}


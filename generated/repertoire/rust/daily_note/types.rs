// generated: daily_note/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DailyNoteGetOrCreateTodayInput {
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DailyNoteGetOrCreateTodayOutput {
    Ok {
        note: String,
        created: bool,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DailyNoteNavigateToDateInput {
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DailyNoteNavigateToDateOutput {
    Ok {
        note: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DailyNoteListRecentInput {
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DailyNoteListRecentOutput {
    Ok {
        notes: String,
    },
}


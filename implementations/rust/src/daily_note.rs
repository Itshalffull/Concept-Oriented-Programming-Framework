// DailyNote Concept Implementation (Rust)
//
// Manages daily notes with date-based creation and navigation.
// See Architecture doc Sections on daily journal and note management.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── GetOrCreateToday ──────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetOrCreateTodayInput {}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum GetOrCreateTodayOutput {
    #[serde(rename = "ok")]
    Ok {
        page_id: String,
        date: String,
        created: bool,
    },
}

// ── NavigateToDate ────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavigateToDateInput {
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum NavigateToDateOutput {
    #[serde(rename = "ok")]
    Ok { page_id: String },
    #[serde(rename = "notfound")]
    NotFound { message: String },
}

// ── ListRecent ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListRecentInput {
    pub count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "variant")]
pub enum ListRecentOutput {
    #[serde(rename = "ok")]
    Ok { notes: String },
}

// ── Handler ───────────────────────────────────────────────

pub struct DailyNoteHandler;

impl DailyNoteHandler {
    pub async fn get_or_create_today(
        &self,
        _input: GetOrCreateTodayInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<GetOrCreateTodayOutput> {
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let page_id = format!("daily_{}", today);

        let existing = storage.get("daily_note", &page_id).await?;

        let created = existing.is_none();

        if created {
            storage
                .put(
                    "daily_note",
                    &page_id,
                    json!({
                        "page_id": page_id,
                        "date": today,
                        "content": "",
                        "created_at": chrono::Utc::now().to_rfc3339(),
                    }),
                )
                .await?;
        }

        Ok(GetOrCreateTodayOutput::Ok {
            page_id,
            date: today,
            created,
        })
    }

    pub async fn navigate_to_date(
        &self,
        input: NavigateToDateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<NavigateToDateOutput> {
        let page_id = format!("daily_{}", input.date);
        let existing = storage.get("daily_note", &page_id).await?;

        match existing {
            Some(_) => Ok(NavigateToDateOutput::Ok { page_id }),
            None => Ok(NavigateToDateOutput::NotFound {
                message: format!("No daily note for date '{}'", input.date),
            }),
        }
    }

    pub async fn list_recent(
        &self,
        input: ListRecentInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ListRecentOutput> {
        let all_notes = storage.find("daily_note", None).await?;

        // Sort by date descending and take the requested count
        let mut notes: Vec<serde_json::Value> = all_notes
            .into_iter()
            .map(|n| {
                json!({
                    "page_id": n["page_id"],
                    "date": n["date"],
                    "created_at": n["created_at"],
                })
            })
            .collect();

        notes.sort_by(|a, b| {
            let da = a["date"].as_str().unwrap_or("");
            let db = b["date"].as_str().unwrap_or("");
            db.cmp(da)
        });

        notes.truncate(input.count as usize);

        Ok(ListRecentOutput::Ok {
            notes: serde_json::to_string(&notes)?,
        })
    }
}

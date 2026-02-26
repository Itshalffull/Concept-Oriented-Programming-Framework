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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn get_or_create_today_creates_new() {
        let storage = InMemoryStorage::new();
        let handler = DailyNoteHandler;
        let result = handler
            .get_or_create_today(GetOrCreateTodayInput {}, &storage)
            .await
            .unwrap();
        match result {
            GetOrCreateTodayOutput::Ok { page_id, date, created } => {
                assert!(page_id.starts_with("daily_"));
                assert!(!date.is_empty());
                assert!(created);
            }
        }
    }

    #[tokio::test]
    async fn get_or_create_today_returns_existing() {
        let storage = InMemoryStorage::new();
        let handler = DailyNoteHandler;
        // First call creates
        handler.get_or_create_today(GetOrCreateTodayInput {}, &storage).await.unwrap();
        // Second call finds existing
        let result = handler
            .get_or_create_today(GetOrCreateTodayInput {}, &storage)
            .await
            .unwrap();
        match result {
            GetOrCreateTodayOutput::Ok { created, .. } => {
                assert!(!created);
            }
        }
    }

    #[tokio::test]
    async fn navigate_to_date_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DailyNoteHandler;
        let result = handler
            .navigate_to_date(
                NavigateToDateInput { date: "2099-01-01".into() },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, NavigateToDateOutput::NotFound { .. }));
    }

    #[tokio::test]
    async fn navigate_to_date_found() {
        let storage = InMemoryStorage::new();
        let handler = DailyNoteHandler;
        // Create today's note first
        let create_result = handler
            .get_or_create_today(GetOrCreateTodayInput {}, &storage)
            .await
            .unwrap();
        let today_date = match create_result {
            GetOrCreateTodayOutput::Ok { date, .. } => date,
        };
        // Navigate to today's date
        let result = handler
            .navigate_to_date(
                NavigateToDateInput { date: today_date.clone() },
                &storage,
            )
            .await
            .unwrap();
        match result {
            NavigateToDateOutput::Ok { page_id } => {
                assert_eq!(page_id, format!("daily_{}", today_date));
            }
            NavigateToDateOutput::NotFound { .. } => panic!("expected Ok"),
        }
    }

    #[tokio::test]
    async fn list_recent_empty() {
        let storage = InMemoryStorage::new();
        let handler = DailyNoteHandler;
        let result = handler
            .list_recent(ListRecentInput { count: 5 }, &storage)
            .await
            .unwrap();
        match result {
            ListRecentOutput::Ok { notes } => {
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&notes).unwrap();
                assert!(parsed.is_empty());
            }
        }
    }

    #[tokio::test]
    async fn list_recent_returns_notes() {
        let storage = InMemoryStorage::new();
        let handler = DailyNoteHandler;
        handler.get_or_create_today(GetOrCreateTodayInput {}, &storage).await.unwrap();
        let result = handler
            .list_recent(ListRecentInput { count: 10 }, &storage)
            .await
            .unwrap();
        match result {
            ListRecentOutput::Ok { notes } => {
                let parsed: Vec<serde_json::Value> = serde_json::from_str(&notes).unwrap();
                assert_eq!(parsed.len(), 1);
            }
        }
    }
}

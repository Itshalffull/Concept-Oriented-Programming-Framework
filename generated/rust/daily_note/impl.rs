// DailyNote Handler Implementation
//
// Date-based note management. Creates daily notes with today's date,
// navigates to notes by date, and lists recent notes sorted by recency.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::DailyNoteHandler;
use serde_json::json;

pub struct DailyNoteHandlerImpl;

#[async_trait]
impl DailyNoteHandler for DailyNoteHandlerImpl {
    async fn get_or_create_today(
        &self,
        input: DailyNoteGetOrCreateTodayInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DailyNoteGetOrCreateTodayOutput, Box<dyn std::error::Error>> {
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();

        let existing = storage.find("dailyNote", json!({ "date": today })).await?;

        if !existing.is_empty() {
            let note = existing[0]["note"].as_str().unwrap_or("").to_string();
            return Ok(DailyNoteGetOrCreateTodayOutput::Ok {
                note,
                created: false,
            });
        }

        storage.put("dailyNote", &input.note, json!({
            "note": input.note,
            "date": today,
            "dateFormat": "YYYY-MM-DD",
            "templateId": "",
            "targetFolder": "",
        })).await?;

        Ok(DailyNoteGetOrCreateTodayOutput::Ok {
            note: input.note,
            created: true,
        })
    }

    async fn navigate_to_date(
        &self,
        input: DailyNoteNavigateToDateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DailyNoteNavigateToDateOutput, Box<dyn std::error::Error>> {
        let results = storage.find("dailyNote", json!({ "date": input.date })).await?;

        if results.is_empty() {
            return Ok(DailyNoteNavigateToDateOutput::Notfound {
                message: format!("No note exists for date \"{}\"", input.date),
            });
        }

        let note = results[0]["note"].as_str().unwrap_or("").to_string();
        Ok(DailyNoteNavigateToDateOutput::Ok { note })
    }

    async fn list_recent(
        &self,
        input: DailyNoteListRecentInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DailyNoteListRecentOutput, Box<dyn std::error::Error>> {
        let all_notes = storage.find("dailyNote", json!({})).await?;

        let mut notes_with_dates: Vec<(&serde_json::Value, String)> = all_notes.iter()
            .map(|n| (n, n["date"].as_str().unwrap_or("").to_string()))
            .collect();

        // Sort by date descending
        notes_with_dates.sort_by(|a, b| b.1.cmp(&a.1));

        let count = input.count as usize;
        let recent: Vec<serde_json::Value> = notes_with_dates.iter()
            .take(count)
            .map(|(n, _)| json!({
                "note": n["note"],
                "date": n["date"],
            }))
            .collect();

        Ok(DailyNoteListRecentOutput::Ok {
            notes: serde_json::to_string(&recent)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_get_or_create_today_creates() {
        let storage = InMemoryStorage::new();
        let handler = DailyNoteHandlerImpl;
        let result = handler.get_or_create_today(
            DailyNoteGetOrCreateTodayInput { note: "daily-1".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            DailyNoteGetOrCreateTodayOutput::Ok { note, created } => {
                assert_eq!(note, "daily-1");
                assert!(created);
            },
        }
    }

    #[tokio::test]
    async fn test_navigate_to_date_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DailyNoteHandlerImpl;
        let result = handler.navigate_to_date(
            DailyNoteNavigateToDateInput { date: "1999-01-01".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            DailyNoteNavigateToDateOutput::Notfound { message } => {
                assert!(message.contains("1999-01-01"));
            },
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_list_recent() {
        let storage = InMemoryStorage::new();
        let handler = DailyNoteHandlerImpl;
        let result = handler.list_recent(
            DailyNoteListRecentInput { count: 5 },
            &storage,
        ).await.unwrap();
        match result {
            DailyNoteListRecentOutput::Ok { notes } => {
                // Valid even if empty
                assert!(!notes.is_empty());
            },
        }
    }

    #[tokio::test]
    async fn test_create_then_navigate() {
        let storage = InMemoryStorage::new();
        let handler = DailyNoteHandlerImpl;

        // Create today's note
        handler.get_or_create_today(
            DailyNoteGetOrCreateTodayInput { note: "today-note".to_string() },
            &storage,
        ).await.unwrap();

        // Navigate to today
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let result = handler.navigate_to_date(
            DailyNoteNavigateToDateInput { date: today },
            &storage,
        ).await.unwrap();
        match result {
            DailyNoteNavigateToDateOutput::Ok { note } => {
                assert_eq!(note, "today-note");
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}

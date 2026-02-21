// generated: daily_note/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::DailyNoteHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn daily_note_invariant_1() {
        // invariant 1: after getOrCreateToday, getOrCreateToday behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let n = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // getOrCreateToday(note: n) -> ok(note: n, created: true)
        let step1 = handler.get_or_create_today(
            GetOrCreateTodayInput { note: n.clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            GetOrCreateTodayOutput::Ok { note, created, .. } => {
                assert_eq!(note, n.clone());
                assert_eq!(created, true);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // getOrCreateToday(note: n) -> ok(note: n, created: false)
        let step2 = handler.get_or_create_today(
            GetOrCreateTodayInput { note: n.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOrCreateTodayOutput::Ok { note, created, .. } => {
                assert_eq!(note, n.clone());
                assert_eq!(created, false);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}

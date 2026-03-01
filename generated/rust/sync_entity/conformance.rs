// generated: sync_entity/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SyncEntityHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn sync_entity_invariant_1() {
        // invariant 1: after register, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let y = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(name: "ArticlePublishSync", source: "syncs/article-publish.sync", compiled: "{}") -> ok(sync: y)
        let step1 = handler.register(
            RegisterInput { name: "ArticlePublishSync".to_string(), source: "syncs/article-publish.sync".to_string(), compiled: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { sync, .. } => {
                assert_eq!(sync, y.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(sync: y) -> ok(sync: y, name: "ArticlePublishSync", annotations: _, tier: _, whenPatternCount: _, thenActionCount: _)
        let step2 = handler.get(
            GetInput { sync: y.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { sync, name, annotations, tier, when_pattern_count, then_action_count, .. } => {
                assert_eq!(sync, y.clone());
                assert_eq!(name, "ArticlePublishSync".to_string());
                assert_eq!(annotations, .clone());
                assert_eq!(tier, .clone());
                assert_eq!(when_pattern_count, .clone());
                assert_eq!(then_action_count, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn sync_entity_invariant_2() {
        // invariant 2: after register, register behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let y = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(name: "ArticlePublishSync", source: "syncs/article-publish.sync", compiled: "{}") -> ok(sync: y)
        let step1 = handler.register(
            RegisterInput { name: "ArticlePublishSync".to_string(), source: "syncs/article-publish.sync".to_string(), compiled: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { sync, .. } => {
                assert_eq!(sync, y.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // register(name: "ArticlePublishSync", source: "syncs/article-publish.sync", compiled: "{}") -> alreadyRegistered(existing: y)
        let step2 = handler.register(
            RegisterInput { name: "ArticlePublishSync".to_string(), source: "syncs/article-publish.sync".to_string(), compiled: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            RegisterOutput::AlreadyRegistered { existing, .. } => {
                assert_eq!(existing, y.clone());
            },
            other => panic!("Expected AlreadyRegistered, got {:?}", other),
        }
    }

}

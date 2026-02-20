// generated: favorite/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::FavoriteHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn favorite_invariant_1() {
        // invariant 1: after favorite, isFavorited, unfavorite behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let u = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // favorite(user: u, article: "a1") -> ok(user: u, article: "a1")
        let step1 = handler.favorite(
            FavoriteInput { user: u.clone(), article: "a1".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            FavoriteOutput::Ok { user, article, .. } => {
                assert_eq!(user, u.clone());
                assert_eq!(article, "a1".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // isFavorited(user: u, article: "a1") -> ok(favorited: true)
        let step2 = handler.is_favorited(
            IsFavoritedInput { user: u.clone(), article: "a1".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            IsFavoritedOutput::Ok { favorited, .. } => {
                assert_eq!(favorited, true);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // unfavorite(user: u, article: "a1") -> ok(user: u, article: "a1")
        let step3 = handler.unfavorite(
            UnfavoriteInput { user: u.clone(), article: "a1".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            UnfavoriteOutput::Ok { user, article, .. } => {
                assert_eq!(user, u.clone());
                assert_eq!(article, "a1".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}

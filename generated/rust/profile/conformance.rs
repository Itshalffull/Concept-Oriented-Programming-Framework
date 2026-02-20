// generated: profile/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ProfileHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn profile_invariant_1() {
        // invariant 1: after update, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let u = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // update(user: u, bio: "Hello world", image: "http://img.png") -> ok(user: u, bio: "Hello world", image: "http://img.png")
        let step1 = handler.update(
            UpdateInput { user: u.clone(), bio: "Hello world".to_string(), image: "http://img.png".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            UpdateOutput::Ok { user, bio, image, .. } => {
                assert_eq!(user, u.clone());
                assert_eq!(bio, "Hello world".to_string());
                assert_eq!(image, "http://img.png".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(user: u) -> ok(user: u, bio: "Hello world", image: "http://img.png")
        let step2 = handler.get(
            GetInput { user: u.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { user, bio, image, .. } => {
                assert_eq!(user, u.clone());
                assert_eq!(bio, "Hello world".to_string());
                assert_eq!(image, "http://img.png".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}

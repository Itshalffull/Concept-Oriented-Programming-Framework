// generated: follow/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::FollowHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn follow_invariant_1() {
        // invariant 1: after follow, isFollowing, unfollow behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let u = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // follow(user: u, target: "u2") -> ok(user: u, target: "u2")
        let step1 = handler.follow(
            FollowInput { user: u.clone(), target: "u2".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            FollowOutput::Ok { user, target, .. } => {
                assert_eq!(user, u.clone());
                assert_eq!(target, "u2".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // isFollowing(user: u, target: "u2") -> ok(following: true)
        let step2 = handler.is_following(
            IsFollowingInput { user: u.clone(), target: "u2".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            IsFollowingOutput::Ok { following, .. } => {
                assert_eq!(following, true);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // unfollow(user: u, target: "u2") -> ok(user: u, target: "u2")
        let step3 = handler.unfollow(
            UnfollowInput { user: u.clone(), target: "u2".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            UnfollowOutput::Ok { user, target, .. } => {
                assert_eq!(user, u.clone());
                assert_eq!(target, "u2".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}

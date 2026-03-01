// generated: motion/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::MotionHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn motion_invariant_1() {
        // invariant 1: after defineDuration, defineTransition, defineDuration behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let o = "u-test-invariant-001".to_string();
        let o2 = "u-test-invariant-002".to_string();
        let o3 = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // defineDuration(motion: o, name: "normal", ms: 200) -> ok(motion: o)
        let step1 = handler.define_duration(
            DefineDurationInput { motion: o.clone(), name: "normal".to_string(), ms: 200 },
            &storage,
        ).await.unwrap();
        match step1 {
            DefineDurationOutput::Ok { motion, .. } => {
                assert_eq!(motion, o.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // defineTransition(motion: o2, name: "fade", config: "{ \"property\": \"opacity\", \"duration\": \"normal\", \"easing\": \"ease-out\" }") -> ok(motion: o2)
        let step2 = handler.define_transition(
            DefineTransitionInput { motion: o2.clone(), name: "fade".to_string(), config: "{ "property": "opacity", "duration": "normal", "easing": "ease-out" }".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            DefineTransitionOutput::Ok { motion, .. } => {
                assert_eq!(motion, o2.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // defineDuration(motion: o3, name: "bad", ms: -1) -> invalid(message: _)
        let step3 = handler.define_duration(
            DefineDurationInput { motion: o3.clone(), name: "bad".to_string(), ms: -1 },
            &storage,
        ).await.unwrap();
        match step3 {
            DefineDurationOutput::Invalid { message, .. } => {
                assert_eq!(message, .clone());
            },
            other => panic!("Expected Invalid, got {:?}", other),
        }
    }

}

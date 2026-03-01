// generated: elevation/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ElevationHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn elevation_invariant_1() {
        // invariant 1: after define, get, define behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let w = "u-test-invariant-001".to_string();
        let w2 = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // define(elevation: w, level: 2, shadow: "[{ \"y\": 4, \"blur\": 8, \"color\": \"rgba(0,0,0,0.12)\" }]") -> ok(elevation: w)
        let step1 = handler.define(
            DefineInput { elevation: w.clone(), level: 2, shadow: "[{ "y": 4, "blur": 8, "color": "rgba(0,0,0,0.12)" }]".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            DefineOutput::Ok { elevation, .. } => {
                assert_eq!(elevation, w.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(elevation: w) -> ok(elevation: w, shadow: "[{ \"y\": 4, \"blur\": 8, \"color\": \"rgba(0,0,0,0.12)\" }]")
        let step2 = handler.get(
            GetInput { elevation: w.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { elevation, shadow, .. } => {
                assert_eq!(elevation, w.clone());
                assert_eq!(shadow, "[{ "y": 4, "blur": 8, "color": "rgba(0,0,0,0.12)" }]".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // define(elevation: w2, level: 7, shadow: "[]") -> invalid(message: _)
        let step3 = handler.define(
            DefineInput { elevation: w2.clone(), level: 7, shadow: "[]".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            DefineOutput::Invalid { message, .. } => {
                assert_eq!(message, .clone());
            },
            other => panic!("Expected Invalid, got {:?}", other),
        }
    }

}

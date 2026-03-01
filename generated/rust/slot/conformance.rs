// generated: slot/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SlotHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn slot_invariant_1() {
        // invariant 1: after define, fill behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let l = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // define(slot: l, name: "header", host: "dialog", position: "before-title", fallback: _) -> ok(slot: l)
        let step1 = handler.define(
            DefineInput { slot: l.clone(), name: "header".to_string(), host: "dialog".to_string(), position: "before-title".to_string(), fallback: .clone() },
            &storage,
        ).await.unwrap();
        match step1 {
            DefineOutput::Ok { slot, .. } => {
                assert_eq!(slot, l.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // fill(slot: l, content: "Custom Header") -> ok(slot: l)
        let step2 = handler.fill(
            FillInput { slot: l.clone(), content: "Custom Header".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            FillOutput::Ok { slot, .. } => {
                assert_eq!(slot, l.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}

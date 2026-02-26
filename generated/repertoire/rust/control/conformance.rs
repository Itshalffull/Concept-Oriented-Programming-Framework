// generated: control/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ControlHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn control_invariant_1() {
        // invariant 1: after create, setValue, getValue behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let k = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // create(control: k, type: "slider", binding: "volume") -> ok()
        let step1 = handler.create(
            CreateInput { control: k.clone(), type: "slider".to_string(), binding: "volume".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, CreateOutput::Ok));

        // --- THEN clause ---
        // setValue(control: k, value: "75") -> ok()
        let step2 = handler.set_value(
            SetValueInput { control: k.clone(), value: "75".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, SetValueOutput::Ok));
        // getValue(control: k) -> ok(value: "75")
        let step3 = handler.get_value(
            GetValueInput { control: k.clone() },
            &storage,
        ).await.unwrap();
        match step3 {
            GetValueOutput::Ok { value, .. } => {
                assert_eq!(value, "75".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}

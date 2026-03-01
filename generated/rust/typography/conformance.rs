// generated: typography/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::TypographyHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn typography_invariant_1() {
        // invariant 1: after defineScale, defineStyle behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let x = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // defineScale(typography: x, baseSize: 16, ratio: 1.25, steps: 6) -> ok(typography: x, scale: _)
        let step1 = handler.define_scale(
            DefineScaleInput { typography: x.clone(), base_size: 16, ratio: 1.25, steps: 6 },
            &storage,
        ).await.unwrap();
        match step1 {
            DefineScaleOutput::Ok { typography, scale, .. } => {
                assert_eq!(typography, x.clone());
                assert_eq!(scale, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // defineStyle(typography: x, name: "heading-1", config: "{ \"scale\": \"3xl\", \"weight\": 700 }") -> ok(typography: x)
        let step2 = handler.define_style(
            DefineStyleInput { typography: x.clone(), name: "heading-1".to_string(), config: "{ "scale": "3xl", "weight": 700 }".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            DefineStyleOutput::Ok { typography, .. } => {
                assert_eq!(typography, x.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}

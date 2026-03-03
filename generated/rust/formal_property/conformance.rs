// generated: formal_property/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::FormalPropertyHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn formal_property_invariant_1() {
        // invariant 1: after define, check, coverage behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let p = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // define(target_symbol: "clef/concept/Password", kind: "invariant", property_text: "forall p: Password | len(p.hash) > 0", formal_language: "smtlib", scope: "local", priority: "required") -> ok(property: p)
        let step1 = handler.define(
            DefineInput { target_symbol: "clef/concept/Password".to_string(), kind: "invariant".to_string(), property_text: "forall p: Password | len(p.hash) > 0".to_string(), formal_language: "smtlib".to_string(), scope: "local".to_string(), priority: "required".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            DefineOutput::Ok { property, .. } => {
                assert_eq!(property, p.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // check(property: p, solver: "z3", timeout_ms: 5000) -> ok(property: p, status: "proved")
        let step2 = handler.check(
            CheckInput { property: p.clone(), solver: "z3".to_string(), timeout_ms: 5000 },
            &storage,
        ).await.unwrap();
        match step2 {
            CheckOutput::Ok { property, status, .. } => {
                assert_eq!(property, p.clone());
                assert_eq!(status, "proved".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // coverage(target_symbol: "clef/concept/Password") -> ok(total: 1, proved: 1, refuted: 0, unknown: 0, timeout: 0, coverage_pct: 100)
        let step3 = handler.coverage(
            CoverageInput { target_symbol: "clef/concept/Password".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            CoverageOutput::Ok { total, proved, refuted, unknown, timeout, coverage_pct, .. } => {
                assert_eq!(total, 1);
                assert_eq!(proved, 1);
                assert_eq!(refuted, 0);
                assert_eq!(unknown, 0);
                assert_eq!(timeout, 0);
                assert_eq!(coverage_pct, 100);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
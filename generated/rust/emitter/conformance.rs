// generated: emitter/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::EmitterHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn emitter_invariant_1() {
        // invariant 1: after write, write behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let h1 = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // write(path: "src/password.ts", content: "export const x = 1;", formatHint: "typescript", sources: []) -> ok(written: true, path: "src/password.ts", contentHash: h1)
        let step1 = handler.write(
            WriteInput { path: "src/password.ts".to_string(), content: "export const x = 1;".to_string(), format_hint: "typescript".to_string(), sources: todo!(/* list: [] */) },
            &storage,
        ).await.unwrap();
        match step1 {
            WriteOutput::Ok { written, path, content_hash, .. } => {
                assert_eq!(written, true);
                assert_eq!(path, "src/password.ts".to_string());
                assert_eq!(content_hash, h1.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // write(path: "src/password.ts", content: "export const x = 1;", formatHint: "typescript", sources: []) -> ok(written: false, path: "src/password.ts", contentHash: h1)
        let step2 = handler.write(
            WriteInput { path: "src/password.ts".to_string(), content: "export const x = 1;".to_string(), format_hint: "typescript".to_string(), sources: todo!(/* list: [] */) },
            &storage,
        ).await.unwrap();
        match step2 {
            WriteOutput::Ok { written, path, content_hash, .. } => {
                assert_eq!(written, false);
                assert_eq!(path, "src/password.ts".to_string());
                assert_eq!(content_hash, h1.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn emitter_invariant_2() {
        // invariant 2: after write, trace, affected behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let p = "u-test-invariant-001".to_string();
        let h = "u-test-invariant-002".to_string();
        let s = "u-test-invariant-003".to_string();
        let o = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // write(path: "src/password.ts", content: "export const x = 1;", formatHint: "typescript", sources: [{ sourcePath: "./specs/password.concept" }]) -> ok(written: true, path: p, contentHash: h)
        let step1 = handler.write(
            WriteInput { path: "src/password.ts".to_string(), content: "export const x = 1;".to_string(), format_hint: "typescript".to_string(), sources: todo!(/* list: [todo!(/* record: { "sourcePath": "./specs/password.concept".to_string() } */)] */) },
            &storage,
        ).await.unwrap();
        match step1 {
            WriteOutput::Ok { written, path, content_hash, .. } => {
                assert_eq!(written, true);
                assert_eq!(path, p.clone());
                assert_eq!(content_hash, h.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // trace(outputPath: "src/password.ts") -> ok(sources: s)
        let step2 = handler.trace(
            TraceInput { output_path: "src/password.ts".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            TraceOutput::Ok { sources, .. } => {
                assert_eq!(sources, s.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // affected(sourcePath: "./specs/password.concept") -> ok(outputs: o)
        let step3 = handler.affected(
            AffectedInput { source_path: "./specs/password.concept".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            AffectedOutput::Ok { outputs, .. } => {
                assert_eq!(outputs, o.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}

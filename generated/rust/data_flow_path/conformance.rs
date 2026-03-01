// generated: data_flow_path/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::DataFlowPathHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn data_flow_path_invariant_1() {
        // invariant 1: after trace, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let p = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // trace(source: "config/db-url", sink: "ts/function/connect") -> ok(paths: p)
        let step1 = handler.trace(
            TraceInput { source: "config/db-url".to_string(), sink: "ts/function/connect".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            TraceOutput::Ok { paths, .. } => {
                assert_eq!(paths, p.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(path: _) -> ok(path: _, sourceSymbol: "config/db-url", sinkSymbol: "ts/function/connect", pathKind: "config-propagation", stepCount: _)
        let step2 = handler.get(
            GetInput { path: .clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { path, source_symbol, sink_symbol, path_kind, step_count, .. } => {
                assert_eq!(path, .clone());
                assert_eq!(source_symbol, "config/db-url".to_string());
                assert_eq!(sink_symbol, "ts/function/connect".to_string());
                assert_eq!(path_kind, "config-propagation".to_string());
                assert_eq!(step_count, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}

// generated: view/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ViewHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn view_invariant_1() {
        // invariant 1: after create, setFilter behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let v = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // create(view: v, dataSource: "tasks", layout: "table") -> ok(view: v)
        let step1 = handler.create(
            CreateInput { view: v.clone(), data_source: "tasks".to_string(), layout: "table".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CreateOutput::Ok { view, .. } => {
                assert_eq!(view, v.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // setFilter(view: v, filter: "status=active") -> ok(view: v)
        let step2 = handler.set_filter(
            SetFilterInput { view: v.clone(), filter: "status=active".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            SetFilterOutput::Ok { view, .. } => {
                assert_eq!(view, v.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn view_invariant_2() {
        // invariant 2: after setFilter, changeLayout behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let v = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // setFilter(view: v, filter: "status=active") -> ok(view: v)
        let step1 = handler.set_filter(
            SetFilterInput { view: v.clone(), filter: "status=active".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            SetFilterOutput::Ok { view, .. } => {
                assert_eq!(view, v.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // changeLayout(view: v, layout: "board") -> ok(view: v)
        let step2 = handler.change_layout(
            ChangeLayoutInput { view: v.clone(), layout: "board".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ChangeLayoutOutput::Ok { view, .. } => {
                assert_eq!(view, v.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}

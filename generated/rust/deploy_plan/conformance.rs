// generated: deploy_plan/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::DeployPlanHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn deploy_plan_invariant_1() {
        // invariant 1: after plan, validate, execute behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let p = "u-test-invariant-001".to_string();
        let g = "u-test-invariant-002".to_string();
        let w = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // plan(manifest: "valid-manifest", environment: "staging") -> ok(plan: p, graph: g, estimatedDuration: 300)
        let step1 = handler.plan(
            PlanInput { manifest: "valid-manifest".to_string(), environment: "staging".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            PlanOutput::Ok { plan, graph, estimated_duration, .. } => {
                assert_eq!(plan, p.clone());
                assert_eq!(graph, g.clone());
                assert_eq!(estimated_duration, 300);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // validate(plan: p) -> ok(plan: p, warnings: w)
        let step2 = handler.validate(
            ValidateInput { plan: p.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            ValidateOutput::Ok { plan, warnings, .. } => {
                assert_eq!(plan, p.clone());
                assert_eq!(warnings, w.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // execute(plan: p) -> ok(plan: p, duration: 120, nodesDeployed: 5)
        let step3 = handler.execute(
            ExecuteInput { plan: p.clone() },
            &storage,
        ).await.unwrap();
        match step3 {
            ExecuteOutput::Ok { plan, duration, nodes_deployed, .. } => {
                assert_eq!(plan, p.clone());
                assert_eq!(duration, 120);
                assert_eq!(nodes_deployed, 5);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}

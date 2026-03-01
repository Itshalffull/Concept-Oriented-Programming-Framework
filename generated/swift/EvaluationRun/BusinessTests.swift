// generated: EvaluationRun/BusinessTests.swift

import XCTest
@testable import Clef

final class EvaluationRunBusinessTests: XCTestCase {

    // MARK: - Pass at threshold boundary

    func testPassAtExactThreshold() async throws {
        // Passing with a score exactly at the threshold should succeed
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let evalInput = Data("{\"output\":\"test output\"}".utf8)

        let step1 = try await handler.runEval(
            input: EvaluationRunRunEvalInput(
                stepRef: "step-threshold",
                evaluatorType: "llm_judge",
                input: evalInput,
                threshold: 0.75
            ),
            storage: storage
        )
        guard case .ok(let eval, _, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.pass(
            input: EvaluationRunPassInput(
                eval: eval,
                score: 0.75,
                feedback: "Meets minimum threshold exactly"
            ),
            storage: storage
        )
        if case .ok(let passedEval, _) = step2 {
            XCTAssertEqual(passedEval, eval)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        let step3 = try await handler.getResult(
            input: EvaluationRunGetResultInput(eval: eval),
            storage: storage
        )
        if case .ok(_, let status, let score, _) = step3 {
            XCTAssertEqual(status, "passed")
            XCTAssertEqual(score, 0.75, accuracy: 0.001)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    // MARK: - Multiple metrics logged for same eval

    func testMultipleMetricsLoggedForSameEval() async throws {
        // Multiple metrics can be logged for a single evaluation run
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let evalInput = Data("{\"output\":\"multi-metric test\"}".utf8)

        let step1 = try await handler.runEval(
            input: EvaluationRunRunEvalInput(
                stepRef: "step-multi-metric",
                evaluatorType: "custom",
                input: evalInput,
                threshold: 0.5
            ),
            storage: storage
        )
        guard case .ok(let eval, _, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let metrics: [(String, Double)] = [
            ("accuracy", 0.95),
            ("latency_ms", 150.0),
            ("token_count", 500.0),
            ("confidence", 0.88)
        ]

        for (name, value) in metrics {
            let result = try await handler.logMetric(
                input: EvaluationRunLogMetricInput(eval: eval, metricName: name, metricValue: value),
                storage: storage
            )
            if case .ok(let metricEval) = result {
                XCTAssertEqual(metricEval, eval)
            } else {
                XCTFail("Expected .ok for metric \(name), got \(result)")
            }
        }
    }

    // MARK: - Fail with low score

    func testFailWithLowScore() async throws {
        // Failing with a score well below threshold
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let evalInput = Data("{\"output\":\"poor quality\"}".utf8)

        let step1 = try await handler.runEval(
            input: EvaluationRunRunEvalInput(
                stepRef: "step-low-score",
                evaluatorType: "schema",
                input: evalInput,
                threshold: 0.8
            ),
            storage: storage
        )
        guard case .ok(let eval, _, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.fail(
            input: EvaluationRunFailInput(
                eval: eval,
                score: 0.1,
                feedback: "Output completely missed the expected structure"
            ),
            storage: storage
        )
        if case .failed(let failedEval, _, let feedback) = step2 {
            XCTAssertEqual(failedEval, eval)
            XCTAssertFalse(feedback.isEmpty)
        } else {
            XCTFail("Expected .failed, got \(step2)")
        }

        let step3 = try await handler.getResult(
            input: EvaluationRunGetResultInput(eval: eval),
            storage: storage
        )
        if case .ok(_, let status, let score, _) = step3 {
            XCTAssertEqual(status, "failed")
            XCTAssertEqual(score, 0.1, accuracy: 0.001)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    // MARK: - Multiple evaluations are isolated

    func testMultipleEvaluationsAreIsolated() async throws {
        // Passing one evaluation should not affect another
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let r1 = try await handler.runEval(
            input: EvaluationRunRunEvalInput(
                stepRef: "step-iso-a",
                evaluatorType: "llm_judge",
                input: Data("{\"a\":true}".utf8),
                threshold: 0.5
            ),
            storage: storage
        )
        guard case .ok(let evalA, _, _) = r1 else { XCTFail("Expected .ok"); return }

        let r2 = try await handler.runEval(
            input: EvaluationRunRunEvalInput(
                stepRef: "step-iso-b",
                evaluatorType: "llm_judge",
                input: Data("{\"b\":true}".utf8),
                threshold: 0.5
            ),
            storage: storage
        )
        guard case .ok(let evalB, _, _) = r2 else { XCTFail("Expected .ok"); return }

        XCTAssertNotEqual(evalA, evalB)

        let _ = try await handler.pass(
            input: EvaluationRunPassInput(eval: evalA, score: 0.9, feedback: "Good"),
            storage: storage
        )
        let _ = try await handler.fail(
            input: EvaluationRunFailInput(eval: evalB, score: 0.2, feedback: "Bad"),
            storage: storage
        )

        let getA = try await handler.getResult(input: EvaluationRunGetResultInput(eval: evalA), storage: storage)
        if case .ok(_, let status, _, _) = getA {
            XCTAssertEqual(status, "passed")
        } else {
            XCTFail("Expected .ok, got \(getA)")
        }

        let getB = try await handler.getResult(input: EvaluationRunGetResultInput(eval: evalB), storage: storage)
        if case .ok(_, let status, _, _) = getB {
            XCTAssertEqual(status, "failed")
        } else {
            XCTFail("Expected .ok, got \(getB)")
        }
    }

    // MARK: - Different evaluator types

    func testDifferentEvaluatorTypes() async throws {
        // Different evaluator types should all be supported
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let evaluatorTypes = ["llm_judge", "schema", "custom", "regex", "semantic"]
        for (i, evalType) in evaluatorTypes.enumerated() {
            let result = try await handler.runEval(
                input: EvaluationRunRunEvalInput(
                    stepRef: "step-eval-\(i)",
                    evaluatorType: evalType,
                    input: Data("{\"test\":\(i)}".utf8),
                    threshold: 0.5
                ),
                storage: storage
            )
            if case .ok(let eval, _, let returnedType) = result {
                XCTAssertFalse(eval.isEmpty)
                XCTAssertEqual(returnedType, evalType)
            } else {
                XCTFail("Expected .ok for evaluator type \(evalType), got \(result)")
            }
        }
    }

    // MARK: - Log metric then pass

    func testLogMetricThenPass() async throws {
        // Logging metrics and then passing should both work on the same evaluation
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let evalInput = Data("{\"output\":\"metric then pass\"}".utf8)

        let step1 = try await handler.runEval(
            input: EvaluationRunRunEvalInput(
                stepRef: "step-metric-pass",
                evaluatorType: "custom",
                input: evalInput,
                threshold: 0.6
            ),
            storage: storage
        )
        guard case .ok(let eval, _, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let _ = try await handler.logMetric(
            input: EvaluationRunLogMetricInput(eval: eval, metricName: "processing_time", metricValue: 250.0),
            storage: storage
        )

        let step3 = try await handler.pass(
            input: EvaluationRunPassInput(eval: eval, score: 0.85, feedback: "Quality meets standards"),
            storage: storage
        )
        if case .ok(let passedEval, _) = step3 {
            XCTAssertEqual(passedEval, eval)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    // MARK: - Perfect score

    func testPerfectScore() async throws {
        // A perfect score of 1.0 should be accepted
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let evalInput = Data("{\"output\":\"perfect\"}".utf8)

        let step1 = try await handler.runEval(
            input: EvaluationRunRunEvalInput(
                stepRef: "step-perfect",
                evaluatorType: "llm_judge",
                input: evalInput,
                threshold: 0.99
            ),
            storage: storage
        )
        guard case .ok(let eval, _, _) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }

        let step2 = try await handler.pass(
            input: EvaluationRunPassInput(eval: eval, score: 1.0, feedback: "Flawless output"),
            storage: storage
        )
        if case .ok(let passedEval, _) = step2 {
            XCTAssertEqual(passedEval, eval)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        let step3 = try await handler.getResult(
            input: EvaluationRunGetResultInput(eval: eval),
            storage: storage
        )
        if case .ok(_, _, let score, _) = step3 {
            XCTAssertEqual(score, 1.0, accuracy: 0.001)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    // MARK: - Unique eval IDs

    func testEachRunEvalReturnsUniqueId() async throws {
        // Each runEval should produce a unique evaluation ID
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        var ids: Set<String> = []
        for i in 1...6 {
            let result = try await handler.runEval(
                input: EvaluationRunRunEvalInput(
                    stepRef: "step-uniq-\(i)",
                    evaluatorType: "custom",
                    input: Data("{\"\(i)\":true}".utf8),
                    threshold: 0.5
                ),
                storage: storage
            )
            guard case .ok(let eval, _, _) = result else {
                XCTFail("Expected .ok, got \(result)")
                return
            }
            ids.insert(eval)
        }
        XCTAssertEqual(ids.count, 6, "All 6 eval IDs should be unique")
    }

}

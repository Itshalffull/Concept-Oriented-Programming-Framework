// generated: EvaluationRun/ConformanceTests.swift

import XCTest
@testable import Clef

final class EvaluationRunConformanceTests: XCTestCase {

    func testEvaluationRunRunEvalAndPass() async throws {
        // invariant: after runEval and pass, getResult returns status "passed" with score
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let evalInput = Data("{\"output\":\"The document discusses...\"}".utf8)

        // --- AFTER clause ---
        let step1 = try await handler.runEval(
            input: EvaluationRunRunEvalInput(
                stepRef: "step-summarize",
                evaluatorType: "llm_judge",
                input: evalInput,
                threshold: 0.8
            ),
            storage: storage
        )
        guard case .ok(let eval, let stepRef, let evaluatorType) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }
        XCTAssertFalse(eval.isEmpty)
        XCTAssertEqual(stepRef, "step-summarize")
        XCTAssertEqual(evaluatorType, "llm_judge")

        let step2 = try await handler.pass(
            input: EvaluationRunPassInput(
                eval: eval,
                score: 0.92,
                feedback: "Summary is accurate and comprehensive"
            ),
            storage: storage
        )
        if case .ok(let passedEval, let passedStepRef) = step2 {
            XCTAssertEqual(passedEval, eval)
            XCTAssertEqual(passedStepRef, "step-summarize")
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }

        // --- THEN clause ---
        let step3 = try await handler.getResult(
            input: EvaluationRunGetResultInput(eval: eval),
            storage: storage
        )
        if case .ok(_, let status, let score, _) = step3 {
            XCTAssertEqual(status, "passed")
            XCTAssertEqual(score, 0.92, accuracy: 0.001)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    func testEvaluationRunRunEvalAndFail() async throws {
        // invariant: after runEval and fail, getResult returns status "failed" with feedback
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let evalInput = Data("{\"output\":\"bad output\"}".utf8)

        let step1 = try await handler.runEval(
            input: EvaluationRunRunEvalInput(
                stepRef: "step-format",
                evaluatorType: "schema",
                input: evalInput,
                threshold: 0.9
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
                score: 0.3,
                feedback: "Output does not match expected JSON schema"
            ),
            storage: storage
        )
        if case .failed(let failedEval, let failedStepRef, let feedback) = step2 {
            XCTAssertEqual(failedEval, eval)
            XCTAssertEqual(failedStepRef, "step-format")
            XCTAssertFalse(feedback.isEmpty)
        } else {
            XCTFail("Expected .failed, got \(step2)")
        }

        // --- THEN clause ---
        let step3 = try await handler.getResult(
            input: EvaluationRunGetResultInput(eval: eval),
            storage: storage
        )
        if case .ok(_, let status, let score, _) = step3 {
            XCTAssertEqual(status, "failed")
            XCTAssertEqual(score, 0.3, accuracy: 0.001)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    func testEvaluationRunLogMetric() async throws {
        // invariant: logMetric records a metric data point for the evaluation
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let evalInput = Data("{\"output\":\"test\"}".utf8)

        let step1 = try await handler.runEval(
            input: EvaluationRunRunEvalInput(
                stepRef: "step-perf",
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

        // --- THEN clause ---
        let step2 = try await handler.logMetric(
            input: EvaluationRunLogMetricInput(
                eval: eval,
                metricName: "latency_ms",
                metricValue: 42.5
            ),
            storage: storage
        )
        if case .ok(let metricEval) = step2 {
            XCTAssertEqual(metricEval, eval)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testEvaluationRunGetResultNotFound() async throws {
        // invariant: getResult with unknown eval returns notFound
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let step1 = try await handler.getResult(
            input: EvaluationRunGetResultInput(eval: "nonexistent-eval"),
            storage: storage
        )
        if case .notFound(let eval) = step1 {
            XCTAssertEqual(eval, "nonexistent-eval")
        } else {
            XCTFail("Expected .notFound, got \(step1)")
        }
    }

}

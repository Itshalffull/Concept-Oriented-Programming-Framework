// generated: ProcessMetric/ConformanceTests.swift

import XCTest
@testable import Clef

final class ProcessMetricConformanceTests: XCTestCase {

    func testProcessMetricRecordAndQuery() async throws {
        // invariant: after record, query returns the recorded metric within the time range
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let dimensions = Data("{\"step\":\"validate\",\"run\":\"run-001\"}".utf8)

        // --- AFTER clause ---
        let step1 = try await handler.record(
            input: ProcessMetricRecordInput(
                metricName: "step.duration_ms",
                metricValue: 1500.0,
                dimensions: dimensions
            ),
            storage: storage
        )
        guard case .ok(let metric) = step1 else {
            XCTFail("Expected .ok, got \(step1)")
            return
        }
        XCTAssertFalse(metric.isEmpty)

        // --- THEN clause ---
        let step2 = try await handler.query(
            input: ProcessMetricQueryInput(
                metricName: "step.duration_ms",
                from: "2026-01-01T00:00:00Z",
                to: "2026-12-31T23:59:59Z"
            ),
            storage: storage
        )
        if case .ok(let metrics, let count) = step2 {
            XCTAssertFalse(metrics.isEmpty)
            XCTAssertGreaterThanOrEqual(count, 1)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    func testProcessMetricAggregate() async throws {
        // invariant: aggregate computes the requested aggregation over recorded metrics
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let dimensions = Data("{\"step\":\"process\"}".utf8)

        // --- AFTER clause ---
        let _ = try await handler.record(
            input: ProcessMetricRecordInput(
                metricName: "step.latency_ms",
                metricValue: 100.0,
                dimensions: dimensions
            ),
            storage: storage
        )
        let _ = try await handler.record(
            input: ProcessMetricRecordInput(
                metricName: "step.latency_ms",
                metricValue: 200.0,
                dimensions: dimensions
            ),
            storage: storage
        )
        let _ = try await handler.record(
            input: ProcessMetricRecordInput(
                metricName: "step.latency_ms",
                metricValue: 300.0,
                dimensions: dimensions
            ),
            storage: storage
        )

        // --- THEN clause ---
        let step4 = try await handler.aggregate(
            input: ProcessMetricAggregateInput(
                metricName: "step.latency_ms",
                aggregation: "avg",
                from: "2026-01-01T00:00:00Z",
                to: "2026-12-31T23:59:59Z"
            ),
            storage: storage
        )
        if case .ok(let value, let sampleCount) = step4 {
            XCTAssertEqual(value, 200.0, accuracy: 0.01)
            XCTAssertEqual(sampleCount, 3)
        } else {
            XCTFail("Expected .ok, got \(step4)")
        }
    }

    func testProcessMetricAggregateSum() async throws {
        // invariant: aggregate with sum returns the total of all metric values
        let storage = createInMemoryStorage()
        let handler = createTestHandler() // provided by implementor

        let dimensions = Data("{\"run\":\"run-sum\"}".utf8)

        let _ = try await handler.record(
            input: ProcessMetricRecordInput(
                metricName: "step.retry_count",
                metricValue: 2.0,
                dimensions: dimensions
            ),
            storage: storage
        )
        let _ = try await handler.record(
            input: ProcessMetricRecordInput(
                metricName: "step.retry_count",
                metricValue: 3.0,
                dimensions: dimensions
            ),
            storage: storage
        )

        // --- THEN clause ---
        let step3 = try await handler.aggregate(
            input: ProcessMetricAggregateInput(
                metricName: "step.retry_count",
                aggregation: "sum",
                from: "2026-01-01T00:00:00Z",
                to: "2026-12-31T23:59:59Z"
            ),
            storage: storage
        )
        if case .ok(let value, let sampleCount) = step3 {
            XCTAssertEqual(value, 5.0, accuracy: 0.01)
            XCTAssertEqual(sampleCount, 2)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

}

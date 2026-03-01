// generated: ProcessMetric/BusinessTests.swift

import XCTest
@testable import Clef

final class ProcessMetricBusinessTests: XCTestCase {

    // MARK: - Multiple records for same metric

    func testMultipleRecordsForSameMetric() async throws {
        // Recording the same metric name multiple times should accumulate data points
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let dimensions = Data("{\"step\":\"validate\"}".utf8)

        for value in [100.0, 200.0, 300.0, 400.0, 500.0] {
            let result = try await handler.record(
                input: ProcessMetricRecordInput(
                    metricName: "step.exec_time_ms",
                    metricValue: value,
                    dimensions: dimensions
                ),
                storage: storage
            )
            if case .ok(let metric) = result {
                XCTAssertFalse(metric.isEmpty)
            } else {
                XCTFail("Expected .ok, got \(result)")
            }
        }

        let step6 = try await handler.query(
            input: ProcessMetricQueryInput(
                metricName: "step.exec_time_ms",
                from: "2026-01-01T00:00:00Z",
                to: "2026-12-31T23:59:59Z"
            ),
            storage: storage
        )
        if case .ok(let metrics, let count) = step6 {
            XCTAssertGreaterThanOrEqual(count, 5)
            XCTAssertFalse(metrics.isEmpty)
        } else {
            XCTFail("Expected .ok, got \(step6)")
        }
    }

    // MARK: - Aggregate min

    func testAggregateMin() async throws {
        // Aggregate with "min" should return the minimum value
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let dimensions = Data("{\"type\":\"min-test\"}".utf8)

        let values = [50.0, 10.0, 75.0, 30.0]
        for value in values {
            let _ = try await handler.record(
                input: ProcessMetricRecordInput(
                    metricName: "step.response_time",
                    metricValue: value,
                    dimensions: dimensions
                ),
                storage: storage
            )
        }

        let step5 = try await handler.aggregate(
            input: ProcessMetricAggregateInput(
                metricName: "step.response_time",
                aggregation: "min",
                from: "2026-01-01T00:00:00Z",
                to: "2026-12-31T23:59:59Z"
            ),
            storage: storage
        )
        if case .ok(let value, let sampleCount) = step5 {
            XCTAssertEqual(value, 10.0, accuracy: 0.01)
            XCTAssertEqual(sampleCount, 4)
        } else {
            XCTFail("Expected .ok, got \(step5)")
        }
    }

    // MARK: - Aggregate max

    func testAggregateMax() async throws {
        // Aggregate with "max" should return the maximum value
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let dimensions = Data("{\"type\":\"max-test\"}".utf8)

        let values = [10.0, 90.0, 45.0, 60.0]
        for value in values {
            let _ = try await handler.record(
                input: ProcessMetricRecordInput(
                    metricName: "step.peak_memory_mb",
                    metricValue: value,
                    dimensions: dimensions
                ),
                storage: storage
            )
        }

        let step5 = try await handler.aggregate(
            input: ProcessMetricAggregateInput(
                metricName: "step.peak_memory_mb",
                aggregation: "max",
                from: "2026-01-01T00:00:00Z",
                to: "2026-12-31T23:59:59Z"
            ),
            storage: storage
        )
        if case .ok(let value, let sampleCount) = step5 {
            XCTAssertEqual(value, 90.0, accuracy: 0.01)
            XCTAssertEqual(sampleCount, 4)
        } else {
            XCTFail("Expected .ok, got \(step5)")
        }
    }

    // MARK: - Different metric names are isolated

    func testDifferentMetricNamesAreIsolated() async throws {
        // Metrics with different names should not interfere in queries
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let dimensions = Data("{\"source\":\"test\"}".utf8)

        let _ = try await handler.record(
            input: ProcessMetricRecordInput(metricName: "metric.alpha", metricValue: 100.0, dimensions: dimensions),
            storage: storage
        )
        let _ = try await handler.record(
            input: ProcessMetricRecordInput(metricName: "metric.alpha", metricValue: 200.0, dimensions: dimensions),
            storage: storage
        )
        let _ = try await handler.record(
            input: ProcessMetricRecordInput(metricName: "metric.beta", metricValue: 999.0, dimensions: dimensions),
            storage: storage
        )

        let queryAlpha = try await handler.query(
            input: ProcessMetricQueryInput(
                metricName: "metric.alpha",
                from: "2026-01-01T00:00:00Z",
                to: "2026-12-31T23:59:59Z"
            ),
            storage: storage
        )
        if case .ok(_, let count) = queryAlpha {
            XCTAssertEqual(count, 2)
        } else {
            XCTFail("Expected .ok, got \(queryAlpha)")
        }

        let queryBeta = try await handler.query(
            input: ProcessMetricQueryInput(
                metricName: "metric.beta",
                from: "2026-01-01T00:00:00Z",
                to: "2026-12-31T23:59:59Z"
            ),
            storage: storage
        )
        if case .ok(_, let count) = queryBeta {
            XCTAssertEqual(count, 1)
        } else {
            XCTFail("Expected .ok, got \(queryBeta)")
        }
    }

    // MARK: - Query with no data returns empty

    func testQueryWithNoDataReturnsEmpty() async throws {
        // Querying a metric that was never recorded should return empty
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let step1 = try await handler.query(
            input: ProcessMetricQueryInput(
                metricName: "nonexistent.metric",
                from: "2026-01-01T00:00:00Z",
                to: "2026-12-31T23:59:59Z"
            ),
            storage: storage
        )
        if case .ok(let metrics, let count) = step1 {
            XCTAssertTrue(metrics.isEmpty)
            XCTAssertEqual(count, 0)
        } else {
            XCTFail("Expected .ok, got \(step1)")
        }
    }

    // MARK: - Record with various dimensions

    func testRecordWithVariousDimensions() async throws {
        // Metrics with different dimensions should all be recorded
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let dims1 = Data("{\"step\":\"validate\",\"run\":\"r1\"}".utf8)
        let dims2 = Data("{\"step\":\"transform\",\"run\":\"r2\",\"region\":\"us-east\"}".utf8)
        let dims3 = Data("{}".utf8)

        let r1 = try await handler.record(
            input: ProcessMetricRecordInput(metricName: "step.count", metricValue: 1.0, dimensions: dims1),
            storage: storage
        )
        if case .ok(let m) = r1 { XCTAssertFalse(m.isEmpty) } else { XCTFail("Expected .ok") }

        let r2 = try await handler.record(
            input: ProcessMetricRecordInput(metricName: "step.count", metricValue: 2.0, dimensions: dims2),
            storage: storage
        )
        if case .ok(let m) = r2 { XCTAssertFalse(m.isEmpty) } else { XCTFail("Expected .ok") }

        let r3 = try await handler.record(
            input: ProcessMetricRecordInput(metricName: "step.count", metricValue: 3.0, dimensions: dims3),
            storage: storage
        )
        if case .ok(let m) = r3 { XCTAssertFalse(m.isEmpty) } else { XCTFail("Expected .ok") }

        let query = try await handler.query(
            input: ProcessMetricQueryInput(
                metricName: "step.count",
                from: "2026-01-01T00:00:00Z",
                to: "2026-12-31T23:59:59Z"
            ),
            storage: storage
        )
        if case .ok(_, let count) = query {
            XCTAssertGreaterThanOrEqual(count, 3)
        } else {
            XCTFail("Expected .ok, got \(query)")
        }
    }

    // MARK: - Aggregate with single data point

    func testAggregateWithSingleDataPoint() async throws {
        // Aggregating a single data point should return that value
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let dimensions = Data("{\"solo\":true}".utf8)

        let _ = try await handler.record(
            input: ProcessMetricRecordInput(
                metricName: "solo.metric",
                metricValue: 42.0,
                dimensions: dimensions
            ),
            storage: storage
        )

        let step2 = try await handler.aggregate(
            input: ProcessMetricAggregateInput(
                metricName: "solo.metric",
                aggregation: "avg",
                from: "2026-01-01T00:00:00Z",
                to: "2026-12-31T23:59:59Z"
            ),
            storage: storage
        )
        if case .ok(let value, let sampleCount) = step2 {
            XCTAssertEqual(value, 42.0, accuracy: 0.01)
            XCTAssertEqual(sampleCount, 1)
        } else {
            XCTFail("Expected .ok, got \(step2)")
        }
    }

    // MARK: - Zero values

    func testRecordAndAggregateZeroValues() async throws {
        // Recording zero values should be handled correctly
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let dimensions = Data("{\"zero\":true}".utf8)

        let _ = try await handler.record(
            input: ProcessMetricRecordInput(metricName: "zero.metric", metricValue: 0.0, dimensions: dimensions),
            storage: storage
        )
        let _ = try await handler.record(
            input: ProcessMetricRecordInput(metricName: "zero.metric", metricValue: 0.0, dimensions: dimensions),
            storage: storage
        )

        let step3 = try await handler.aggregate(
            input: ProcessMetricAggregateInput(
                metricName: "zero.metric",
                aggregation: "sum",
                from: "2026-01-01T00:00:00Z",
                to: "2026-12-31T23:59:59Z"
            ),
            storage: storage
        )
        if case .ok(let value, let sampleCount) = step3 {
            XCTAssertEqual(value, 0.0, accuracy: 0.01)
            XCTAssertEqual(sampleCount, 2)
        } else {
            XCTFail("Expected .ok, got \(step3)")
        }
    }

    // MARK: - Unique metric IDs

    func testEachRecordReturnsUniqueMetricId() async throws {
        // Each record call should produce a unique metric ID
        let storage = createInMemoryStorage()
        let handler = createTestHandler()

        let dimensions = Data("{\"test\":\"unique\"}".utf8)
        var ids: Set<String> = []

        for i in 1...6 {
            let result = try await handler.record(
                input: ProcessMetricRecordInput(
                    metricName: "unique.metric",
                    metricValue: Double(i),
                    dimensions: dimensions
                ),
                storage: storage
            )
            guard case .ok(let metric) = result else {
                XCTFail("Expected .ok, got \(result)")
                return
            }
            ids.insert(metric)
        }
        XCTAssertEqual(ids.count, 6, "All 6 metric IDs should be unique")
    }

}

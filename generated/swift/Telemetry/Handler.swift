// generated: Telemetry/Handler.swift

import Foundation

protocol TelemetryHandler {
    func export(
        input: TelemetryExportInput,
        storage: ConceptStorage
    ) async throws -> TelemetryExportOutput

    func configure(
        input: TelemetryConfigureInput,
        storage: ConceptStorage
    ) async throws -> TelemetryConfigureOutput

}

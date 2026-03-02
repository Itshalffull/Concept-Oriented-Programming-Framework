// generated: ViewportProvider/Handler.swift

import Foundation

protocol ViewportProviderHandler {
    func initialize(
        input: ViewportProviderInitializeInput,
        storage: ConceptStorage
    ) async throws -> ViewportProviderInitializeOutput

    func observe(
        input: ViewportProviderObserveInput,
        storage: ConceptStorage
    ) async throws -> ViewportProviderObserveOutput

    func getBreakpoint(
        input: ViewportProviderGetBreakpointInput,
        storage: ConceptStorage
    ) async throws -> ViewportProviderGetBreakpointOutput

    func setBreakpoints(
        input: ViewportProviderSetBreakpointsInput,
        storage: ConceptStorage
    ) async throws -> ViewportProviderSetBreakpointsOutput

}

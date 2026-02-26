// generated: DisplayMode/Handler.swift

import Foundation

protocol DisplayModeHandler {
    func defineMode(
        input: DisplayModeDefineModeInput,
        storage: ConceptStorage
    ) async throws -> DisplayModeDefineModeOutput

    func configureFieldDisplay(
        input: DisplayModeConfigureFieldDisplayInput,
        storage: ConceptStorage
    ) async throws -> DisplayModeConfigureFieldDisplayOutput

    func configureFieldForm(
        input: DisplayModeConfigureFieldFormInput,
        storage: ConceptStorage
    ) async throws -> DisplayModeConfigureFieldFormOutput

    func renderInMode(
        input: DisplayModeRenderInModeInput,
        storage: ConceptStorage
    ) async throws -> DisplayModeRenderInModeOutput

}

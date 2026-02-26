// generated: Backlink/Handler.swift

import Foundation

protocol BacklinkHandler {
    func getBacklinks(
        input: BacklinkGetBacklinksInput,
        storage: ConceptStorage
    ) async throws -> BacklinkGetBacklinksOutput

    func getUnlinkedMentions(
        input: BacklinkGetUnlinkedMentionsInput,
        storage: ConceptStorage
    ) async throws -> BacklinkGetUnlinkedMentionsOutput

    func reindex(
        input: BacklinkReindexInput,
        storage: ConceptStorage
    ) async throws -> BacklinkReindexOutput

}

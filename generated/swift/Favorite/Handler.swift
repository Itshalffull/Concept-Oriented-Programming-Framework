// generated: Favorite/Handler.swift

import Foundation

protocol FavoriteHandler {
    func favorite(
        input: FavoriteFavoriteInput,
        storage: ConceptStorage
    ) async throws -> FavoriteFavoriteOutput

    func unfavorite(
        input: FavoriteUnfavoriteInput,
        storage: ConceptStorage
    ) async throws -> FavoriteUnfavoriteOutput

    func isFavorited(
        input: FavoriteIsFavoritedInput,
        storage: ConceptStorage
    ) async throws -> FavoriteIsFavoritedOutput

    func count(
        input: FavoriteCountInput,
        storage: ConceptStorage
    ) async throws -> FavoriteCountOutput

}

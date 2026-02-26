// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Favorite
/// @notice Concept-oriented favoriting system for articles
/// @dev Implements the Favorite concept from Clef specification.
///      Tracks per-user favorites and per-article favorite counts.

contract Favorite {
    // --- Storage ---

    /// @dev Maps user => article => whether it is favorited
    mapping(bytes32 => mapping(bytes32 => bool)) private _favorites;

    /// @dev Maps user => list of favorited article IDs
    mapping(bytes32 => bytes32[]) private _userFavorites;

    /// @dev Maps user => article => index in _userFavorites (for removal)
    mapping(bytes32 => mapping(bytes32 => uint256)) private _userFavoriteIndex;

    /// @dev Maps article => total number of favorites
    mapping(bytes32 => uint256) private _articleFavoriteCount;

    // --- Events ---

    event Favorited(bytes32 indexed user, bytes32 indexed article);
    event Unfavorited(bytes32 indexed user, bytes32 indexed article);

    // --- Actions ---

    /// @notice Mark an article as favorited by a user
    /// @param user The user ID
    /// @param article The article ID
    function favorite(bytes32 user, bytes32 article) external {
        require(user != bytes32(0), "User cannot be zero");
        require(article != bytes32(0), "Article cannot be zero");
        require(!_favorites[user][article], "Already favorited");

        _favorites[user][article] = true;
        _userFavoriteIndex[user][article] = _userFavorites[user].length;
        _userFavorites[user].push(article);
        _articleFavoriteCount[article]++;

        emit Favorited(user, article);
    }

    /// @notice Remove an article from a user's favorites
    /// @param user The user ID
    /// @param article The article ID
    function unfavorite(bytes32 user, bytes32 article) external {
        require(_favorites[user][article], "Not favorited");

        _favorites[user][article] = false;

        // Swap-and-pop from user's favorites list
        uint256 index = _userFavoriteIndex[user][article];
        uint256 lastIndex = _userFavorites[user].length - 1;

        if (index != lastIndex) {
            bytes32 lastArticle = _userFavorites[user][lastIndex];
            _userFavorites[user][index] = lastArticle;
            _userFavoriteIndex[user][lastArticle] = index;
        }

        _userFavorites[user].pop();
        delete _userFavoriteIndex[user][article];
        _articleFavoriteCount[article]--;

        emit Unfavorited(user, article);
    }

    /// @notice Check if a user has favorited an article
    /// @param user The user ID
    /// @param article The article ID
    /// @return Whether the article is favorited by the user
    function isFavorited(bytes32 user, bytes32 article) external view returns (bool) {
        return _favorites[user][article];
    }

    /// @notice Get the total number of favorites for an article
    /// @param article The article ID
    /// @return The number of users who have favorited this article
    function count(bytes32 article) external view returns (uint256) {
        return _articleFavoriteCount[article];
    }

    /// @notice Get all articles favorited by a user
    /// @param user The user ID
    /// @return Array of article IDs
    function getUserFavorites(bytes32 user) external view returns (bytes32[] memory) {
        return _userFavorites[user];
    }
}

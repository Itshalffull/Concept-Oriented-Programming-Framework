// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Tag
/// @notice Concept-oriented tag management for articles
/// @dev Implements the Tag concept from COPF specification.
///      Tags are identified by bytes32 and associated with articles.

contract Tag {
    // --- Storage ---

    /// @dev Maps tag => article => whether that article is tagged
    mapping(bytes32 => mapping(bytes32 => bool)) private _tagArticles;

    /// @dev Maps tag => list of article IDs tagged with it
    mapping(bytes32 => bytes32[]) private _tagArticleKeys;

    /// @dev Maps tag => article => index in _tagArticleKeys (for removal)
    mapping(bytes32 => mapping(bytes32 => uint256)) private _tagArticleIndex;

    /// @dev Whether a tag has been used at least once
    mapping(bytes32 => bool) private _tagExists;

    /// @dev All known tags
    bytes32[] private _allTags;

    // --- Events ---

    event TagAdded(bytes32 indexed tag, bytes32 indexed article);
    event TagRemoved(bytes32 indexed tag, bytes32 indexed article);

    // --- Actions ---

    /// @notice Add a tag to an article
    /// @param tag The tag identifier
    /// @param article The article identifier
    function add(bytes32 tag, bytes32 article) external {
        require(tag != bytes32(0), "Tag cannot be zero");
        require(article != bytes32(0), "Article cannot be zero");
        require(!_tagArticles[tag][article], "Article already tagged");

        // If this is a new tag, add it to the global list
        if (!_tagExists[tag]) {
            _tagExists[tag] = true;
            _allTags.push(tag);
        }

        // Add the article to this tag's list
        _tagArticles[tag][article] = true;
        _tagArticleIndex[tag][article] = _tagArticleKeys[tag].length;
        _tagArticleKeys[tag].push(article);

        emit TagAdded(tag, article);
    }

    /// @notice Remove a tag from an article
    /// @param tag The tag identifier
    /// @param article The article identifier
    function remove(bytes32 tag, bytes32 article) external {
        require(_tagArticles[tag][article], "Article not tagged with this tag");

        // Swap-and-pop from the tag's article list
        uint256 index = _tagArticleIndex[tag][article];
        uint256 lastIndex = _tagArticleKeys[tag].length - 1;

        if (index != lastIndex) {
            bytes32 lastArticle = _tagArticleKeys[tag][lastIndex];
            _tagArticleKeys[tag][index] = lastArticle;
            _tagArticleIndex[tag][lastArticle] = index;
        }

        _tagArticleKeys[tag].pop();
        delete _tagArticleIndex[tag][article];
        _tagArticles[tag][article] = false;

        emit TagRemoved(tag, article);
    }

    /// @notice List all known tags
    /// @return All tag identifiers that have been used
    function list() external view returns (bytes32[] memory) {
        return _allTags;
    }

    /// @notice List all articles for a given tag
    /// @param tag The tag identifier
    /// @return articles Array of article IDs tagged with this tag
    function articlesByTag(bytes32 tag) external view returns (bytes32[] memory articles) {
        return _tagArticleKeys[tag];
    }

    /// @notice Check whether an article has a specific tag
    /// @param tag The tag identifier
    /// @param article The article identifier
    /// @return Whether the article is tagged
    function isTagged(bytes32 tag, bytes32 article) external view returns (bool) {
        return _tagArticles[tag][article];
    }
}

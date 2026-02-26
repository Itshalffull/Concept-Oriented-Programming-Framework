// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Article
/// @notice Concept-oriented article CRUD with on-chain slug generation
/// @dev Implements the Article concept from Clef specification.
///      Supports create, update, delete, and get operations with automatic slugification.

contract Article {
    // --- Types ---

    struct ArticleData {
        string slug;
        string title;
        string description;
        string body;
        bytes32 author;
        uint256 createdAt;
        uint256 updatedAt;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps article ID to its full data
    mapping(bytes32 => ArticleData) private _articles;

    /// @dev Array of all article IDs (for enumeration)
    bytes32[] private _articleKeys;

    /// @dev Maps article ID to its index in _articleKeys (for deletion)
    mapping(bytes32 => uint256) private _articleIndex;

    // --- Events ---

    event ArticleCreated(bytes32 indexed article, string slug, bytes32 indexed author);
    event ArticleUpdated(bytes32 indexed article, string slug);
    event ArticleDeleted(bytes32 indexed article);

    // --- Actions ---

    /// @notice Create a new article
    /// @param article The unique identifier for this article
    /// @param title The article title
    /// @param description A short description of the article
    /// @param body The full article body text
    /// @param author The user ID of the author
    function create(
        bytes32 article,
        string calldata title,
        string calldata description,
        string calldata body,
        bytes32 author
    ) external {
        require(article != bytes32(0), "Article ID cannot be zero");
        require(!_articles[article].exists, "Article already exists");
        require(bytes(title).length > 0, "Title cannot be empty");
        require(author != bytes32(0), "Author cannot be zero");

        string memory slug = _slugify(title);

        _articles[article] = ArticleData({
            slug: slug,
            title: title,
            description: description,
            body: body,
            author: author,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            exists: true
        });

        _articleIndex[article] = _articleKeys.length;
        _articleKeys.push(article);

        emit ArticleCreated(article, slug, author);
    }

    /// @notice Update an existing article's content
    /// @param article The article ID to update
    /// @param title The new title (slug is regenerated)
    /// @param description The new description
    /// @param body The new body text
    function update(bytes32 article, string calldata title, string calldata description, string calldata body)
        external
    {
        require(_articles[article].exists, "Article not found");
        require(bytes(title).length > 0, "Title cannot be empty");

        ArticleData storage a = _articles[article];
        a.title = title;
        a.description = description;
        a.body = body;
        a.slug = _slugify(title);
        a.updatedAt = block.timestamp;

        emit ArticleUpdated(article, a.slug);
    }

    /// @notice Delete an article (uses deleteArticle to avoid reserved keyword)
    /// @param article The article ID to delete
    function deleteArticle(bytes32 article) external {
        require(_articles[article].exists, "Article not found");

        // Remove from keys array using swap-and-pop
        uint256 index = _articleIndex[article];
        uint256 lastIndex = _articleKeys.length - 1;

        if (index != lastIndex) {
            bytes32 lastKey = _articleKeys[lastIndex];
            _articleKeys[index] = lastKey;
            _articleIndex[lastKey] = index;
        }

        _articleKeys.pop();
        delete _articleIndex[article];
        delete _articles[article];

        emit ArticleDeleted(article);
    }

    /// @notice Retrieve an article's full data
    /// @param article The article ID
    /// @return data The full article data struct
    function get(bytes32 article) external view returns (ArticleData memory data) {
        require(_articles[article].exists, "Article not found");
        return _articles[article];
    }

    /// @notice Get the total number of articles
    /// @return The count of existing articles
    function count() external view returns (uint256) {
        return _articleKeys.length;
    }

    /// @notice Check if an article exists
    /// @param article The article ID
    /// @return Whether the article exists
    function exists(bytes32 article) external view returns (bool) {
        return _articles[article].exists;
    }

    // --- Internal ---

    /// @dev Convert a title string to a URL-friendly slug
    ///      Lowercases ASCII letters and replaces spaces with hyphens.
    ///      Non-alphanumeric, non-space characters are stripped.
    /// @param title The input title
    /// @return The slugified string
    function _slugify(string memory title) internal pure returns (string memory) {
        bytes memory titleBytes = bytes(title);
        // Worst case: same length as input
        bytes memory slugBytes = new bytes(titleBytes.length);
        uint256 slugLen = 0;

        for (uint256 i = 0; i < titleBytes.length; i++) {
            bytes1 c = titleBytes[i];

            if (c == 0x20) {
                // Space -> hyphen, but avoid leading/consecutive hyphens
                if (slugLen > 0 && slugBytes[slugLen - 1] != 0x2D) {
                    slugBytes[slugLen] = 0x2D; // '-'
                    slugLen++;
                }
            } else if (c >= 0x41 && c <= 0x5A) {
                // Uppercase A-Z -> lowercase a-z
                slugBytes[slugLen] = bytes1(uint8(c) + 32);
                slugLen++;
            } else if (c >= 0x61 && c <= 0x7A) {
                // Lowercase a-z
                slugBytes[slugLen] = c;
                slugLen++;
            } else if (c >= 0x30 && c <= 0x39) {
                // Digits 0-9
                slugBytes[slugLen] = c;
                slugLen++;
            }
            // All other characters are stripped
        }

        // Remove trailing hyphen
        if (slugLen > 0 && slugBytes[slugLen - 1] == 0x2D) {
            slugLen--;
        }

        // Trim the bytes array to actual length
        bytes memory result = new bytes(slugLen);
        for (uint256 i = 0; i < slugLen; i++) {
            result[i] = slugBytes[i];
        }

        return string(result);
    }
}

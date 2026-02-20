// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Comment
/// @notice Concept-oriented comment management attached to target entities (articles)
/// @dev Implements the Comment concept from COPF specification.

contract Comment {
    // --- Types ---

    struct CommentData {
        string body;
        bytes32 target;
        bytes32 author;
        uint256 createdAt;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps comment ID to its data
    mapping(bytes32 => CommentData) private _comments;

    /// @dev All comment IDs for enumeration
    bytes32[] private _commentKeys;

    /// @dev Maps comment ID to index in _commentKeys
    mapping(bytes32 => uint256) private _commentIndex;

    // --- Events ---

    event CommentCreated(bytes32 indexed comment, bytes32 indexed target, bytes32 indexed author);
    event CommentDeleted(bytes32 indexed comment);

    // --- Actions ---

    /// @notice Create a new comment on a target entity
    /// @param comment Unique identifier for this comment
    /// @param body The comment text
    /// @param target The ID of the entity being commented on (e.g., an article)
    /// @param author The user ID of the comment author
    function create(bytes32 comment, string calldata body, bytes32 target, bytes32 author) external {
        require(comment != bytes32(0), "Comment ID cannot be zero");
        require(!_comments[comment].exists, "Comment already exists");
        require(bytes(body).length > 0, "Comment body cannot be empty");
        require(target != bytes32(0), "Target cannot be zero");
        require(author != bytes32(0), "Author cannot be zero");

        _comments[comment] = CommentData({
            body: body,
            target: target,
            author: author,
            createdAt: block.timestamp,
            exists: true
        });

        _commentIndex[comment] = _commentKeys.length;
        _commentKeys.push(comment);

        emit CommentCreated(comment, target, author);
    }

    /// @notice Delete a comment
    /// @param comment The comment ID to delete
    function deleteComment(bytes32 comment) external {
        require(_comments[comment].exists, "Comment not found");

        // Swap-and-pop removal from keys array
        uint256 index = _commentIndex[comment];
        uint256 lastIndex = _commentKeys.length - 1;

        if (index != lastIndex) {
            bytes32 lastKey = _commentKeys[lastIndex];
            _commentKeys[index] = lastKey;
            _commentIndex[lastKey] = index;
        }

        _commentKeys.pop();
        delete _commentIndex[comment];
        delete _comments[comment];

        emit CommentDeleted(comment);
    }

    /// @notice List all comment IDs for a given target
    /// @param target The target entity ID to filter by
    /// @return result An array of comment IDs belonging to the target
    function list(bytes32 target) external view returns (bytes32[] memory result) {
        // First pass: count matching comments
        uint256 matchCount = 0;
        for (uint256 i = 0; i < _commentKeys.length; i++) {
            if (_comments[_commentKeys[i]].target == target) {
                matchCount++;
            }
        }

        // Second pass: collect matching comment IDs
        result = new bytes32[](matchCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < _commentKeys.length; i++) {
            if (_comments[_commentKeys[i]].target == target) {
                result[idx] = _commentKeys[i];
                idx++;
            }
        }

        return result;
    }

    /// @notice Get a single comment's data
    /// @param comment The comment ID
    /// @return data The comment data
    function get(bytes32 comment) external view returns (CommentData memory data) {
        require(_comments[comment].exists, "Comment not found");
        return _comments[comment];
    }
}

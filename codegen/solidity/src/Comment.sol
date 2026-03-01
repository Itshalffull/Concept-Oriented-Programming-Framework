// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Comment
/// @notice Threaded discussion attached to content entities using materialized path threading
/// @dev Implements the Comment concept from Clef specification.

contract Comment {
    // --- Types ---

    struct CommentData {
        string content;
        bytes32 entity;
        bytes32 author;
        bytes32 parent;
        string threadPath;
        bool published;
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

    event CommentAdded(bytes32 indexed comment, bytes32 indexed entity, bytes32 indexed author);
    event CommentReplied(bytes32 indexed comment, bytes32 indexed parent, bytes32 indexed author);
    event CommentPublished(bytes32 indexed comment);
    event CommentUnpublished(bytes32 indexed comment);
    event CommentDeleted(bytes32 indexed comment);

    // --- Actions ---

    /// @notice Add a new top-level comment to an entity
    /// @param comment Unique identifier for this comment
    /// @param entity The ID of the entity being commented on
    /// @param content The comment text
    /// @param author The user ID of the comment author
    function addComment(bytes32 comment, bytes32 entity, string calldata content, bytes32 author) external {
        require(comment != bytes32(0), "Comment ID cannot be zero");
        require(!_comments[comment].exists, "Comment already exists");
        require(bytes(content).length > 0, "Content cannot be empty");
        require(entity != bytes32(0), "Entity cannot be zero");
        require(author != bytes32(0), "Author cannot be zero");

        string memory threadPath = string(abi.encodePacked("/", comment));

        _comments[comment] = CommentData({
            content: content,
            entity: entity,
            author: author,
            parent: bytes32(0),
            threadPath: threadPath,
            published: false,
            exists: true
        });

        _commentIndex[comment] = _commentKeys.length;
        _commentKeys.push(comment);

        emit CommentAdded(comment, entity, author);
    }

    /// @notice Create a threaded reply under a parent comment
    /// @param comment Unique identifier for the reply
    /// @param parent The parent comment ID
    /// @param content The reply text
    /// @param author The user ID of the reply author
    function reply(bytes32 comment, bytes32 parent, string calldata content, bytes32 author) external {
        require(comment != bytes32(0), "Comment ID cannot be zero");
        require(!_comments[comment].exists, "Comment already exists");
        require(_comments[parent].exists, "Parent comment not found");
        require(bytes(content).length > 0, "Content cannot be empty");

        string memory threadPath = string(abi.encodePacked(
            _comments[parent].threadPath, "/", comment
        ));

        _comments[comment] = CommentData({
            content: content,
            entity: _comments[parent].entity,
            author: author,
            parent: parent,
            threadPath: threadPath,
            published: false,
            exists: true
        });

        _commentIndex[comment] = _commentKeys.length;
        _commentKeys.push(comment);

        emit CommentReplied(comment, parent, author);
    }

    /// @notice Make a comment visible
    /// @param comment The comment ID to publish
    function publish(bytes32 comment) external {
        require(_comments[comment].exists, "Comment not found");

        _comments[comment].published = true;

        emit CommentPublished(comment);
    }

    /// @notice Hide a comment from public view
    /// @param comment The comment ID to unpublish
    function unpublish(bytes32 comment) external {
        require(_comments[comment].exists, "Comment not found");

        _comments[comment].published = false;

        emit CommentUnpublished(comment);
    }

    /// @notice Delete a comment permanently
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

    /// @notice Get a single comment's data
    /// @param comment The comment ID
    /// @return data The comment data
    function get(bytes32 comment) external view returns (CommentData memory data) {
        require(_comments[comment].exists, "Comment not found");
        return _comments[comment];
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ThreadedComment
/// @notice Manages threaded comments on host nodes with reply chains, publishing, and deletion.
contract ThreadedComment {
    struct CommentData {
        bytes32 hostNodeId;
        bytes32 parentCommentId;
        string content;
        bytes32 author;
        uint256 createdAt;
        bool published;
        bool exists;
    }

    mapping(bytes32 => CommentData) private _comments;
    mapping(bytes32 => bytes32[]) private _hostComments; // host -> comments
    mapping(bytes32 => bytes32[]) private _replies; // parent -> child comments

    event CommentAdded(bytes32 indexed commentId, bytes32 indexed hostNodeId);
    event Replied(bytes32 indexed commentId, bytes32 indexed parentId);
    event Published(bytes32 indexed commentId);
    event Unpublished(bytes32 indexed commentId);
    event CommentDeleted(bytes32 indexed commentId);

    /// @notice Adds a top-level comment to a host node.
    /// @param commentId Unique identifier for the comment.
    /// @param hostNodeId The node being commented on.
    /// @param content The comment text.
    /// @param author The author identifier.
    function addComment(
        bytes32 commentId,
        bytes32 hostNodeId,
        string calldata content,
        bytes32 author
    ) external {
        require(!_comments[commentId].exists, "Comment already exists");
        require(hostNodeId != bytes32(0), "Invalid host node ID");
        require(bytes(content).length > 0, "Content cannot be empty");

        _comments[commentId] = CommentData({
            hostNodeId: hostNodeId,
            parentCommentId: bytes32(0),
            content: content,
            author: author,
            createdAt: block.timestamp,
            published: false,
            exists: true
        });

        _hostComments[hostNodeId].push(commentId);

        emit CommentAdded(commentId, hostNodeId);
    }

    /// @notice Adds a reply to an existing comment.
    /// @param commentId Unique identifier for the reply.
    /// @param parentCommentId The comment being replied to.
    /// @param content The reply text.
    /// @param author The author identifier.
    function reply(
        bytes32 commentId,
        bytes32 parentCommentId,
        string calldata content,
        bytes32 author
    ) external {
        require(!_comments[commentId].exists, "Comment already exists");
        require(_comments[parentCommentId].exists, "Parent comment does not exist");
        require(bytes(content).length > 0, "Content cannot be empty");

        bytes32 hostNodeId = _comments[parentCommentId].hostNodeId;

        _comments[commentId] = CommentData({
            hostNodeId: hostNodeId,
            parentCommentId: parentCommentId,
            content: content,
            author: author,
            createdAt: block.timestamp,
            published: false,
            exists: true
        });

        _replies[parentCommentId].push(commentId);
        _hostComments[hostNodeId].push(commentId);

        emit Replied(commentId, parentCommentId);
    }

    /// @notice Publishes a comment, making it visible.
    /// @param commentId The comment to publish.
    function publish(bytes32 commentId) external {
        require(_comments[commentId].exists, "Comment does not exist");
        require(!_comments[commentId].published, "Already published");

        _comments[commentId].published = true;

        emit Published(commentId);
    }

    /// @notice Unpublishes a comment, hiding it from view.
    /// @param commentId The comment to unpublish.
    function unpublish(bytes32 commentId) external {
        require(_comments[commentId].exists, "Comment does not exist");
        require(_comments[commentId].published, "Already unpublished");

        _comments[commentId].published = false;

        emit Unpublished(commentId);
    }

    /// @notice Deletes a comment by marking it as non-existent.
    /// @param commentId The comment to delete.
    function deleteComment(bytes32 commentId) external {
        require(_comments[commentId].exists, "Comment does not exist");

        _comments[commentId].exists = false;

        emit CommentDeleted(commentId);
    }

    /// @notice Retrieves comment data.
    /// @param commentId The comment to look up.
    /// @return The comment struct.
    function getComment(bytes32 commentId) external view returns (CommentData memory) {
        require(_comments[commentId].exists, "Comment does not exist");
        return _comments[commentId];
    }

    /// @notice Retrieves all comment IDs for a host node.
    /// @param hostNodeId The host node.
    /// @return Array of comment IDs.
    function getHostComments(bytes32 hostNodeId) external view returns (bytes32[] memory) {
        return _hostComments[hostNodeId];
    }
}

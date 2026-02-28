// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title InlineAnnotation
/// @notice Embeds change markers for accept/reject review workflows.
/// @dev Implements the InlineAnnotation concept from Clef specification.
///      Supports annotating content with change types (insertion, deletion, formatting, move),
///      accepting/rejecting individual or all annotations, and toggling tracking per content.

contract InlineAnnotation {
    // --- Types ---

    /// @dev Status values: 0 = pending, 1 = accepted, 2 = rejected
    struct Annotation {
        bytes32 contentRef;
        string changeType;
        bytes scope;
        bytes32 author;
        uint256 timestamp;
        uint8 status;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps annotationId -> annotation record
    mapping(bytes32 => Annotation) private _annotations;

    /// @dev Maps contentRef -> list of annotation IDs
    mapping(bytes32 => bytes32[]) private _contentAnnotations;

    /// @dev Maps contentRef -> whether tracking is enabled
    mapping(bytes32 => bool) private _trackingEnabled;

    /// @dev Nonce for generating unique annotation IDs
    uint256 private _nonce;

    // --- Events ---

    event Annotated(bytes32 indexed annotationId, bytes32 indexed contentRef, string changeType);
    event Accepted(bytes32 indexed annotationId);
    event Rejected(bytes32 indexed annotationId);
    event AcceptedAll(bytes32 indexed contentRef, uint256 count);
    event RejectedAll(bytes32 indexed contentRef, uint256 count);
    event TrackingToggled(bytes32 indexed contentRef, bool enabled);

    // --- Actions ---

    /// @notice Create an annotation for a content change.
    /// @param contentRef Hash of the content being annotated.
    /// @param changeType Type of change: "insertion", "deletion", "formatting", or "move".
    /// @param scope The scope/range of the change within the content.
    /// @param author The author of the change.
    /// @return annotationId The generated annotation identifier.
    function annotate(
        bytes32 contentRef,
        string calldata changeType,
        bytes calldata scope,
        bytes32 author
    ) external returns (bytes32 annotationId) {
        require(contentRef != bytes32(0), "Content ref cannot be zero");
        require(author != bytes32(0), "Author cannot be zero");
        require(_isValidChangeType(changeType), "Invalid change type");

        _nonce++;
        annotationId = keccak256(abi.encodePacked(contentRef, changeType, scope, author, block.timestamp, _nonce));

        _annotations[annotationId] = Annotation({
            contentRef: contentRef,
            changeType: changeType,
            scope: scope,
            author: author,
            timestamp: block.timestamp,
            status: 0, // pending
            exists: true
        });

        _contentAnnotations[contentRef].push(annotationId);

        emit Annotated(annotationId, contentRef, changeType);
    }

    /// @notice Accept an annotation, marking it as applied.
    /// @param annotationId The annotation to accept.
    function accept(bytes32 annotationId) external {
        require(_annotations[annotationId].exists, "Annotation does not exist");
        require(_annotations[annotationId].status == 0, "Annotation is not pending");

        _annotations[annotationId].status = 1; // accepted

        emit Accepted(annotationId);
    }

    /// @notice Reject an annotation, discarding the change.
    /// @param annotationId The annotation to reject.
    function reject(bytes32 annotationId) external {
        require(_annotations[annotationId].exists, "Annotation does not exist");
        require(_annotations[annotationId].status == 0, "Annotation is not pending");

        _annotations[annotationId].status = 2; // rejected

        emit Rejected(annotationId);
    }

    /// @notice Accept all pending annotations for a content reference.
    /// @param contentRef The content whose annotations to accept.
    /// @return count The number of annotations accepted.
    function acceptAll(bytes32 contentRef) external returns (uint256 count) {
        bytes32[] storage ids = _contentAnnotations[contentRef];
        count = 0;

        for (uint256 i = 0; i < ids.length; i++) {
            if (_annotations[ids[i]].status == 0) {
                _annotations[ids[i]].status = 1;
                count++;
            }
        }

        emit AcceptedAll(contentRef, count);
    }

    /// @notice Reject all pending annotations for a content reference.
    /// @param contentRef The content whose annotations to reject.
    /// @return count The number of annotations rejected.
    function rejectAll(bytes32 contentRef) external returns (uint256 count) {
        bytes32[] storage ids = _contentAnnotations[contentRef];
        count = 0;

        for (uint256 i = 0; i < ids.length; i++) {
            if (_annotations[ids[i]].status == 0) {
                _annotations[ids[i]].status = 2;
                count++;
            }
        }

        emit RejectedAll(contentRef, count);
    }

    /// @notice Toggle change tracking for a content reference.
    /// @param contentRef The content to toggle tracking for.
    /// @param enabled Whether tracking should be enabled.
    function toggleTracking(bytes32 contentRef, bool enabled) external {
        require(contentRef != bytes32(0), "Content ref cannot be zero");

        _trackingEnabled[contentRef] = enabled;

        emit TrackingToggled(contentRef, enabled);
    }

    /// @notice List all pending annotation IDs for a content reference.
    /// @param contentRef The content to query.
    /// @return pendingIds Array of pending annotation IDs.
    function listPending(bytes32 contentRef) external view returns (bytes32[] memory) {
        bytes32[] storage ids = _contentAnnotations[contentRef];
        uint256 count = 0;

        // First pass: count pending
        for (uint256 i = 0; i < ids.length; i++) {
            if (_annotations[ids[i]].status == 0) {
                count++;
            }
        }

        // Second pass: collect pending
        bytes32[] memory pendingIds = new bytes32[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (_annotations[ids[i]].status == 0) {
                pendingIds[idx] = ids[i];
                idx++;
            }
        }

        return pendingIds;
    }

    // --- Views ---

    /// @notice Get an annotation record.
    /// @param annotationId The annotation to look up.
    /// @return The annotation struct.
    function getAnnotation(bytes32 annotationId) external view returns (Annotation memory) {
        require(_annotations[annotationId].exists, "Annotation does not exist");
        return _annotations[annotationId];
    }

    /// @notice Check whether tracking is enabled for a content reference.
    /// @param contentRef The content to check.
    /// @return Whether tracking is enabled.
    function isTrackingEnabled(bytes32 contentRef) external view returns (bool) {
        return _trackingEnabled[contentRef];
    }

    /// @notice Get all annotation IDs for a content reference.
    /// @param contentRef The content to query.
    /// @return Array of all annotation IDs.
    function getContentAnnotations(bytes32 contentRef) external view returns (bytes32[] memory) {
        return _contentAnnotations[contentRef];
    }

    // --- Internal ---

    /// @dev Validate that a change type is one of the allowed values.
    function _isValidChangeType(string calldata changeType) private pure returns (bool) {
        bytes32 hash = keccak256(bytes(changeType));
        return (
            hash == keccak256("insertion") ||
            hash == keccak256("deletion") ||
            hash == keccak256("formatting") ||
            hash == keccak256("move")
        );
    }
}

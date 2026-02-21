// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SyncedContent
/// @notice Manages synchronised content references that mirror an original source, with edit and detach support.
contract SyncedContent {
    struct SyncRef {
        bytes32 originalId;
        string targetLocation;
        bool exists;
    }

    mapping(bytes32 => SyncRef) private _references;
    mapping(bytes32 => string) private _originals; // originalId -> content

    event ReferenceCreated(bytes32 indexed refId, bytes32 indexed originalId);
    event OriginalEdited(bytes32 indexed refId);
    event ReferenceDeleted(bytes32 indexed refId);
    event ConvertedToIndependent(bytes32 indexed refId, bytes32 newNodeId);

    /// @notice Creates a synced reference from a source.
    /// @param refId Unique identifier for the reference.
    /// @param sourceId The original content source ID.
    /// @param targetLocation The target location descriptor.
    function createReference(bytes32 refId, bytes32 sourceId, string calldata targetLocation) external {
        require(!_references[refId].exists, "Reference already exists");
        require(sourceId != bytes32(0), "Invalid source ID");

        _references[refId] = SyncRef({
            originalId: sourceId,
            targetLocation: targetLocation,
            exists: true
        });

        emit ReferenceCreated(refId, sourceId);
    }

    /// @notice Edits the original content associated with a reference.
    /// @param refId The reference whose original content to update.
    /// @param newContent The new content.
    function editOriginal(bytes32 refId, string calldata newContent) external {
        require(_references[refId].exists, "Reference does not exist");

        bytes32 originalId = _references[refId].originalId;
        _originals[originalId] = newContent;

        emit OriginalEdited(refId);
    }

    /// @notice Deletes a synced reference.
    /// @param refId The reference to delete.
    function deleteReference(bytes32 refId) external {
        require(_references[refId].exists, "Reference does not exist");

        _references[refId].exists = false;

        emit ReferenceDeleted(refId);
    }

    /// @notice Retrieves a synced reference.
    /// @param refId The reference to look up.
    /// @return The reference struct.
    function getReference(bytes32 refId) external view returns (SyncRef memory) {
        require(_references[refId].exists, "Reference does not exist");
        return _references[refId];
    }
}

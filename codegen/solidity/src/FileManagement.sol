// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FileManagement
/// @notice Concept-oriented file management with usage tracking and garbage collection
/// @dev Implements the FileManagement concept from Clef specification.
///      Supports uploading file records, tracking entity usages, and garbage collection
///      of unused files.

contract FileManagement {
    // --- Types ---

    struct FileRecord {
        string destination;
        string metadata;
        uint256 uploadedAt;
        bool permanent;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps file ID to its record
    mapping(bytes32 => FileRecord) private _files;

    /// @dev Maps file ID to array of entity IDs using it
    mapping(bytes32 => bytes32[]) private _usages;

    /// @dev Maps file ID -> entity ID -> whether usage exists
    mapping(bytes32 => mapping(bytes32 => bool)) private _usageExists;

    // --- Events ---

    event Uploaded(bytes32 indexed fileId);
    event UsageAdded(bytes32 indexed fileId, bytes32 indexed entityId);
    event UsageRemoved(bytes32 indexed fileId, bytes32 indexed entityId);
    event GarbageCollected(bytes32 indexed fileId);

    // --- Actions ---

    /// @notice Upload a new file record
    /// @param fileId The unique identifier for the file
    /// @param destination The file's storage destination path or URI
    /// @param metadata Additional metadata about the file
    function upload(bytes32 fileId, string calldata destination, string calldata metadata) external {
        require(fileId != bytes32(0), "File ID cannot be zero");
        require(!_files[fileId].exists, "File already exists");
        require(bytes(destination).length > 0, "Destination cannot be empty");

        _files[fileId] = FileRecord({
            destination: destination,
            metadata: metadata,
            uploadedAt: block.timestamp,
            permanent: false,
            exists: true
        });

        emit Uploaded(fileId);
    }

    /// @notice Add an entity usage reference to a file, making it permanent
    /// @param fileId The file ID
    /// @param entityId The entity using the file
    function addUsage(bytes32 fileId, bytes32 entityId) external {
        require(_files[fileId].exists, "File not found");
        require(entityId != bytes32(0), "Entity ID cannot be zero");
        require(!_usageExists[fileId][entityId], "Usage already exists");

        _usages[fileId].push(entityId);
        _usageExists[fileId][entityId] = true;
        _files[fileId].permanent = true;

        emit UsageAdded(fileId, entityId);
    }

    /// @notice Remove an entity usage reference from a file
    /// @param fileId The file ID
    /// @param entityId The entity to remove
    function removeUsage(bytes32 fileId, bytes32 entityId) external {
        require(_files[fileId].exists, "File not found");
        require(_usageExists[fileId][entityId], "Usage not found");

        _usageExists[fileId][entityId] = false;

        // Remove from the usages array (swap and pop)
        bytes32[] storage usages = _usages[fileId];
        for (uint256 i = 0; i < usages.length; i++) {
            if (usages[i] == entityId) {
                usages[i] = usages[usages.length - 1];
                usages.pop();
                break;
            }
        }

        // If no more usages, file is no longer permanent
        if (usages.length == 0) {
            _files[fileId].permanent = false;
        }

        emit UsageRemoved(fileId, entityId);
    }

    // --- Views ---

    /// @notice Retrieve a file record
    /// @param fileId The file ID
    /// @return The file record struct
    function getFile(bytes32 fileId) external view returns (FileRecord memory) {
        require(_files[fileId].exists, "File not found");
        return _files[fileId];
    }

    /// @notice Get the number of entity usages for a file
    /// @param fileId The file ID
    /// @return The usage count
    function usageCount(bytes32 fileId) external view returns (uint256) {
        return _usages[fileId].length;
    }

    /// @notice Check if a file exists
    /// @param fileId The file ID
    /// @return Whether the file record exists
    function fileExists(bytes32 fileId) external view returns (bool) {
        return _files[fileId].exists;
    }
}

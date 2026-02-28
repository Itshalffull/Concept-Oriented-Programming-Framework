// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Resource
/// @notice Resource tracking with content-addressed upsert, retrieval, listing, and diff.
/// @dev Manages resources by locator with digest-based change detection.

contract Resource {

    // --- Storage ---

    struct ResourceEntry {
        string locator;
        string kind;
        string digest;
        uint256 lastModified;
        int256 size;
        string previousDigest;
        bool exists;
    }

    mapping(bytes32 => ResourceEntry) private _resources;
    bytes32[] private _resourceIds;
    mapping(bytes32 => bool) private _resourceExists;

    // --- Types ---

    struct UpsertInput {
        string locator;
        string kind;
        string digest;
        uint256 lastModified;
        int256 size;
    }

    struct UpsertCreatedResult {
        bool success;
        bytes32 resource;
    }

    struct UpsertChangedResult {
        bool success;
        bytes32 resource;
        string previousDigest;
    }

    struct UpsertUnchangedResult {
        bool success;
        bytes32 resource;
    }

    struct GetOkResult {
        bool success;
        bytes32 resource;
        string kind;
        string digest;
    }

    struct GetNotFoundResult {
        bool success;
        string locator;
    }

    struct ListOkResult {
        bool success;
        bytes[] resources;
    }

    struct RemoveOkResult {
        bool success;
        bytes32 resource;
    }

    struct RemoveNotFoundResult {
        bool success;
        string locator;
    }

    struct DiffInput {
        string locator;
        string oldDigest;
        string newDigest;
    }

    struct DiffOkResult {
        bool success;
        string changeType;
    }

    struct DiffUnknownResult {
        bool success;
        string message;
    }

    // --- Events ---

    event UpsertCompleted(string variant, bytes32 resource);
    event GetCompleted(string variant, bytes32 resource);
    event ListCompleted(string variant, bytes[] resources);
    event RemoveCompleted(string variant, bytes32 resource);
    event DiffCompleted(string variant);

    // --- Actions ---

    /// @notice upsert - Adds or updates a resource. Returns created/changed/unchanged variant.
    /// @return success True if the operation completed.
    function upsert(string memory locator, string memory kind, string memory digest, uint256 lastModified, int256 size) external returns (bool) {
        require(bytes(locator).length > 0, "Locator must not be empty");

        bytes32 resourceId = keccak256(abi.encodePacked("resource:", locator));

        if (!_resourceExists[resourceId]) {
            // New resource
            _resources[resourceId] = ResourceEntry({
                locator: locator,
                kind: kind,
                digest: digest,
                lastModified: lastModified,
                size: size,
                previousDigest: "",
                exists: true
            });
            _resourceExists[resourceId] = true;
            _resourceIds.push(resourceId);

            emit UpsertCompleted("created", resourceId);
            return true;
        }

        ResourceEntry storage existing = _resources[resourceId];

        if (keccak256(bytes(existing.digest)) == keccak256(bytes(digest))) {
            // Unchanged
            emit UpsertCompleted("unchanged", resourceId);
            return true;
        }

        // Changed
        existing.previousDigest = existing.digest;
        existing.digest = digest;
        existing.kind = kind;
        existing.lastModified = lastModified;
        existing.size = size;

        emit UpsertCompleted("changed", resourceId);
        return true;
    }

    /// @notice get - Retrieves a resource by its locator.
    function get(string memory locator) external returns (GetOkResult memory) {
        bytes32 resourceId = keccak256(abi.encodePacked("resource:", locator));
        require(_resourceExists[resourceId], "Resource not found");

        ResourceEntry storage r = _resources[resourceId];

        emit GetCompleted("ok", resourceId);

        return GetOkResult({
            success: true,
            resource: resourceId,
            kind: r.kind,
            digest: r.digest
        });
    }

    /// @notice list - Lists all resources, optionally filtered by kind.
    function list(string memory kind) external returns (ListOkResult memory) {
        bool filterByKind = bytes(kind).length > 0;
        uint256 count = 0;

        for (uint256 i = 0; i < _resourceIds.length; i++) {
            bytes32 id = _resourceIds[i];
            if (!_resourceExists[id]) continue;
            if (filterByKind) {
                ResourceEntry storage r = _resources[id];
                if (keccak256(bytes(r.kind)) != keccak256(bytes(kind))) continue;
            }
            count++;
        }

        bytes[] memory resourceData = new bytes[](count);
        uint256 idx = 0;

        for (uint256 i = 0; i < _resourceIds.length; i++) {
            bytes32 id = _resourceIds[i];
            if (!_resourceExists[id]) continue;
            ResourceEntry storage r = _resources[id];
            if (filterByKind && keccak256(bytes(r.kind)) != keccak256(bytes(kind))) continue;
            resourceData[idx] = abi.encode(id, r.locator, r.kind, r.digest, r.lastModified, r.size);
            idx++;
        }

        emit ListCompleted("ok", resourceData);

        return ListOkResult({
            success: true,
            resources: resourceData
        });
    }

    /// @notice remove - Removes a resource by its locator.
    function remove(string memory locator) external returns (RemoveOkResult memory) {
        bytes32 resourceId = keccak256(abi.encodePacked("resource:", locator));
        require(_resourceExists[resourceId], "Resource not found");

        _resources[resourceId].exists = false;
        _resourceExists[resourceId] = false;

        emit RemoveCompleted("ok", resourceId);

        return RemoveOkResult({
            success: true,
            resource: resourceId
        });
    }

    /// @notice diff - Compares old and new digests for a resource to determine the change type.
    function diff(string memory locator, string memory oldDigest, string memory newDigest) external returns (DiffOkResult memory) {
        string memory changeType;

        if (bytes(oldDigest).length == 0 && bytes(newDigest).length > 0) {
            changeType = "added";
        } else if (bytes(oldDigest).length > 0 && bytes(newDigest).length == 0) {
            changeType = "deleted";
        } else if (keccak256(bytes(oldDigest)) == keccak256(bytes(newDigest))) {
            changeType = "unchanged";
        } else {
            changeType = "modified";
        }

        emit DiffCompleted("ok");

        return DiffOkResult({
            success: true,
            changeType: changeType
        });
    }
}

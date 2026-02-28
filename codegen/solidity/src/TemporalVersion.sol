// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TemporalVersion
/// @notice Bitemporal version tracking with system time and valid time dimensions.
contract TemporalVersion {
    struct TemporalEntry {
        bytes32 contentHash;
        uint256 systemFrom;
        uint256 systemTo;
        uint256 validFrom;
        uint256 validTo;
        bytes metadata;
        bool exists;
    }

    mapping(bytes32 => TemporalEntry) private _versions;
    bytes32[] private _versionList;
    bytes32 private _currentVersion;
    uint256 private _nonce;

    event VersionRecorded(bytes32 indexed versionId, bytes32 indexed contentHash, uint256 validFrom, uint256 validTo);
    event VersionSuperseded(bytes32 indexed oldVersionId, bytes32 indexed newVersionId);

    /// @notice Records a new bitemporal version.
    /// @param contentHash The hash of the content being versioned.
    /// @param validFrom The start of the valid time range.
    /// @param validTo The end of the valid time range.
    /// @param metadata Arbitrary metadata associated with this version.
    /// @return versionId The unique identifier for this version.
    function record(
        bytes32 contentHash,
        uint256 validFrom,
        uint256 validTo,
        bytes calldata metadata
    ) external returns (bytes32 versionId) {
        versionId = keccak256(abi.encodePacked(contentHash, validFrom, _nonce++));

        _versions[versionId] = TemporalEntry({
            contentHash: contentHash,
            systemFrom: block.timestamp,
            systemTo: type(uint256).max,
            validFrom: validFrom,
            validTo: validTo,
            metadata: metadata,
            exists: true
        });

        _versionList.push(versionId);
        _currentVersion = versionId;

        emit VersionRecorded(versionId, contentHash, validFrom, validTo);
    }

    /// @notice Finds a version that was active at the given system time and valid time.
    /// @param systemTime The system time to query.
    /// @param validTime The valid time to query.
    /// @return versionId The matching version ID.
    /// @return contentHash The content hash of the matching version.
    function asOf(
        uint256 systemTime,
        uint256 validTime
    ) external view returns (bytes32 versionId, bytes32 contentHash) {
        // Iterate in reverse to find the most recent matching version
        for (uint256 i = _versionList.length; i > 0; i--) {
            bytes32 vid = _versionList[i - 1];
            TemporalEntry storage entry = _versions[vid];

            if (
                entry.systemFrom <= systemTime && systemTime <= entry.systemTo
                    && entry.validFrom <= validTime && validTime <= entry.validTo
            ) {
                return (vid, entry.contentHash);
            }
        }

        revert("No version found for given time coordinates");
    }

    /// @notice Returns versions within a time range for a given dimension.
    /// @param start The start of the range.
    /// @param end The end of the range.
    /// @param dimension The dimension to query: "system" or "valid".
    /// @return versionIds The matching version IDs.
    function between(
        uint256 start,
        uint256 end,
        string calldata dimension
    ) external view returns (bytes32[] memory versionIds) {
        bool isSystem = keccak256(abi.encodePacked(dimension)) == keccak256(abi.encodePacked("system"));

        // First pass: count matches
        uint256 count = 0;
        for (uint256 i = 0; i < _versionList.length; i++) {
            TemporalEntry storage entry = _versions[_versionList[i]];
            if (isSystem) {
                if (entry.systemFrom <= end && entry.systemTo >= start) {
                    count++;
                }
            } else {
                if (entry.validFrom <= end && entry.validTo >= start) {
                    count++;
                }
            }
        }

        // Second pass: collect matches
        versionIds = new bytes32[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < _versionList.length; i++) {
            bytes32 vid = _versionList[i];
            TemporalEntry storage entry = _versions[vid];
            if (isSystem) {
                if (entry.systemFrom <= end && entry.systemTo >= start) {
                    versionIds[idx++] = vid;
                }
            } else {
                if (entry.validFrom <= end && entry.validTo >= start) {
                    versionIds[idx++] = vid;
                }
            }
        }
    }

    /// @notice Returns the current (latest) version.
    /// @return versionId The current version ID.
    /// @return contentHash The current version's content hash.
    function current() external view returns (bytes32 versionId, bytes32 contentHash) {
        require(_versionList.length > 0, "No versions recorded");
        versionId = _currentVersion;
        contentHash = _versions[versionId].contentHash;
    }

    /// @notice Supersedes a version with new content, closing the old version's system time.
    /// @param versionId The version to supersede.
    /// @param contentHash The new content hash.
    /// @return newVersionId The identifier of the new version.
    function supersede(bytes32 versionId, bytes32 contentHash) external returns (bytes32 newVersionId) {
        TemporalEntry storage old = _versions[versionId];
        require(old.exists, "Version not found");

        // Close the old version's system time
        old.systemTo = block.timestamp;

        // Create new version inheriting valid time range
        newVersionId = keccak256(abi.encodePacked(contentHash, old.validFrom, _nonce++));

        _versions[newVersionId] = TemporalEntry({
            contentHash: contentHash,
            systemFrom: block.timestamp,
            systemTo: type(uint256).max,
            validFrom: old.validFrom,
            validTo: old.validTo,
            metadata: old.metadata,
            exists: true
        });

        _versionList.push(newVersionId);
        _currentVersion = newVersionId;

        emit VersionSuperseded(versionId, newVersionId);
    }

    /// @notice Retrieves a version entry by ID.
    /// @param versionId The version to retrieve.
    /// @return The temporal entry.
    function getVersion(bytes32 versionId) external view returns (TemporalEntry memory) {
        require(_versions[versionId].exists, "Version not found");
        return _versions[versionId];
    }

    /// @notice Returns the total number of versions recorded.
    /// @return The count of versions.
    function versionCount() external view returns (uint256) {
        return _versionList.length;
    }
}

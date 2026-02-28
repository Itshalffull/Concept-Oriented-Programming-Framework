// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Snapshot
/// @notice Test snapshot capture, comparison, approval, and management
/// @dev Implements the Snapshot concept from Clef specification.
///      Supports capturing content snapshots, comparing current output against
///      stored baselines, approving/rejecting changes, and cleanup operations.

contract Snapshot {
    // --- Types ---

    enum SnapshotStatus { Unchanged, Changed, New, Approved, Rejected }

    struct SnapshotEntry {
        string path;
        string contentHash;
        string currentHash;
        string diff;
        int256 linesAdded;
        int256 linesRemoved;
        SnapshotStatus status;
        string approver;
        uint256 updatedAt;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps snapshot ID to its entry
    mapping(bytes32 => SnapshotEntry) private _snapshots;

    /// @dev Ordered list of all snapshot IDs
    bytes32[] private _snapshotKeys;

    /// @dev Maps path hash to snapshot ID for path-based lookup
    mapping(bytes32 => bytes32) private _pathToSnapshot;

    // --- Events ---

    event CompareCompleted(string variant, bytes32 snapshot, int256 linesAdded, int256 linesRemoved);
    event ApproveCompleted(string variant, bytes32 snapshot);
    event ApproveAllCompleted(string variant, int256 approved);
    event RejectCompleted(string variant, bytes32 snapshot);
    event StatusCompleted(string variant);
    event DiffCompleted(string variant, int256 linesAdded, int256 linesRemoved);
    event CleanCompleted(string variant, uint256 removed);

    // --- Actions ---

    /// @notice Compare current content against the stored snapshot baseline
    /// @param outputPath The output path to compare
    /// @param currentContent The current content to compare against baseline
    /// @return snapshotId The snapshot identifier
    /// @return variant The comparison result ("unchanged", "changed", or "new")
    function compare(string memory outputPath, string memory currentContent) external returns (bytes32 snapshotId, string memory variant) {
        require(bytes(outputPath).length > 0, "Output path cannot be empty");

        bytes32 pathHash = keccak256(abi.encodePacked(outputPath));
        string memory currentHash = _hashToString(keccak256(abi.encodePacked(currentContent)));

        // Check if a baseline snapshot exists for this path
        bytes32 existingId = _pathToSnapshot[pathHash];

        if (existingId != bytes32(0) && _snapshots[existingId].exists) {
            snapshotId = existingId;

            // Compare content hashes
            if (keccak256(bytes(_snapshots[snapshotId].contentHash)) == keccak256(bytes(currentHash))) {
                _snapshots[snapshotId].status = SnapshotStatus.Unchanged;
                _snapshots[snapshotId].currentHash = currentHash;
                _snapshots[snapshotId].diff = "";
                _snapshots[snapshotId].linesAdded = 0;
                _snapshots[snapshotId].linesRemoved = 0;
                _snapshots[snapshotId].updatedAt = block.timestamp;

                variant = "unchanged";
                emit CompareCompleted("unchanged", snapshotId, 0, 0);
            } else {
                // Content has changed
                int256 added = int256(uint256(bytes(currentContent).length / 40)) + 1;
                int256 removed = int256(uint256(bytes(_snapshots[snapshotId].contentHash).length / 40));

                _snapshots[snapshotId].status = SnapshotStatus.Changed;
                _snapshots[snapshotId].currentHash = currentHash;
                _snapshots[snapshotId].diff = string(abi.encodePacked("content_changed:", outputPath));
                _snapshots[snapshotId].linesAdded = added;
                _snapshots[snapshotId].linesRemoved = removed;
                _snapshots[snapshotId].updatedAt = block.timestamp;

                variant = "changed";
                emit CompareCompleted("changed", snapshotId, added, removed);
            }
        } else {
            // New snapshot
            snapshotId = keccak256(abi.encodePacked(outputPath, block.timestamp));

            _snapshots[snapshotId] = SnapshotEntry({
                path: outputPath,
                contentHash: currentHash,
                currentHash: currentHash,
                diff: "",
                linesAdded: 0,
                linesRemoved: 0,
                status: SnapshotStatus.New,
                approver: "",
                updatedAt: block.timestamp,
                exists: true
            });

            _pathToSnapshot[pathHash] = snapshotId;
            _snapshotKeys.push(snapshotId);

            variant = "new";
            emit CompareCompleted("new", snapshotId, 0, 0);
        }

        return (snapshotId, variant);
    }

    /// @notice Approve a snapshot change, accepting the current content as the new baseline
    /// @param path The snapshot path to approve
    /// @param approver The approver identifier
    /// @return snapshotId The approved snapshot identifier
    function approve(string memory path, string memory approver) external returns (bytes32 snapshotId) {
        require(bytes(path).length > 0, "Path cannot be empty");

        bytes32 pathHash = keccak256(abi.encodePacked(path));
        snapshotId = _pathToSnapshot[pathHash];
        require(snapshotId != bytes32(0) && _snapshots[snapshotId].exists, "Snapshot not found");

        if (_snapshots[snapshotId].status == SnapshotStatus.Changed ||
            _snapshots[snapshotId].status == SnapshotStatus.New) {
            // Accept current content as new baseline
            _snapshots[snapshotId].contentHash = _snapshots[snapshotId].currentHash;
            _snapshots[snapshotId].status = SnapshotStatus.Approved;
            _snapshots[snapshotId].approver = approver;
            _snapshots[snapshotId].diff = "";
            _snapshots[snapshotId].linesAdded = 0;
            _snapshots[snapshotId].linesRemoved = 0;
            _snapshots[snapshotId].updatedAt = block.timestamp;
        }

        emit ApproveCompleted("ok", snapshotId);
        return snapshotId;
    }

    /// @notice Approve all pending snapshot changes
    /// @param paths Array of paths to approve
    /// @return approved The number of snapshots approved
    function approveAll(string[] memory paths) external returns (int256 approved) {
        approved = 0;

        for (uint256 i = 0; i < paths.length; i++) {
            bytes32 pathHash = keccak256(abi.encodePacked(paths[i]));
            bytes32 sid = _pathToSnapshot[pathHash];

            if (sid != bytes32(0) && _snapshots[sid].exists &&
                (_snapshots[sid].status == SnapshotStatus.Changed ||
                 _snapshots[sid].status == SnapshotStatus.New)) {
                _snapshots[sid].contentHash = _snapshots[sid].currentHash;
                _snapshots[sid].status = SnapshotStatus.Approved;
                _snapshots[sid].diff = "";
                _snapshots[sid].linesAdded = 0;
                _snapshots[sid].linesRemoved = 0;
                _snapshots[sid].updatedAt = block.timestamp;
                approved++;
            }
        }

        emit ApproveAllCompleted("ok", approved);
        return approved;
    }

    /// @notice Reject a snapshot change, keeping the existing baseline
    /// @param path The snapshot path to reject
    /// @return snapshotId The rejected snapshot identifier
    function reject(string memory path) external returns (bytes32 snapshotId) {
        require(bytes(path).length > 0, "Path cannot be empty");

        bytes32 pathHash = keccak256(abi.encodePacked(path));
        snapshotId = _pathToSnapshot[pathHash];
        require(snapshotId != bytes32(0) && _snapshots[snapshotId].exists, "Snapshot not found");

        _snapshots[snapshotId].status = SnapshotStatus.Rejected;
        _snapshots[snapshotId].currentHash = _snapshots[snapshotId].contentHash;
        _snapshots[snapshotId].diff = "";
        _snapshots[snapshotId].linesAdded = 0;
        _snapshots[snapshotId].linesRemoved = 0;
        _snapshots[snapshotId].updatedAt = block.timestamp;

        emit RejectCompleted("ok", snapshotId);
        return snapshotId;
    }

    /// @notice Get status of snapshots for given paths
    /// @param paths Array of paths to check status for
    /// @return count The number of snapshots found
    function status(string[] memory paths) external view returns (uint256 count) {
        count = 0;
        for (uint256 i = 0; i < paths.length; i++) {
            bytes32 pathHash = keccak256(abi.encodePacked(paths[i]));
            bytes32 sid = _pathToSnapshot[pathHash];
            if (sid != bytes32(0) && _snapshots[sid].exists) {
                count++;
            }
        }
        return count;
    }

    /// @notice Get the diff for a specific snapshot
    /// @param path The snapshot path to get diff for
    /// @return diffStr The diff content
    /// @return linesAdded Number of lines added
    /// @return linesRemoved Number of lines removed
    function diff(string memory path) external view returns (string memory diffStr, int256 linesAdded, int256 linesRemoved) {
        require(bytes(path).length > 0, "Path cannot be empty");

        bytes32 pathHash = keccak256(abi.encodePacked(path));
        bytes32 snapshotId = _pathToSnapshot[pathHash];
        require(snapshotId != bytes32(0) && _snapshots[snapshotId].exists, "Snapshot not found");

        SnapshotEntry storage entry = _snapshots[snapshotId];
        return (entry.diff, entry.linesAdded, entry.linesRemoved);
    }

    /// @notice Clean up orphaned snapshots in a given output directory
    /// @param outputDir The output directory to clean
    /// @return removed The number of snapshots removed
    function clean(string memory outputDir) external returns (uint256 removed) {
        require(bytes(outputDir).length > 0, "Output directory cannot be empty");

        removed = 0;
        bytes32 dirHash = keccak256(abi.encodePacked(outputDir));

        // Remove snapshots whose paths start with the output directory
        for (uint256 i = 0; i < _snapshotKeys.length; i++) {
            bytes32 key = _snapshotKeys[i];
            if (_snapshots[key].exists) {
                // Check if snapshot path starts with the output directory
                if (_startsWith(_snapshots[key].path, outputDir)) {
                    // Suppress unused variable warning
                    dirHash;

                    bytes32 pathHash = keccak256(abi.encodePacked(_snapshots[key].path));
                    delete _pathToSnapshot[pathHash];
                    delete _snapshots[key];
                    removed++;
                }
            }
        }

        emit CleanCompleted("ok", removed);
        return removed;
    }

    // --- Views ---

    /// @notice Get a snapshot entry by path
    /// @param path The snapshot path
    /// @return contentHash The baseline content hash
    /// @return statusVal The current status (0=Unchanged, 1=Changed, 2=New, 3=Approved, 4=Rejected)
    function getSnapshot(string memory path) external view returns (string memory contentHash, uint8 statusVal) {
        bytes32 pathHash = keccak256(abi.encodePacked(path));
        bytes32 snapshotId = _pathToSnapshot[pathHash];
        require(snapshotId != bytes32(0) && _snapshots[snapshotId].exists, "Snapshot not found");

        return (_snapshots[snapshotId].contentHash, uint8(_snapshots[snapshotId].status));
    }

    // --- Internal helpers ---

    /// @dev Check if a string starts with a prefix
    function _startsWith(string memory str, string memory prefix) internal pure returns (bool) {
        bytes memory s = bytes(str);
        bytes memory p = bytes(prefix);
        if (p.length > s.length) return false;
        for (uint256 i = 0; i < p.length; i++) {
            if (s[i] != p[i]) return false;
        }
        return true;
    }

    /// @dev Convert a bytes32 hash to a hex string representation
    function _hashToString(bytes32 value) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(66);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 32; i++) {
            str[2 + i * 2] = alphabet[uint8(value[i] >> 4)];
            str[3 + i * 2] = alphabet[uint8(value[i] & 0x0f)];
        }
        return string(str);
    }
}

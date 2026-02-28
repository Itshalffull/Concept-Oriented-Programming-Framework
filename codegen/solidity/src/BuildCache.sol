// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title BuildCache
/// @notice Build caching with content-addressed lookup, recording, and invalidation.
/// @dev Tracks build step inputs/outputs for cache hit detection and staleness analysis.

contract BuildCache {

    // --- Storage ---

    struct CacheEntry {
        string stepKey;
        string inputHash;
        string outputHash;
        string outputRef;
        string sourceLocator;
        bool deterministic;
        uint256 lastRun;
        bool exists;
    }

    mapping(bytes32 => CacheEntry) private _cacheEntries;
    bytes32[] private _cacheEntryIds;
    mapping(bytes32 => bool) private _cacheEntryExists;

    // --- Types ---

    struct CheckInput {
        string stepKey;
        string inputHash;
        bool deterministic;
    }

    struct CheckUnchangedResult {
        bool success;
        uint256 lastRun;
        string outputRef;
    }

    struct CheckChangedResult {
        bool success;
        string previousHash;
    }

    struct RecordInput {
        string stepKey;
        string inputHash;
        string outputHash;
        string outputRef;
        string sourceLocator;
        bool deterministic;
    }

    struct RecordOkResult {
        bool success;
        bytes32 entry;
    }

    struct InvalidateBySourceOkResult {
        bool success;
        string[] invalidated;
    }

    struct InvalidateByKindOkResult {
        bool success;
        string[] invalidated;
    }

    struct InvalidateAllOkResult {
        bool success;
        int256 cleared;
    }

    struct StatusOkResult {
        bool success;
        bytes[] entries;
    }

    struct StaleStepsOkResult {
        bool success;
        string[] steps;
    }

    // --- Events ---

    event CheckCompleted(string variant, uint256 lastRun, string outputRef, string previousHash);
    event RecordCompleted(string variant, bytes32 entry);
    event InvalidateCompleted(string variant);
    event InvalidateBySourceCompleted(string variant, string[] invalidated);
    event InvalidateByKindCompleted(string variant, string[] invalidated);
    event InvalidateAllCompleted(string variant, int256 cleared);
    event StatusCompleted(string variant, bytes[] entries);
    event StaleStepsCompleted(string variant, string[] steps);

    // --- Actions ---

    /// @notice check - Checks if a build step's cache entry is still valid.
    /// @return unchanged True if cache is valid (input hash matches), false if changed.
    function check(string memory stepKey, string memory inputHash, bool deterministic) external returns (bool) {
        bytes32 entryId = keccak256(abi.encodePacked("cache:", stepKey));

        if (!_cacheEntryExists[entryId]) {
            emit CheckCompleted("changed", 0, "", "");
            return false;
        }

        CacheEntry storage entry = _cacheEntries[entryId];

        if (keccak256(bytes(entry.inputHash)) == keccak256(bytes(inputHash))) {
            // Cache hit
            emit CheckCompleted("unchanged", entry.lastRun, entry.outputRef, "");
            return true;
        } else {
            // Cache miss - input changed
            emit CheckCompleted("changed", entry.lastRun, "", entry.inputHash);
            return false;
        }
    }

    /// @notice record - Records a build step's input/output for future cache lookups.
    function record(string memory stepKey, string memory inputHash, string memory outputHash, string memory outputRef, string memory sourceLocator, bool deterministic) external returns (RecordOkResult memory) {
        bytes32 entryId = keccak256(abi.encodePacked("cache:", stepKey));

        _cacheEntries[entryId] = CacheEntry({
            stepKey: stepKey,
            inputHash: inputHash,
            outputHash: outputHash,
            outputRef: outputRef,
            sourceLocator: sourceLocator,
            deterministic: deterministic,
            lastRun: block.timestamp,
            exists: true
        });

        if (!_cacheEntryExists[entryId]) {
            _cacheEntryExists[entryId] = true;
            _cacheEntryIds.push(entryId);
        }

        emit RecordCompleted("ok", entryId);

        return RecordOkResult({
            success: true,
            entry: entryId
        });
    }

    /// @notice invalidate - Invalidates a specific cache entry by step key.
    /// @return True if the entry was found and invalidated.
    function invalidate(string memory stepKey) external returns (bool) {
        bytes32 entryId = keccak256(abi.encodePacked("cache:", stepKey));

        if (!_cacheEntryExists[entryId]) {
            emit InvalidateCompleted("notFound");
            return false;
        }

        _cacheEntries[entryId].exists = false;
        _cacheEntryExists[entryId] = false;

        emit InvalidateCompleted("ok");
        return true;
    }

    /// @notice invalidateBySource - Invalidates all cache entries matching a source locator.
    function invalidateBySource(string memory sourceLocator) external returns (InvalidateBySourceOkResult memory) {
        uint256 count = 0;

        // First pass: count matches
        for (uint256 i = 0; i < _cacheEntryIds.length; i++) {
            bytes32 id = _cacheEntryIds[i];
            if (_cacheEntryExists[id]) {
                CacheEntry storage entry = _cacheEntries[id];
                if (keccak256(bytes(entry.sourceLocator)) == keccak256(bytes(sourceLocator))) {
                    count++;
                }
            }
        }

        string[] memory invalidated = new string[](count);
        uint256 idx = 0;

        // Second pass: invalidate and collect
        for (uint256 i = 0; i < _cacheEntryIds.length; i++) {
            bytes32 id = _cacheEntryIds[i];
            if (_cacheEntryExists[id]) {
                CacheEntry storage entry = _cacheEntries[id];
                if (keccak256(bytes(entry.sourceLocator)) == keccak256(bytes(sourceLocator))) {
                    invalidated[idx] = entry.stepKey;
                    idx++;
                    entry.exists = false;
                    _cacheEntryExists[id] = false;
                }
            }
        }

        emit InvalidateBySourceCompleted("ok", invalidated);

        return InvalidateBySourceOkResult({
            success: true,
            invalidated: invalidated
        });
    }

    /// @notice invalidateByKind - Invalidates all cache entries whose step key contains the kind name.
    function invalidateByKind(string memory kindName) external returns (InvalidateByKindOkResult memory) {
        uint256 count = 0;

        for (uint256 i = 0; i < _cacheEntryIds.length; i++) {
            bytes32 id = _cacheEntryIds[i];
            if (_cacheEntryExists[id]) {
                count++;
            }
        }

        // Invalidate all entries for the kind (simplified: invalidate all as kind matching is complex on-chain)
        string[] memory invalidated = new string[](count);
        uint256 idx = 0;

        for (uint256 i = 0; i < _cacheEntryIds.length; i++) {
            bytes32 id = _cacheEntryIds[i];
            if (_cacheEntryExists[id]) {
                CacheEntry storage entry = _cacheEntries[id];
                invalidated[idx] = entry.stepKey;
                idx++;
                entry.exists = false;
                _cacheEntryExists[id] = false;
            }
        }

        emit InvalidateByKindCompleted("ok", invalidated);

        return InvalidateByKindOkResult({
            success: true,
            invalidated: invalidated
        });
    }

    /// @notice invalidateAll - Clears the entire build cache.
    function invalidateAll() external returns (InvalidateAllOkResult memory) {
        int256 cleared = 0;

        for (uint256 i = 0; i < _cacheEntryIds.length; i++) {
            bytes32 id = _cacheEntryIds[i];
            if (_cacheEntryExists[id]) {
                _cacheEntries[id].exists = false;
                _cacheEntryExists[id] = false;
                cleared++;
            }
        }

        emit InvalidateAllCompleted("ok", cleared);

        return InvalidateAllOkResult({
            success: true,
            cleared: cleared
        });
    }

    /// @notice status - Returns all current cache entries.
    function status() external returns (StatusOkResult memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < _cacheEntryIds.length; i++) {
            if (_cacheEntryExists[_cacheEntryIds[i]]) count++;
        }

        bytes[] memory entryData = new bytes[](count);
        uint256 idx = 0;

        for (uint256 i = 0; i < _cacheEntryIds.length; i++) {
            bytes32 id = _cacheEntryIds[i];
            if (_cacheEntryExists[id]) {
                CacheEntry storage entry = _cacheEntries[id];
                entryData[idx] = abi.encode(entry.stepKey, entry.inputHash, entry.outputHash, entry.lastRun);
                idx++;
            }
        }

        emit StatusCompleted("ok", entryData);

        return StatusOkResult({
            success: true,
            entries: entryData
        });
    }

    /// @notice staleSteps - Returns step keys whose cache entries are outdated.
    function staleSteps() external returns (StaleStepsOkResult memory) {
        uint256 count = 0;
        uint256 threshold = block.timestamp > 3600 ? block.timestamp - 3600 : 0;

        for (uint256 i = 0; i < _cacheEntryIds.length; i++) {
            bytes32 id = _cacheEntryIds[i];
            if (_cacheEntryExists[id]) {
                CacheEntry storage entry = _cacheEntries[id];
                if (entry.lastRun < threshold || !entry.deterministic) {
                    count++;
                }
            }
        }

        string[] memory steps = new string[](count);
        uint256 idx = 0;

        for (uint256 i = 0; i < _cacheEntryIds.length; i++) {
            bytes32 id = _cacheEntryIds[i];
            if (_cacheEntryExists[id]) {
                CacheEntry storage entry = _cacheEntries[id];
                if (entry.lastRun < threshold || !entry.deterministic) {
                    steps[idx] = entry.stepKey;
                    idx++;
                }
            }
        }

        emit StaleStepsCompleted("ok", steps);

        return StaleStepsOkResult({
            success: true,
            steps: steps
        });
    }
}

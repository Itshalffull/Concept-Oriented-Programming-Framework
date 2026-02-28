// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SyncEntity
/// @notice Sync entity extraction and query for reactive sync specifications.
/// @dev Manages sync entities with deduplication, trigger-based lookups, and chain analysis.

contract SyncEntity {

    // --- Storage ---

    struct SyncData {
        string name;
        string source;
        string compiled;
        string annotations;
        string tier;
        uint256 whenPatternCount;
        uint256 thenActionCount;
        bool exists;
    }

    mapping(bytes32 => SyncData) private _syncs;
    bytes32[] private _syncIds;

    // Name-to-ID lookup for deduplication
    mapping(bytes32 => bytes32) private _nameToId;

    // Concept index: conceptHash => list of sync IDs
    mapping(bytes32 => bytes32[]) private _conceptIndex;

    // Trigger index: triggerHash (action+variant) => list of sync IDs
    mapping(bytes32 => bytes32[]) private _triggerIndex;

    // --- Types ---

    struct RegisterInput {
        string name;
        string source;
        string compiled;
    }

    struct RegisterOkResult {
        bool success;
        bytes32 sync;
    }

    struct RegisterAlreadyRegisteredResult {
        bool success;
        bytes32 existing;
    }

    struct FindByConceptOkResult {
        bool success;
        string syncs;
    }

    struct FindTriggerableByInput {
        string action;
        string variant;
    }

    struct FindTriggerableByOkResult {
        bool success;
        string syncs;
    }

    struct ChainFromInput {
        string action;
        string variant;
        int256 depth;
    }

    struct ChainFromOkResult {
        bool success;
        string chain;
    }

    struct FindDeadEndsOkResult {
        bool success;
        string deadEnds;
    }

    struct FindOrphanVariantsOkResult {
        bool success;
        string orphans;
    }

    struct GetOkResult {
        bool success;
        bytes32 sync;
        string name;
        string annotations;
        string tier;
        int256 whenPatternCount;
        int256 thenActionCount;
    }

    // --- Events ---

    event RegisterCompleted(string variant, bytes32 sync, bytes32 existing);
    event FindByConceptCompleted(string variant);
    event FindTriggerableByCompleted(string variant);
    event ChainFromCompleted(string variant);
    event FindDeadEndsCompleted(string variant);
    event FindOrphanVariantsCompleted(string variant);
    event GetCompleted(string variant, bytes32 sync, int256 whenPatternCount, int256 thenActionCount);

    // --- Actions ---

    /// @notice register
    function register(string memory name, string memory source, string memory compiled) external returns (RegisterOkResult memory) {
        require(bytes(name).length > 0, "Name must not be empty");

        bytes32 nameHash = keccak256(abi.encodePacked(name));
        bytes32 existingId = _nameToId[nameHash];

        // Deduplication: if already registered, return existing
        if (_syncs[existingId].exists) {
            emit RegisterCompleted("alreadyRegistered", bytes32(0), existingId);
            return RegisterOkResult({success: true, sync: existingId});
        }

        bytes32 syncId = keccak256(abi.encodePacked(name, source));
        _syncs[syncId] = SyncData({
            name: name,
            source: source,
            compiled: compiled,
            annotations: "",
            tier: "default",
            whenPatternCount: 0,
            thenActionCount: 0,
            exists: true
        });
        _syncIds.push(syncId);
        _nameToId[nameHash] = syncId;

        emit RegisterCompleted("ok", syncId, bytes32(0));
        return RegisterOkResult({success: true, sync: syncId});
    }

    /// @notice findByConcept
    function findByConcept(string memory concept) external returns (FindByConceptOkResult memory) {
        bytes32 conceptHash = keccak256(abi.encodePacked(concept));
        bytes32[] storage ids = _conceptIndex[conceptHash];

        string memory result = "";
        for (uint256 i = 0; i < ids.length; i++) {
            if (i > 0) {
                result = string(abi.encodePacked(result, ","));
            }
            result = string(abi.encodePacked(result, _syncs[ids[i]].name));
        }

        emit FindByConceptCompleted("ok");
        return FindByConceptOkResult({success: true, syncs: result});
    }

    /// @notice findTriggerableBy
    function findTriggerableBy(string memory action, string memory variant) external returns (FindTriggerableByOkResult memory) {
        bytes32 triggerHash = keccak256(abi.encodePacked(action, variant));
        bytes32[] storage ids = _triggerIndex[triggerHash];

        string memory result = "";
        for (uint256 i = 0; i < ids.length; i++) {
            if (i > 0) {
                result = string(abi.encodePacked(result, ","));
            }
            result = string(abi.encodePacked(result, _syncs[ids[i]].name));
        }

        emit FindTriggerableByCompleted("ok");
        return FindTriggerableByOkResult({success: true, syncs: result});
    }

    /// @notice chainFrom
    function chainFrom(string memory action, string memory variant, int256 depth) external returns (ChainFromOkResult memory) {
        require(depth >= 0, "Depth must be non-negative");

        bytes32 triggerHash = keccak256(abi.encodePacked(action, variant));
        bytes32[] storage ids = _triggerIndex[triggerHash];

        string memory chain = "";
        for (uint256 i = 0; i < ids.length; i++) {
            if (i > 0) {
                chain = string(abi.encodePacked(chain, " -> "));
            }
            chain = string(abi.encodePacked(chain, _syncs[ids[i]].name));
        }

        emit ChainFromCompleted("ok");
        return ChainFromOkResult({success: true, chain: chain});
    }

    /// @notice findDeadEnds
    function findDeadEnds() external returns (FindDeadEndsOkResult memory) {
        // Syncs with zero then-actions are dead ends
        string memory result = "";
        uint256 count = 0;
        for (uint256 i = 0; i < _syncIds.length; i++) {
            SyncData storage s = _syncs[_syncIds[i]];
            if (s.thenActionCount == 0) {
                if (count > 0) {
                    result = string(abi.encodePacked(result, ","));
                }
                result = string(abi.encodePacked(result, s.name));
                count++;
            }
        }

        emit FindDeadEndsCompleted("ok");
        return FindDeadEndsOkResult({success: true, deadEnds: result});
    }

    /// @notice findOrphanVariants
    function findOrphanVariants() external returns (FindOrphanVariantsOkResult memory) {
        // Syncs with zero when-patterns are orphans
        string memory result = "";
        uint256 count = 0;
        for (uint256 i = 0; i < _syncIds.length; i++) {
            SyncData storage s = _syncs[_syncIds[i]];
            if (s.whenPatternCount == 0) {
                if (count > 0) {
                    result = string(abi.encodePacked(result, ","));
                }
                result = string(abi.encodePacked(result, s.name));
                count++;
            }
        }

        emit FindOrphanVariantsCompleted("ok");
        return FindOrphanVariantsOkResult({success: true, orphans: result});
    }

    /// @notice get
    function get(bytes32 sync) external returns (GetOkResult memory) {
        require(_syncs[sync].exists, "Sync not found");

        SyncData storage data = _syncs[sync];

        emit GetCompleted("ok", sync, int256(data.whenPatternCount), int256(data.thenActionCount));
        return GetOkResult({
            success: true,
            sync: sync,
            name: data.name,
            annotations: data.annotations,
            tier: data.tier,
            whenPatternCount: int256(data.whenPatternCount),
            thenActionCount: int256(data.thenActionCount)
        });
    }

}

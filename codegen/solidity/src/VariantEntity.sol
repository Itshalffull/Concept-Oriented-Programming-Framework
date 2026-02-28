// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title VariantEntity
/// @notice Variant entity extraction and query for action variant specifications.
/// @dev Manages variant entities with action-based lookups, sync matching, and dead variant detection.

contract VariantEntity {

    // --- Storage ---

    struct VariantData {
        string action;
        string tag;
        string fields;
        bool exists;
    }

    mapping(bytes32 => VariantData) private _variants;
    bytes32[] private _variantIds;

    // Action index: actionHash => list of variant IDs
    mapping(bytes32 => bytes32[]) private _actionIndex;

    // Track sync associations for isDead check
    mapping(bytes32 => uint256) private _syncCount;
    mapping(bytes32 => uint256) private _runtimeCount;

    // --- Types ---

    struct RegisterInput {
        string action;
        string tag;
        string fields;
    }

    struct RegisterOkResult {
        bool success;
        bytes32 variant;
    }

    struct MatchingSyncsOkResult {
        bool success;
        string syncs;
    }

    struct IsDeadDeadResult {
        bool success;
        string noMatchingSyncs;
        string noRuntimeOccurrences;
    }

    struct IsDeadAliveResult {
        bool success;
        int256 syncCount;
        int256 runtimeCount;
    }

    struct GetOkResult {
        bool success;
        bytes32 variant;
        string action;
        string tag;
        string fields;
    }

    // --- Events ---

    event RegisterCompleted(string variant);
    event MatchingSyncsCompleted(string variant);
    event IsDeadCompleted(string variant, int256 syncCount, int256 runtimeCount);
    event GetCompleted(string variant);

    // --- Actions ---

    /// @notice register
    function register(string memory action, string memory tag, string memory fields) external returns (RegisterOkResult memory) {
        require(bytes(action).length > 0, "Action must not be empty");
        require(bytes(tag).length > 0, "Tag must not be empty");

        bytes32 variantId = keccak256(abi.encodePacked(action, tag));
        require(!_variants[variantId].exists, "Variant already registered");

        _variants[variantId] = VariantData({
            action: action,
            tag: tag,
            fields: fields,
            exists: true
        });
        _variantIds.push(variantId);

        bytes32 actionHash = keccak256(abi.encodePacked(action));
        _actionIndex[actionHash].push(variantId);

        emit RegisterCompleted("ok");
        return RegisterOkResult({success: true, variant: variantId});
    }

    /// @notice matchingSyncs
    function matchingSyncs(bytes32 variant) external returns (MatchingSyncsOkResult memory) {
        require(_variants[variant].exists, "Variant not found");

        // Sync matching requires cross-contract lookup; return stored count reference
        emit MatchingSyncsCompleted("ok");
        return MatchingSyncsOkResult({success: true, syncs: ""});
    }

    /// @notice isDead
    function isDead(bytes32 variant) external returns (bool) {
        require(_variants[variant].exists, "Variant not found");

        uint256 sc = _syncCount[variant];
        uint256 rc = _runtimeCount[variant];
        bool dead = (sc == 0) && (rc == 0);

        emit IsDeadCompleted(
            dead ? "dead" : "alive",
            int256(sc),
            int256(rc)
        );
        return dead;
    }

    /// @notice get
    function get(bytes32 variant) external returns (GetOkResult memory) {
        require(_variants[variant].exists, "Variant not found");

        VariantData storage data = _variants[variant];

        emit GetCompleted("ok");
        return GetOkResult({
            success: true,
            variant: variant,
            action: data.action,
            tag: data.tag,
            fields: data.fields
        });
    }

}

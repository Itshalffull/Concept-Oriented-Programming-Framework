// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ActionEntity
/// @notice Action entity extraction and query for concept specifications.
/// @dev Manages action entities keyed by concept, with variant references and lookup support.

contract ActionEntity {

    // --- Storage ---

    struct ActionData {
        string concept;
        string name;
        string params;
        string variantRefs;
        bool exists;
    }

    mapping(bytes32 => ActionData) private _actions;
    bytes32[] private _actionIds;

    // Concept-to-action index: conceptHash => list of action IDs
    mapping(bytes32 => bytes32[]) private _conceptIndex;

    // --- Types ---

    struct RegisterInput {
        string concept;
        string name;
        string params;
        string variantRefs;
    }

    struct RegisterOkResult {
        bool success;
        bytes32 action;
    }

    struct FindByConceptOkResult {
        bool success;
        string actions;
    }

    struct TriggeringSyncsOkResult {
        bool success;
        string syncs;
    }

    struct InvokingSyncsOkResult {
        bool success;
        string syncs;
    }

    struct ImplementationsOkResult {
        bool success;
        string symbols;
    }

    struct InterfaceExposuresOkResult {
        bool success;
        string exposures;
    }

    struct GetOkResult {
        bool success;
        bytes32 action;
        string concept;
        string name;
        string params;
        int256 variantCount;
    }

    // --- Events ---

    event RegisterCompleted(string variant, bytes32 action);
    event FindByConceptCompleted(string variant);
    event TriggeringSyncsCompleted(string variant);
    event InvokingSyncsCompleted(string variant);
    event ImplementationsCompleted(string variant);
    event InterfaceExposuresCompleted(string variant);
    event GetCompleted(string variant, bytes32 action, int256 variantCount);

    // --- Actions ---

    /// @notice register
    function register(string memory concept, string memory name, string memory params, string memory variantRefs) external returns (RegisterOkResult memory) {
        bytes32 actionId = keccak256(abi.encodePacked(concept, name));
        require(!_actions[actionId].exists, "Action already registered");
        require(bytes(concept).length > 0, "Concept must not be empty");
        require(bytes(name).length > 0, "Name must not be empty");

        _actions[actionId] = ActionData({
            concept: concept,
            name: name,
            params: params,
            variantRefs: variantRefs,
            exists: true
        });
        _actionIds.push(actionId);

        bytes32 conceptHash = keccak256(abi.encodePacked(concept));
        _conceptIndex[conceptHash].push(actionId);

        emit RegisterCompleted("ok", actionId);
        return RegisterOkResult({success: true, action: actionId});
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
            result = string(abi.encodePacked(result, _actions[ids[i]].name));
        }

        emit FindByConceptCompleted("ok");
        return FindByConceptOkResult({success: true, actions: result});
    }

    /// @notice triggeringSyncs
    function triggeringSyncs(bytes32 action) external returns (TriggeringSyncsOkResult memory) {
        require(_actions[action].exists, "Action not found");

        emit TriggeringSyncsCompleted("ok");
        return TriggeringSyncsOkResult({success: true, syncs: ""});
    }

    /// @notice invokingSyncs
    function invokingSyncs(bytes32 action) external returns (InvokingSyncsOkResult memory) {
        require(_actions[action].exists, "Action not found");

        emit InvokingSyncsCompleted("ok");
        return InvokingSyncsOkResult({success: true, syncs: ""});
    }

    /// @notice implementations
    function implementations(bytes32 action) external returns (ImplementationsOkResult memory) {
        require(_actions[action].exists, "Action not found");

        emit ImplementationsCompleted("ok");
        return ImplementationsOkResult({success: true, symbols: ""});
    }

    /// @notice interfaceExposures
    function interfaceExposures(bytes32 action) external returns (InterfaceExposuresOkResult memory) {
        require(_actions[action].exists, "Action not found");

        emit InterfaceExposuresCompleted("ok");
        return InterfaceExposuresOkResult({success: true, exposures: ""});
    }

    /// @notice get
    function get(bytes32 action) external returns (GetOkResult memory) {
        require(_actions[action].exists, "Action not found");

        ActionData storage data = _actions[action];
        int256 variantCount = int256(_countVariants(data.variantRefs));

        emit GetCompleted("ok", action, variantCount);
        return GetOkResult({
            success: true,
            action: action,
            concept: data.concept,
            name: data.name,
            params: data.params,
            variantCount: variantCount
        });
    }

    /// @dev Count comma-separated variant references
    function _countVariants(string memory refs) internal pure returns (uint256) {
        bytes memory b = bytes(refs);
        if (b.length == 0) return 0;
        uint256 count = 1;
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == ",") count++;
        }
        return count;
    }

}

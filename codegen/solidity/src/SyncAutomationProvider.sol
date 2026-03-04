// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SyncAutomationProvider
/// @notice Sync-definition-driven automation provider
/// @dev Implements the SyncAutomationProvider concept from Clef specification.
///      Manages sync definitions as automation sources with lifecycle states and execution.

contract SyncAutomationProvider {

    // --- Types ---

    enum SyncState { Defined, Validated, Active, Suspended }

    struct RegisterOkResult {
        bool success;
        bytes32 providerId;
    }

    struct RegisterAlreadyRegisteredErrorResult {
        bool success;
        string message;
    }

    struct DefineOkResult {
        bool success;
        bytes32 syncDefId;
        string name;
    }

    struct DefineDuplicateErrorResult {
        bool success;
        string message;
    }

    struct ValidateOkResult {
        bool success;
        bytes32 syncDefId;
    }

    struct ValidateInvalidErrorResult {
        bool success;
        string message;
    }

    struct ActivateOkResult {
        bool success;
        bytes32 syncDefId;
    }

    struct ActivateInvalidStateErrorResult {
        bool success;
        string message;
    }

    struct SuspendOkResult {
        bool success;
        bytes32 syncDefId;
    }

    struct SuspendInvalidStateErrorResult {
        bool success;
        string message;
    }

    struct ExecuteOkResult {
        bool success;
        bytes32 executionId;
        bytes32 actionKey;
    }

    struct ExecuteNotFoundErrorResult {
        bool success;
        string message;
    }

    struct ExecuteRuntimeErrorResult {
        bool success;
        string message;
    }

    // --- Storage ---

    /// @dev Whether this provider has been registered
    bool private _registered;

    /// @dev The provider ID assigned at registration
    bytes32 private _providerId;

    /// @dev Maps sync definition ID to existence
    mapping(bytes32 => bool) private _syncDefs;

    /// @dev Ordered list of sync definition IDs
    bytes32[] private _syncDefKeys;

    /// @dev Maps sync definition ID to its lifecycle state
    mapping(bytes32 => SyncState) private _syncStates;

    /// @dev Maps sync definition ID to its name
    mapping(bytes32 => string) private _syncNames;

    /// @dev Maps sync definition ID to its source text
    mapping(bytes32 => string) private _syncSources;

    /// @dev Maps sync definition ID to its author
    mapping(bytes32 => string) private _syncAuthors;

    /// @dev Maps action key to the sync definition that provides it
    mapping(bytes32 => bytes32) private _actionToSyncDef;

    /// @dev Maps action key to existence
    mapping(bytes32 => bool) private _actions;

    /// @dev Maps execution ID to existence
    mapping(bytes32 => bool) private _executions;

    /// @dev Ordered list of execution IDs
    bytes32[] private _executionKeys;

    // --- Events ---

    event RegisterCompleted(string variant, bytes32 id);
    event DefineCompleted(string variant, bytes32 id);
    event ValidateCompleted(string variant, bytes32 id);
    event ActivateCompleted(string variant, bytes32 id);
    event SuspendCompleted(string variant, bytes32 id);
    event ExecuteCompleted(string variant, bytes32 id);

    // --- Metadata ---

    /// @notice Returns static provider metadata
    /// @return name The provider name
    /// @return category The provider category
    function metadata() external pure returns (string memory name, string memory category) {
        return ("sync-automation", "automation-provider");
    }

    // --- Actions ---

    /// @notice register — register this provider instance
    function register() external returns (RegisterOkResult memory) {
        require(!_registered, "Provider already registered");

        bytes32 providerId = keccak256(abi.encodePacked(
            "sync-automation", "automation-provider", block.timestamp
        ));

        _registered = true;
        _providerId = providerId;

        emit RegisterCompleted("ok", providerId);

        return RegisterOkResult({success: true, providerId: providerId});
    }

    /// @notice define — create a new sync definition
    function define(
        string calldata name,
        string calldata sourceText,
        string calldata author
    ) external returns (DefineOkResult memory) {
        require(_registered, "Provider not registered");

        bytes32 syncDefId = keccak256(abi.encodePacked(
            _providerId, name, block.timestamp, _syncDefKeys.length
        ));
        require(!_syncDefs[syncDefId], "Sync definition already exists");

        _syncDefs[syncDefId] = true;
        _syncDefKeys.push(syncDefId);
        _syncStates[syncDefId] = SyncState.Defined;
        _syncNames[syncDefId] = name;
        _syncSources[syncDefId] = sourceText;
        _syncAuthors[syncDefId] = author;

        // Register an action key for this sync definition
        bytes32 actionKey = keccak256(abi.encodePacked(syncDefId, name));
        _actions[actionKey] = true;
        _actionToSyncDef[actionKey] = syncDefId;

        emit DefineCompleted("ok", syncDefId);

        return DefineOkResult({success: true, syncDefId: syncDefId, name: name});
    }

    /// @notice validate — validate a sync definition, advancing its state
    function validate(bytes32 syncDef) external returns (ValidateOkResult memory) {
        require(_registered, "Provider not registered");
        require(_syncDefs[syncDef], "Sync definition not found");
        require(
            _syncStates[syncDef] == SyncState.Defined,
            "Sync definition must be in Defined state to validate"
        );

        _syncStates[syncDef] = SyncState.Validated;

        emit ValidateCompleted("ok", syncDef);

        return ValidateOkResult({success: true, syncDefId: syncDef});
    }

    /// @notice activate — activate a validated sync definition
    function activate(bytes32 syncDef) external returns (ActivateOkResult memory) {
        require(_registered, "Provider not registered");
        require(_syncDefs[syncDef], "Sync definition not found");
        require(
            _syncStates[syncDef] == SyncState.Validated,
            "Sync definition must be in Validated state to activate"
        );

        _syncStates[syncDef] = SyncState.Active;

        emit ActivateCompleted("ok", syncDef);

        return ActivateOkResult({success: true, syncDefId: syncDef});
    }

    /// @notice suspend — suspend an active sync definition
    function suspend(bytes32 syncDef) external returns (SuspendOkResult memory) {
        require(_registered, "Provider not registered");
        require(_syncDefs[syncDef], "Sync definition not found");
        require(
            _syncStates[syncDef] == SyncState.Active,
            "Sync definition must be in Active state to suspend"
        );

        _syncStates[syncDef] = SyncState.Suspended;

        emit SuspendCompleted("ok", syncDef);

        return SuspendOkResult({success: true, syncDefId: syncDef});
    }

    /// @notice execute — execute an action by reference with the given input
    function execute(
        string calldata actionRef,
        string calldata input
    ) external returns (ExecuteOkResult memory) {
        require(_registered, "Provider not registered");

        bytes32 actionKey = keccak256(abi.encodePacked(actionRef));
        require(_actions[actionKey], "Action not found");

        bytes32 syncDefId = _actionToSyncDef[actionKey];
        require(
            _syncStates[syncDefId] == SyncState.Active,
            "Sync definition must be Active to execute"
        );

        bytes32 executionId = keccak256(abi.encodePacked(
            actionKey, input, block.timestamp, _executionKeys.length
        ));

        _executions[executionId] = true;
        _executionKeys.push(executionId);

        emit ExecuteCompleted("ok", executionId);

        return ExecuteOkResult({success: true, executionId: executionId, actionKey: actionKey});
    }

}

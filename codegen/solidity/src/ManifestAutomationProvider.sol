// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ManifestAutomationProvider
/// @notice Manifest-driven automation provider
/// @dev Implements the ManifestAutomationProvider concept from Clef specification.
///      Loads automation rules from manifest declarations and provides execution and lookup.

contract ManifestAutomationProvider {

    // --- Types ---

    struct RegisterOkResult {
        bool success;
        bytes32 providerId;
    }

    struct RegisterAlreadyRegisteredErrorResult {
        bool success;
        string message;
    }

    struct LoadOkResult {
        bool success;
        bytes32 manifestId;
        uint256 entryCount;
    }

    struct LoadParseErrorResult {
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

    struct LookupOkResult {
        bool success;
        bytes32 actionKey;
        bool exists;
    }

    struct LookupNotFoundErrorResult {
        bool success;
        string message;
    }

    // --- Storage ---

    /// @dev Whether this provider has been registered
    bool private _registered;

    /// @dev The provider ID assigned at registration
    bytes32 private _providerId;

    /// @dev Maps manifest ID to existence
    mapping(bytes32 => bool) private _manifests;

    /// @dev Ordered list of manifest IDs
    bytes32[] private _manifestKeys;

    /// @dev Maps manifest ID to its entry count
    mapping(bytes32 => uint256) private _manifestEntryCount;

    /// @dev Maps action key to existence (loaded from manifests)
    mapping(bytes32 => bool) private _actions;

    /// @dev Ordered list of action keys
    bytes32[] private _actionKeys;

    /// @dev Maps execution ID to existence
    mapping(bytes32 => bool) private _executions;

    /// @dev Ordered list of execution IDs
    bytes32[] private _executionKeys;

    // --- Events ---

    event RegisterCompleted(string variant, bytes32 id);
    event LoadCompleted(string variant, bytes32 id);
    event ExecuteCompleted(string variant, bytes32 id);
    event LookupCompleted(string variant, bytes32 id);

    // --- Metadata ---

    /// @notice Returns static provider metadata
    /// @return name The provider name
    /// @return category The provider category
    function metadata() external pure returns (string memory name, string memory category) {
        return ("manifest-automation", "automation-provider");
    }

    // --- Actions ---

    /// @notice register — register this provider instance
    function register() external returns (RegisterOkResult memory) {
        require(!_registered, "Provider already registered");

        bytes32 providerId = keccak256(abi.encodePacked(
            "manifest-automation", "automation-provider", block.timestamp
        ));

        _registered = true;
        _providerId = providerId;

        emit RegisterCompleted("ok", providerId);

        return RegisterOkResult({success: true, providerId: providerId});
    }

    /// @notice load — load automation entries from a manifest path
    function load(string calldata manifestPath) external returns (LoadOkResult memory) {
        require(_registered, "Provider not registered");

        bytes32 manifestId = keccak256(abi.encodePacked(
            _providerId, manifestPath, block.timestamp, _manifestKeys.length
        ));

        _manifests[manifestId] = true;
        _manifestKeys.push(manifestId);

        // Manifest loading registers one placeholder action entry per load
        bytes32 actionKey = keccak256(abi.encodePacked(manifestId, manifestPath));
        _actions[actionKey] = true;
        _actionKeys.push(actionKey);
        _manifestEntryCount[manifestId] = 1;

        emit LoadCompleted("ok", manifestId);

        return LoadOkResult({success: true, manifestId: manifestId, entryCount: 1});
    }

    /// @notice execute — execute an action by reference with the given input
    function execute(
        string calldata actionRef,
        string calldata input
    ) external returns (ExecuteOkResult memory) {
        require(_registered, "Provider not registered");

        bytes32 actionKey = keccak256(abi.encodePacked(actionRef));
        require(_actions[actionKey], "Action not found");

        bytes32 executionId = keccak256(abi.encodePacked(
            actionKey, input, block.timestamp, _executionKeys.length
        ));

        _executions[executionId] = true;
        _executionKeys.push(executionId);

        emit ExecuteCompleted("ok", executionId);

        return ExecuteOkResult({success: true, executionId: executionId, actionKey: actionKey});
    }

    /// @notice lookup — check whether an action reference exists
    function lookup(string calldata actionRef) external returns (LookupOkResult memory) {
        require(_registered, "Provider not registered");

        bytes32 actionKey = keccak256(abi.encodePacked(actionRef));
        bool exists = _actions[actionKey];

        emit LookupCompleted("ok", actionKey);

        return LookupOkResult({success: true, actionKey: actionKey, exists: exists});
    }

}

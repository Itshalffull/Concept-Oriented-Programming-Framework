// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Binding
/// @notice Data binding management linking concept state to UI elements with synchronization.
contract Binding {

    // --- Storage ---

    struct BindingEntry {
        bytes32 concept;
        string mode;
        bool bound;
        uint256 lastSyncAt;
        uint256 createdAt;
    }

    mapping(bytes32 => BindingEntry) private _bindings;
    mapping(bytes32 => bool) private _exists;

    // --- Types ---

    struct BindOkResult {
        bool success;
        bytes32 binding;
    }

    struct SyncOkResult {
        bool success;
        bytes32 binding;
    }

    struct InvokeOkResult {
        bool success;
        bytes32 binding;
        string result;
    }

    struct UnbindOkResult {
        bool success;
        bytes32 binding;
    }

    // --- Events ---

    event BindCompleted(string variant, bytes32 indexed binding);
    event SyncCompleted(string variant, bytes32 indexed binding);
    event InvokeCompleted(string variant, bytes32 indexed binding);
    event UnbindCompleted(string variant, bytes32 indexed binding);

    // --- Actions ---

    /// @notice Create a binding between a concept and UI element with a given mode.
    function bind(bytes32 binding, bytes32 concept, string memory mode) external returns (BindOkResult memory) {
        require(!_exists[binding], "Binding already exists");
        // Validate mode
        bytes32 modeHash = keccak256(bytes(mode));
        require(
            modeHash == keccak256(bytes("static")) ||
            modeHash == keccak256(bytes("reactive")) ||
            modeHash == keccak256(bytes("two-way")),
            "Invalid binding mode"
        );

        _bindings[binding] = BindingEntry({
            concept: concept,
            mode: mode,
            bound: true,
            lastSyncAt: block.timestamp,
            createdAt: block.timestamp
        });
        _exists[binding] = true;

        emit BindCompleted("ok", binding);
        return BindOkResult({success: true, binding: binding});
    }

    /// @notice Synchronize a binding, refreshing the data link.
    function sync(bytes32 binding) external returns (SyncOkResult memory) {
        require(_exists[binding], "Binding not found");
        require(_bindings[binding].bound, "Binding not active");

        _bindings[binding].lastSyncAt = block.timestamp;

        emit SyncCompleted("ok", binding);
        return SyncOkResult({success: true, binding: binding});
    }

    /// @notice Invoke an action through a binding.
    function invoke(bytes32 binding, string memory action, string memory input) external returns (InvokeOkResult memory) {
        require(_exists[binding], "Binding not found");
        require(_bindings[binding].bound, "Binding not active");

        string memory result = input;

        emit InvokeCompleted("ok", binding);
        return InvokeOkResult({success: true, binding: binding, result: result});
    }

    /// @notice Unbind a binding, disconnecting the data link.
    function unbind(bytes32 binding) external returns (UnbindOkResult memory) {
        require(_exists[binding], "Binding not found");

        _bindings[binding].bound = false;
        delete _bindings[binding];
        _exists[binding] = false;

        emit UnbindCompleted("ok", binding);
        return UnbindOkResult({success: true, binding: binding});
    }

}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AutomationDispatch
/// @notice Automation dispatch coordinator
/// @dev Implements the AutomationDispatch concept from Clef specification.
///      Routes automation rule execution to registered providers based on rule references.

contract AutomationDispatch {

    // --- Types ---

    struct DispatchOkResult {
        bool success;
        bytes32 dispatchId;
        string providerName;
    }

    struct DispatchNotFoundErrorResult {
        bool success;
        string message;
    }

    struct DispatchExecutionErrorResult {
        bool success;
        string message;
    }

    struct ListProvidersOkResult {
        bool success;
        uint256 count;
    }

    struct ListProvidersEmptyErrorResult {
        bool success;
        string message;
    }

    // --- Storage ---

    /// @dev Maps provider name hash to existence
    mapping(bytes32 => bool) private _providers;

    /// @dev Maps provider name hash to provider name string
    mapping(bytes32 => string) private _providerNames;

    /// @dev Ordered list of provider name hashes
    bytes32[] private _providerKeys;

    /// @dev Maps dispatch ID to existence
    mapping(bytes32 => bool) private _dispatches;

    /// @dev Ordered list of dispatch IDs
    bytes32[] private _dispatchKeys;

    /// @dev Maps dispatch ID to the provider name hash it was routed to
    mapping(bytes32 => bytes32) private _dispatchProvider;

    // --- Events ---

    event DispatchCompleted(string variant, bytes32 id);
    event ListProvidersCompleted(string variant, bytes32 id);

    // --- Actions ---

    /// @notice dispatch — route a rule execution to the named provider
    function dispatch(
        string calldata ruleRef,
        string calldata providerName,
        string calldata context
    ) external returns (DispatchOkResult memory) {
        bytes32 providerKey = keccak256(abi.encodePacked(providerName));
        require(_providers[providerKey], "Provider not registered");

        bytes32 dispatchId = keccak256(abi.encodePacked(
            ruleRef, providerName, context, block.timestamp, _dispatchKeys.length
        ));

        _dispatches[dispatchId] = true;
        _dispatchKeys.push(dispatchId);
        _dispatchProvider[dispatchId] = providerKey;

        emit DispatchCompleted("ok", dispatchId);

        return DispatchOkResult({success: true, dispatchId: dispatchId, providerName: providerName});
    }

    /// @notice listProviders — enumerate all registered providers
    function listProviders() external view returns (ListProvidersOkResult memory) {
        return ListProvidersOkResult({success: true, count: _providerKeys.length});
    }

    // --- Internal helpers ---

    /// @notice registerProvider — add a provider so dispatch can route to it
    function registerProvider(string calldata providerName) external {
        bytes32 providerKey = keccak256(abi.encodePacked(providerName));
        require(!_providers[providerKey], "Provider already registered");

        _providers[providerKey] = true;
        _providerNames[providerKey] = providerName;
        _providerKeys.push(providerKey);
    }

}

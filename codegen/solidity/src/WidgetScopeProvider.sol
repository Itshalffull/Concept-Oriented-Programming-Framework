// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title WidgetScopeProvider
/// @notice Scope provider for widget specification definitions
/// @dev Implements the WidgetScopeProvider concept from Clef specification.
///      Provides "widget" scope analysis capability in the "scope-provider" category.

contract WidgetScopeProvider {

    // --- Types ---

    struct InitializeOkResult {
        bool success;
        bytes32 instance;
    }

    struct InitializeLoadErrorResult {
        bool success;
        string message;
    }

    // --- Events ---

    event InitializeCompleted(string variant, bytes32 instance);

    // --- Actions ---

    /// @notice Register this scope provider and return its metadata
    /// @return name The provider name ("widget")
    /// @return category The provider category ("scope-provider")
    function register() external pure returns (string memory name, string memory category) {
        return ("widget", "scope-provider");
    }

    /// @notice initialize
    function initialize() external returns (InitializeOkResult memory) {
        bytes32 instanceId = keccak256(abi.encodePacked("widget", "scope-provider", block.timestamp, block.number));

        emit InitializeCompleted("ok", instanceId);

        return InitializeOkResult({
            success: true,
            instance: instanceId
        });
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title WidgetSpecSymbolExtractor
/// @notice Symbol extractor for widget specification files
/// @dev Implements the WidgetSpecSymbolExtractor concept from Clef specification.
///      Provides "widget-spec" symbol extraction capability in the "symbol-extractor" category.

contract WidgetSpecSymbolExtractor {

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

    /// @notice Register this extractor and return its metadata
    /// @return name The extractor name ("widget-spec")
    /// @return category The extractor category ("symbol-extractor")
    function register() external pure returns (string memory name, string memory category) {
        return ("widget-spec", "symbol-extractor");
    }

    /// @notice initialize
    function initialize() external returns (InitializeOkResult memory) {
        bytes32 instanceId = keccak256(abi.encodePacked("widget-spec", "symbol-extractor", block.timestamp, block.number));

        emit InitializeCompleted("ok", instanceId);

        return InitializeOkResult({
            success: true,
            instance: instanceId
        });
    }
}

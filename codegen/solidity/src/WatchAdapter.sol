// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title WatchAdapter
/// @notice Platform adapter for smartwatch environments (watchOS, Wear OS).
///         Normalizes Clef widget props into watch-compatible form.
/// @dev Skeleton contract — implement action bodies

contract WatchAdapter {

    // --- Storage (from concept state) ---

    /// @dev Stores normalized props per adapter: adapter id => encoded normalized props
    mapping(bytes32 => bytes) private normalizedProps;

    // --- Types ---

    struct NormalizeInput {
        bytes32 adapter;
        string props;
    }

    struct NormalizeOkResult {
        bool success;
        bytes32 adapter;
        string normalized;
    }

    struct NormalizeErrorResult {
        bool success;
        string message;
    }

    // --- Events ---

    event NormalizeCompleted(string variant, bytes32 adapter);

    // --- Actions ---

    /// @notice Returns static metadata for this platform adapter.
    function register()
        external
        pure
        returns (string memory name, string memory category, string[] memory platforms)
    {
        name = "watch";
        category = "platform-adapter";
        platforms = new string[](2);
        platforms[0] = "watchos";
        platforms[1] = "wearos";
    }

    /// @notice Normalize widget props for the watch platform.
    function normalize(bytes32 adapter, string memory props) external returns (NormalizeOkResult memory) {
        require(bytes(props).length > 0, "Props must not be empty");

        string memory normalized = string(abi.encodePacked("watch:", props));
        normalizedProps[adapter] = abi.encode(normalized);

        emit NormalizeCompleted("ok", adapter);

        return NormalizeOkResult({
            success: true,
            adapter: adapter,
            normalized: normalized
        });
    }

}

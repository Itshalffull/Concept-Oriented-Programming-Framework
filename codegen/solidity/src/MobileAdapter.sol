// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MobileAdapter
/// @notice Platform adapter for mobile environments (iOS, Android).
///         Normalizes Clef widget props into mobile-compatible form.
/// @dev Skeleton contract — implement action bodies

contract MobileAdapter {

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
        name = "mobile";
        category = "platform-adapter";
        platforms = new string[](2);
        platforms[0] = "ios";
        platforms[1] = "android";
    }

    /// @notice Normalize widget props for the mobile platform.
    function normalize(bytes32 adapter, string memory props) external returns (NormalizeOkResult memory) {
        require(bytes(props).length > 0, "Props must not be empty");

        string memory normalized = string(abi.encodePacked("mobile:", props));
        normalizedProps[adapter] = abi.encode(normalized);

        emit NormalizeCompleted("ok", adapter);

        return NormalizeOkResult({
            success: true,
            adapter: adapter,
            normalized: normalized
        });
    }

}

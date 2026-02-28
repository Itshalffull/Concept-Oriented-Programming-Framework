// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title BrowserAdapter
/// @notice Platform adapter for web browser environments.
///         Normalizes Clef widget props into browser-compatible form.
/// @dev Skeleton contract — implement action bodies

contract BrowserAdapter {

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
        name = "browser";
        category = "platform-adapter";
        platforms = new string[](1);
        platforms[0] = "web";
    }

    /// @notice Normalize widget props for the browser platform.
    function normalize(bytes32 adapter, string memory props) external returns (NormalizeOkResult memory) {
        require(bytes(props).length > 0, "Props must not be empty");

        // Store normalized output keyed by adapter
        string memory normalized = string(abi.encodePacked("browser:", props));
        normalizedProps[adapter] = abi.encode(normalized);

        emit NormalizeCompleted("ok", adapter);

        return NormalizeOkResult({
            success: true,
            adapter: adapter,
            normalized: normalized
        });
    }

}

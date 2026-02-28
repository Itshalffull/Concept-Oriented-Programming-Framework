// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DesktopAdapter
/// @notice Platform adapter for desktop environments (macOS, Windows, Linux).
///         Normalizes Clef widget props into desktop-compatible form.
/// @dev Skeleton contract — implement action bodies

contract DesktopAdapter {

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
        name = "desktop";
        category = "platform-adapter";
        platforms = new string[](3);
        platforms[0] = "macos";
        platforms[1] = "windows";
        platforms[2] = "linux";
    }

    /// @notice Normalize widget props for the desktop platform.
    function normalize(bytes32 adapter, string memory props) external returns (NormalizeOkResult memory) {
        require(bytes(props).length > 0, "Props must not be empty");

        string memory normalized = string(abi.encodePacked("desktop:", props));
        normalizedProps[adapter] = abi.encode(normalized);

        emit NormalizeCompleted("ok", adapter);

        return NormalizeOkResult({
            success: true,
            adapter: adapter,
            normalized: normalized
        });
    }

}

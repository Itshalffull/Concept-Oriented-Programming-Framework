// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title NextjsAdapter
/// @notice Render adapter for the Next.js framework.
///         Normalizes Clef widget props into Next.js-compatible form.
/// @dev Skeleton contract — implement action bodies

contract NextjsAdapter {

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

    /// @notice Returns static metadata for this render adapter.
    function register()
        external
        pure
        returns (string memory name, string memory category, string memory framework)
    {
        name = "nextjs";
        category = "render-adapter";
        framework = "nextjs";
    }

    /// @notice Normalize widget props for the Next.js framework.
    function normalize(bytes32 adapter, string memory props) external returns (NormalizeOkResult memory) {
        require(bytes(props).length > 0, "Props must not be empty");

        string memory normalized = string(abi.encodePacked("nextjs:", props));
        normalizedProps[adapter] = abi.encode(normalized);

        emit NormalizeCompleted("ok", adapter);

        return NormalizeOkResult({
            success: true,
            adapter: adapter,
            normalized: normalized
        });
    }

}

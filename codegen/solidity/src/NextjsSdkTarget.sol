// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title NextjsSdkTarget
/// @notice SDK-target provider that generates Next.js SDK packages from concept projections.
/// @dev Produces TypeScript packages with React hooks and API route handlers.

contract NextjsSdkTarget {

    // --- Storage ---

    /// @dev Maps package hash to whether it exists
    mapping(bytes32 => bool) private packages;
    bytes32[] private packagesKeys;

    /// @dev Maps package hash to its projection source
    mapping(bytes32 => string) private packageProjections;

    /// @dev Counter of total generations
    uint256 private generationCount;

    // --- Types ---

    struct GenerateInput {
        string projection;
        string config;
    }

    struct GenerateOkResult {
        bool success;
        bytes32 package_;
        string[] files;
    }

    // --- Events ---

    event GenerateCompleted(string variant, bytes32 package_, string[] files);

    // --- Registration ---

    /// @notice Returns static metadata for this target provider.
    function register()
        external
        pure
        returns (string memory name, string memory category, string memory language)
    {
        name = "nextjs-sdk";
        category = "sdk-target";
        language = "typescript";
    }

    // --- Actions ---

    /// @notice Generate a Next.js SDK package from a concept projection
    function generate(string memory projection, string memory config) external returns (GenerateOkResult memory) {
        require(bytes(projection).length > 0, "Projection cannot be empty");

        bytes32 pkgHash = keccak256(abi.encodePacked(projection, config, generationCount));
        generationCount++;

        if (!packages[pkgHash]) {
            packages[pkgHash] = true;
            packagesKeys.push(pkgHash);
        }
        packageProjections[pkgHash] = projection;

        string[] memory files = new string[](4);
        files[0] = string(abi.encodePacked(projection, "/index.ts"));
        files[1] = string(abi.encodePacked(projection, "/hooks.ts"));
        files[2] = string(abi.encodePacked(projection, "/api.ts"));
        files[3] = string(abi.encodePacked(projection, "/package.json"));

        emit GenerateCompleted("ok", pkgHash, files);

        return GenerateOkResult({
            success: true,
            package_: pkgHash,
            files: files
        });
    }

}

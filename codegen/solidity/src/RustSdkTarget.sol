// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title RustSdkTarget
/// @notice SDK-target provider that generates Rust SDK crates from concept projections.
/// @dev Produces Cargo-compatible crate structure with typed client implementations.

contract RustSdkTarget {

    // --- Storage ---

    /// @dev Maps crate hash to whether it exists
    mapping(bytes32 => bool) private crates;
    bytes32[] private cratesKeys;

    /// @dev Maps crate hash to its projection source
    mapping(bytes32 => string) private crateProjections;

    /// @dev Counter of total generations
    uint256 private generationCount;

    // --- Types ---

    struct GenerateInput {
        string projection;
        string config;
    }

    struct GenerateOkResult {
        bool success;
        bytes32 crateHash;
        string[] files;
    }

    // --- Events ---

    event GenerateCompleted(string variant, bytes32 crateHash, string[] files);

    // --- Registration ---

    /// @notice Returns static metadata for this target provider.
    function register()
        external
        pure
        returns (string memory name, string memory category, string memory language)
    {
        name = "rust-sdk";
        category = "sdk-target";
        language = "rust";
    }

    // --- Actions ---

    /// @notice Generate a Rust SDK crate from a concept projection
    function generate(string memory projection, string memory config) external returns (GenerateOkResult memory) {
        require(bytes(projection).length > 0, "Projection cannot be empty");

        bytes32 crateId = keccak256(abi.encodePacked(projection, config, generationCount));
        generationCount++;

        if (!crates[crateId]) {
            crates[crateId] = true;
            cratesKeys.push(crateId);
        }
        crateProjections[crateId] = projection;

        string[] memory files = new string[](3);
        files[0] = string(abi.encodePacked(projection, "/src/lib.rs"));
        files[1] = string(abi.encodePacked(projection, "/src/client.rs"));
        files[2] = string(abi.encodePacked(projection, "/Cargo.toml"));

        emit GenerateCompleted("ok", crateId, files);

        return GenerateOkResult({
            success: true,
            crateHash: crateId,
            files: files
        });
    }

}

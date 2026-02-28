// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TypeScriptToolchain
/// @notice TypeScript toolchain provider. Resolves and registers the TypeScript compiler toolchain.
contract TypeScriptToolchain {

    // --- Storage ---

    struct ToolchainRecord {
        string platform;
        string versionConstraint;
        string tscPath;
        string version;
        string[] capabilities;
        uint256 timestamp;
        bool exists;
    }

    mapping(bytes32 => ToolchainRecord) private _toolchains;
    bytes32[] private _toolchainIds;

    // --- Types ---

    struct ResolveInput {
        string platform;
        string versionConstraint;
    }

    struct ResolveOkResult {
        bool success;
        bytes32 toolchain;
        string tscPath;
        string version;
        string[] capabilities;
    }

    struct ResolveNotInstalledResult {
        bool success;
        string installHint;
    }

    struct ResolveNodeVersionMismatchResult {
        bool success;
        string installed;
        string required;
    }

    struct RegisterOkResult {
        bool success;
        string name;
        string language;
        string[] capabilities;
    }

    // --- Events ---

    event ResolveCompleted(string variant, bytes32 toolchain, string[] capabilities);
    event RegisterCompleted(string variant, string[] capabilities);

    // --- Actions ---

    /// @notice resolve - Resolves the TypeScript toolchain for a given platform and version constraint.
    function resolve(string memory platform, string memory versionConstraint) external returns (ResolveOkResult memory) {
        require(bytes(platform).length > 0, "Platform must not be empty");

        bytes32 tcId = keccak256(abi.encodePacked("typescript", platform, versionConstraint));

        if (!_toolchains[tcId].exists) {
            string[] memory caps = new string[](4);
            caps[0] = "tsc";
            caps[1] = "node";
            caps[2] = "npm";
            caps[3] = "tsx";

            _toolchains[tcId] = ToolchainRecord({
                platform: platform,
                versionConstraint: versionConstraint,
                tscPath: "/usr/local/bin/tsc",
                version: versionConstraint,
                capabilities: caps,
                timestamp: block.timestamp,
                exists: true
            });
            _toolchainIds.push(tcId);
        }

        ToolchainRecord storage rec = _toolchains[tcId];

        emit ResolveCompleted("ok", tcId, rec.capabilities);

        return ResolveOkResult({
            success: true,
            toolchain: tcId,
            tscPath: rec.tscPath,
            version: rec.version,
            capabilities: rec.capabilities
        });
    }

    /// @notice register - Returns static metadata for the TypeScript toolchain provider.
    function register() external pure returns (RegisterOkResult memory) {
        string[] memory caps = new string[](4);
        caps[0] = "tsc";
        caps[1] = "node";
        caps[2] = "npm";
        caps[3] = "tsx";

        return RegisterOkResult({
            success: true,
            name: "typescript-toolchain",
            language: "typescript",
            capabilities: caps
        });
    }

}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SolidityToolchain
/// @notice Solidity toolchain provider. Resolves and registers the Solidity compiler toolchain.
contract SolidityToolchain {

    // --- Storage ---

    struct ToolchainRecord {
        string platform;
        string versionConstraint;
        string solcPath;
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
        string solcPath;
        string version;
        string[] capabilities;
    }

    struct ResolveNotInstalledResult {
        bool success;
        string installHint;
    }

    struct ResolveEvmVersionUnsupportedResult {
        bool success;
        string requested;
        string[] supported;
    }

    struct RegisterOkResult {
        bool success;
        string name;
        string language;
        string[] capabilities;
    }

    // --- Events ---

    event ResolveCompleted(string variant, bytes32 toolchain, string[] capabilities, string[] supported);
    event RegisterCompleted(string variant, string[] capabilities);

    // --- Actions ---

    /// @notice resolve - Resolves the Solidity toolchain for a given platform and version constraint.
    function resolve(string memory platform, string memory versionConstraint) external returns (ResolveOkResult memory) {
        require(bytes(platform).length > 0, "Platform must not be empty");

        bytes32 tcId = keccak256(abi.encodePacked("solidity", platform, versionConstraint));

        if (!_toolchains[tcId].exists) {
            string[] memory caps = new string[](3);
            caps[0] = "solc";
            caps[1] = "forge";
            caps[2] = "cast";

            _toolchains[tcId] = ToolchainRecord({
                platform: platform,
                versionConstraint: versionConstraint,
                solcPath: "/usr/local/bin/solc",
                version: versionConstraint,
                capabilities: caps,
                timestamp: block.timestamp,
                exists: true
            });
            _toolchainIds.push(tcId);
        }

        ToolchainRecord storage rec = _toolchains[tcId];

        string[] memory emptySupported;
        emit ResolveCompleted("ok", tcId, rec.capabilities, emptySupported);

        return ResolveOkResult({
            success: true,
            toolchain: tcId,
            solcPath: rec.solcPath,
            version: rec.version,
            capabilities: rec.capabilities
        });
    }

    /// @notice register - Returns static metadata for the Solidity toolchain provider.
    function register() external pure returns (RegisterOkResult memory) {
        string[] memory caps = new string[](3);
        caps[0] = "solc";
        caps[1] = "forge";
        caps[2] = "cast";

        return RegisterOkResult({
            success: true,
            name: "solidity-toolchain",
            language: "solidity",
            capabilities: caps
        });
    }

}

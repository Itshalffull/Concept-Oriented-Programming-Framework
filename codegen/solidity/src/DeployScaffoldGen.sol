// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DeployScaffoldGen
/// @notice Scaffold generator for Clef deployment manifests
/// @dev Implements the DeployScaffoldGen concept from Clef specification.
///      Provider contract: register() is pure and returns static metadata.
///      generate() produces deployment scaffold files from an app definition.
///      preview() returns what would be generated without persisting.

contract DeployScaffoldGen {

    // --- Storage (from concept state) ---

    // entries
    mapping(bytes32 => bytes) private _entries;

    // manifests
    mapping(bytes32 => bool) private _manifests;
    bytes32[] private _manifestsKeys;

    // --- Types ---

    struct GenerateInput {
        string appName;
        bytes[] runtimes;
        bytes[] concepts;
    }

    struct GenerateOkResult {
        bool success;
        bytes[] files;
        int256 filesGenerated;
    }

    struct GenerateErrorResult {
        bool success;
        string message;
    }

    struct PreviewInput {
        string appName;
        bytes[] runtimes;
        bytes[] concepts;
    }

    struct PreviewOkResult {
        bool success;
        bytes[] files;
        int256 wouldWrite;
        int256 wouldSkip;
    }

    struct PreviewErrorResult {
        bool success;
        string message;
    }

    struct RegisterOkResult {
        bool success;
        string name;
        string inputKind;
        string outputKind;
        string[] capabilities;
    }

    // --- Events ---

    event GenerateCompleted(string variant, bytes[] files, int256 filesGenerated);
    event PreviewCompleted(string variant, bytes[] files, int256 wouldWrite, int256 wouldSkip);
    event RegisterCompleted(string variant, string[] capabilities);

    // --- Actions ---

    /// @notice register - returns static provider metadata for this scaffold generator
    /// @return result The provider metadata (name, inputKind, outputKind, capabilities)
    function register() external pure returns (RegisterOkResult memory result) {
        string[] memory capabilities = new string[](3);
        capabilities[0] = "deploy-manifest";
        capabilities[1] = "runtime-config";
        capabilities[2] = "concept-binding";

        result = RegisterOkResult({
            success: true,
            name: "deploy-scaffold-gen",
            inputKind: "deploy-spec",
            outputKind: "scaffold-files",
            capabilities: capabilities
        });
    }

    /// @notice generate - produces deployment scaffold files and persists the generation record
    /// @param appName The application name for the deployment
    /// @param runtimes The target runtime definitions
    /// @param concepts The concept bindings for the deployment
    /// @return result The generation result with produced files
    function generate(
        string memory appName,
        bytes[] memory runtimes,
        bytes[] memory concepts
    ) external returns (GenerateOkResult memory result) {
        require(bytes(appName).length > 0, "App name cannot be empty");
        require(runtimes.length > 0, "At least one runtime is required");

        bytes32 manifestId = keccak256(abi.encodePacked(appName));

        // Build scaffold files: deploy manifest + one config per runtime
        uint256 fileCount = 1 + runtimes.length;
        bytes[] memory files = new bytes[](fileCount);

        // Primary deployment manifest
        files[0] = abi.encodePacked(
            "// Deploy scaffold: ", appName,
            "\n// Runtimes: ", _uint2str(runtimes.length),
            "\n// Concepts: ", _uint2str(concepts.length)
        );

        // Runtime configuration files
        for (uint256 i = 0; i < runtimes.length; i++) {
            files[i + 1] = abi.encodePacked(
                "// Runtime config scaffold: ", _uint2str(i),
                "\n// App: ", appName,
                "\n// Runtime data size: ", _uint2str(runtimes[i].length)
            );
        }

        // Persist generation record
        _entries[manifestId] = abi.encode(appName, runtimes.length, concepts.length, block.timestamp);
        if (!_manifests[manifestId]) {
            _manifests[manifestId] = true;
            _manifestsKeys.push(manifestId);
        }

        int256 filesGenerated = int256(fileCount);

        result = GenerateOkResult({
            success: true,
            files: files,
            filesGenerated: filesGenerated
        });

        emit GenerateCompleted("ok", files, filesGenerated);
    }

    /// @notice preview - returns what would be generated without persisting
    /// @param appName The application name for the deployment
    /// @param runtimes The target runtime definitions
    /// @param concepts The concept bindings for the deployment
    /// @return result The preview result with files that would be produced
    function preview(
        string memory appName,
        bytes[] memory runtimes,
        bytes[] memory concepts
    ) external view returns (PreviewOkResult memory result) {
        require(bytes(appName).length > 0, "App name cannot be empty");
        require(runtimes.length > 0, "At least one runtime is required");

        bytes32 manifestId = keccak256(abi.encodePacked(appName));

        uint256 fileCount = 1 + runtimes.length;
        bytes[] memory files = new bytes[](fileCount);

        files[0] = abi.encodePacked(
            "// Deploy scaffold: ", appName,
            "\n// Runtimes: ", _uint2str(runtimes.length),
            "\n// Concepts: ", _uint2str(concepts.length)
        );

        for (uint256 i = 0; i < runtimes.length; i++) {
            files[i + 1] = abi.encodePacked(
                "// Runtime config scaffold: ", _uint2str(i),
                "\n// App: ", appName,
                "\n// Runtime data size: ", _uint2str(runtimes[i].length)
            );
        }

        int256 wouldSkip = _manifests[manifestId] ? int256(1) : int256(0);
        int256 wouldWrite = int256(fileCount) - wouldSkip;

        result = PreviewOkResult({
            success: true,
            files: files,
            wouldWrite: wouldWrite,
            wouldSkip: wouldSkip
        });
    }

    // --- Views ---

    /// @notice Check if a deployment scaffold has been generated
    /// @param appName The app name to check
    /// @return Whether the scaffold exists
    function hasManifest(string memory appName) external view returns (bool) {
        return _manifests[keccak256(abi.encodePacked(appName))];
    }

    /// @notice Get the number of generated deployment scaffolds
    /// @return The count of generated scaffolds
    function manifestCount() external view returns (uint256) {
        return _manifestsKeys.length;
    }

    // --- Internal ---

    /// @dev Convert a uint to its string representation
    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}

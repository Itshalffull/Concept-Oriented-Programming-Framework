// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title KitScaffoldGen
/// @notice Scaffold generator for Clef suite (kit) definitions
/// @dev Implements the KitScaffoldGen concept from Clef specification.
///      Provider contract: register() is pure and returns static metadata.
///      generate() produces suite scaffold files from a kit definition.
///      preview() returns what would be generated without persisting.

contract KitScaffoldGen {

    // --- Storage (from concept state) ---

    // entries
    mapping(bytes32 => bytes) private _entries;

    // kits
    mapping(bytes32 => bool) private _kits;
    bytes32[] private _kitsKeys;

    // --- Types ---

    struct GenerateInput {
        string name;
        string description;
        string[] concepts;
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
        string name;
        string description;
        string[] concepts;
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
        capabilities[0] = "suite-scaffold";
        capabilities[1] = "suite-manifest";
        capabilities[2] = "concept-listing";

        result = RegisterOkResult({
            success: true,
            name: "kit-scaffold-gen",
            inputKind: "kit-definition",
            outputKind: "scaffold-files",
            capabilities: capabilities
        });
    }

    /// @notice generate - produces suite scaffold files and persists the generation record
    /// @param name The suite (kit) name
    /// @param description The suite description
    /// @param concepts The concept names included in the suite
    /// @return result The generation result with produced files
    function generate(
        string memory name,
        string memory description,
        string[] memory concepts
    ) external returns (GenerateOkResult memory result) {
        require(bytes(name).length > 0, "Kit name cannot be empty");
        require(bytes(description).length > 0, "Description cannot be empty");

        bytes32 kitId = keccak256(abi.encodePacked(name));

        // Build scaffold files: suite manifest + directory scaffold
        bytes[] memory files = new bytes[](2);

        // Suite manifest (suite.yaml scaffold)
        files[0] = abi.encodePacked(
            "// Suite scaffold: ", name,
            "\n// Description: ", description,
            "\n// Concepts: ", _uint2str(concepts.length)
        );

        // Suite directory structure scaffold
        files[1] = abi.encodePacked(
            "// Suite directory scaffold: ", name,
            "\n// Concept entries: ", _uint2str(concepts.length)
        );

        // Persist generation record
        _entries[kitId] = abi.encode(name, description, concepts.length, block.timestamp);
        if (!_kits[kitId]) {
            _kits[kitId] = true;
            _kitsKeys.push(kitId);
        }

        int256 filesGenerated = int256(2);

        result = GenerateOkResult({
            success: true,
            files: files,
            filesGenerated: filesGenerated
        });

        emit GenerateCompleted("ok", files, filesGenerated);
    }

    /// @notice preview - returns what would be generated without persisting
    /// @param name The suite (kit) name
    /// @param description The suite description
    /// @param concepts The concept names included in the suite
    /// @return result The preview result with files that would be produced
    function preview(
        string memory name,
        string memory description,
        string[] memory concepts
    ) external view returns (PreviewOkResult memory result) {
        require(bytes(name).length > 0, "Kit name cannot be empty");
        require(bytes(description).length > 0, "Description cannot be empty");

        bytes32 kitId = keccak256(abi.encodePacked(name));

        bytes[] memory files = new bytes[](2);

        files[0] = abi.encodePacked(
            "// Suite scaffold: ", name,
            "\n// Description: ", description,
            "\n// Concepts: ", _uint2str(concepts.length)
        );

        files[1] = abi.encodePacked(
            "// Suite directory scaffold: ", name,
            "\n// Concept entries: ", _uint2str(concepts.length)
        );

        int256 wouldSkip = _kits[kitId] ? int256(1) : int256(0);
        int256 wouldWrite = int256(2) - wouldSkip;

        result = PreviewOkResult({
            success: true,
            files: files,
            wouldWrite: wouldWrite,
            wouldSkip: wouldSkip
        });
    }

    // --- Views ---

    /// @notice Check if a suite scaffold has been generated
    /// @param name The suite name to check
    /// @return Whether the scaffold exists
    function hasKit(string memory name) external view returns (bool) {
        return _kits[keccak256(abi.encodePacked(name))];
    }

    /// @notice Get the number of generated suite scaffolds
    /// @return The count of generated scaffolds
    function kitCount() external view returns (uint256) {
        return _kitsKeys.length;
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

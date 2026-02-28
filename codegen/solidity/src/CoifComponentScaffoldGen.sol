// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CoifComponentScaffoldGen
/// @notice Scaffold generator for Clef UI component specifications
/// @dev Implements the CoifComponentScaffoldGen concept from Clef specification.
///      Provider contract: register() is pure and returns static metadata.
///      generate() produces component scaffold files from a component definition.
///      preview() returns what would be generated without persisting.

contract CoifComponentScaffoldGen {

    // --- Storage (from concept state) ---

    // entries
    mapping(bytes32 => bytes) private _entries;

    // components
    mapping(bytes32 => bool) private _components;
    bytes32[] private _componentsKeys;

    // --- Types ---

    struct GenerateInput {
        string name;
        string[] parts;
        string[] states;
        string[] events;
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
        string[] parts;
        string[] states;
        string[] events;
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
        capabilities[0] = "component-scaffold";
        capabilities[1] = "parts-generation";
        capabilities[2] = "event-wiring";

        result = RegisterOkResult({
            success: true,
            name: "coif-component-scaffold-gen",
            inputKind: "component-spec",
            outputKind: "scaffold-files",
            capabilities: capabilities
        });
    }

    /// @notice generate - produces component scaffold files and persists the generation record
    /// @param name The component name
    /// @param parts The component parts (sub-elements)
    /// @param states The component state fields
    /// @param events The component event handlers
    /// @return result The generation result with produced files
    function generate(
        string memory name,
        string[] memory parts,
        string[] memory states,
        string[] memory events
    ) external returns (GenerateOkResult memory result) {
        require(bytes(name).length > 0, "Component name cannot be empty");

        bytes32 componentId = keccak256(abi.encodePacked(name));

        // Build scaffold files: component definition + parts + state + events
        // File count: 1 base component + 1 per part (minimum 1 file)
        uint256 fileCount = 1 + parts.length;
        bytes[] memory files = new bytes[](fileCount);

        // Primary component scaffold file
        files[0] = abi.encodePacked(
            "// Component scaffold: ", name,
            "\n// Parts: ", _uint2str(parts.length),
            "\n// States: ", _uint2str(states.length),
            "\n// Events: ", _uint2str(events.length)
        );

        // Part scaffold files
        for (uint256 i = 0; i < parts.length; i++) {
            files[i + 1] = abi.encodePacked(
                "// Part scaffold: ", parts[i],
                "\n// Parent component: ", name
            );
        }

        // Persist generation record
        _entries[componentId] = abi.encode(name, parts.length, states.length, events.length, block.timestamp);
        if (!_components[componentId]) {
            _components[componentId] = true;
            _componentsKeys.push(componentId);
        }

        result = GenerateOkResult({
            success: true,
            files: files,
            filesGenerated: int256(fileCount)
        });

        emit GenerateCompleted("ok", files, int256(fileCount));
    }

    /// @notice preview - returns what would be generated without persisting
    /// @param name The component name
    /// @param parts The component parts (sub-elements)
    /// @param states The component state fields
    /// @param events The component event handlers
    /// @return result The preview result with files that would be produced
    function preview(
        string memory name,
        string[] memory parts,
        string[] memory states,
        string[] memory events
    ) external view returns (PreviewOkResult memory result) {
        require(bytes(name).length > 0, "Component name cannot be empty");

        bytes32 componentId = keccak256(abi.encodePacked(name));

        uint256 fileCount = 1 + parts.length;
        bytes[] memory files = new bytes[](fileCount);

        // Primary component scaffold file
        files[0] = abi.encodePacked(
            "// Component scaffold: ", name,
            "\n// Parts: ", _uint2str(parts.length),
            "\n// States: ", _uint2str(states.length),
            "\n// Events: ", _uint2str(events.length)
        );

        // Part scaffold files
        for (uint256 i = 0; i < parts.length; i++) {
            files[i + 1] = abi.encodePacked(
                "// Part scaffold: ", parts[i],
                "\n// Parent component: ", name
            );
        }

        // Determine how many would be new writes vs skips
        int256 wouldSkip = _components[componentId] ? int256(1) : int256(0);
        int256 wouldWrite = int256(fileCount) - wouldSkip;

        result = PreviewOkResult({
            success: true,
            files: files,
            wouldWrite: wouldWrite,
            wouldSkip: wouldSkip
        });
    }

    // --- Views ---

    /// @notice Check if a component scaffold has been generated
    /// @param name The component name to check
    /// @return Whether the scaffold exists
    function hasComponent(string memory name) external view returns (bool) {
        return _components[keccak256(abi.encodePacked(name))];
    }

    /// @notice Get the number of generated component scaffolds
    /// @return The count of generated scaffolds
    function componentCount() external view returns (uint256) {
        return _componentsKeys.length;
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

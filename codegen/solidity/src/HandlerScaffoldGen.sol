// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title HandlerScaffoldGen
/// @notice Scaffold generator for Clef concept handler implementations
/// @dev Implements the HandlerScaffoldGen concept from Clef specification.
///      Provider contract: register() is pure and returns static metadata.
///      generate() produces handler scaffold files from concept action definitions.
///      preview() returns what would be generated without persisting.

contract HandlerScaffoldGen {

    // --- Storage (from concept state) ---

    // entries
    mapping(bytes32 => bytes) private _entries;

    // handlers
    mapping(bytes32 => bool) private _handlers;
    bytes32[] private _handlersKeys;

    // --- Types ---

    struct GenerateInput {
        string conceptName;
        bytes[] actions;
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
        string conceptName;
        bytes[] actions;
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
        capabilities[0] = "handler-scaffold";
        capabilities[1] = "action-stubs";
        capabilities[2] = "type-imports";

        result = RegisterOkResult({
            success: true,
            name: "handler-scaffold-gen",
            inputKind: "concept-actions",
            outputKind: "scaffold-files",
            capabilities: capabilities
        });
    }

    /// @notice generate - produces handler scaffold files and persists the generation record
    /// @param conceptName The concept name to generate a handler for
    /// @param actions The action definitions to scaffold
    /// @return result The generation result with produced files
    function generate(
        string memory conceptName,
        bytes[] memory actions
    ) external returns (GenerateOkResult memory result) {
        require(bytes(conceptName).length > 0, "Concept name cannot be empty");
        require(actions.length > 0, "At least one action is required");

        bytes32 handlerId = keccak256(abi.encodePacked(conceptName));

        // Build scaffold files: handler implementation + test file
        bytes[] memory files = new bytes[](2);

        // Handler implementation scaffold
        files[0] = abi.encodePacked(
            "// Handler scaffold: ", conceptName,
            "\n// Actions: ", _uint2str(actions.length)
        );

        // Handler test scaffold
        files[1] = abi.encodePacked(
            "// Handler test scaffold: ", conceptName,
            "\n// Test cases for ", _uint2str(actions.length), " actions"
        );

        // Persist generation record
        _entries[handlerId] = abi.encode(conceptName, actions.length, block.timestamp);
        if (!_handlers[handlerId]) {
            _handlers[handlerId] = true;
            _handlersKeys.push(handlerId);
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
    /// @param conceptName The concept name to generate a handler for
    /// @param actions The action definitions to scaffold
    /// @return result The preview result with files that would be produced
    function preview(
        string memory conceptName,
        bytes[] memory actions
    ) external view returns (PreviewOkResult memory result) {
        require(bytes(conceptName).length > 0, "Concept name cannot be empty");
        require(actions.length > 0, "At least one action is required");

        bytes32 handlerId = keccak256(abi.encodePacked(conceptName));

        bytes[] memory files = new bytes[](2);

        files[0] = abi.encodePacked(
            "// Handler scaffold: ", conceptName,
            "\n// Actions: ", _uint2str(actions.length)
        );

        files[1] = abi.encodePacked(
            "// Handler test scaffold: ", conceptName,
            "\n// Test cases for ", _uint2str(actions.length), " actions"
        );

        int256 wouldSkip = _handlers[handlerId] ? int256(1) : int256(0);
        int256 wouldWrite = int256(2) - wouldSkip;

        result = PreviewOkResult({
            success: true,
            files: files,
            wouldWrite: wouldWrite,
            wouldSkip: wouldSkip
        });
    }

    // --- Views ---

    /// @notice Check if a handler scaffold has been generated
    /// @param conceptName The concept name to check
    /// @return Whether the scaffold exists
    function hasHandler(string memory conceptName) external view returns (bool) {
        return _handlers[keccak256(abi.encodePacked(conceptName))];
    }

    /// @notice Get the number of generated handler scaffolds
    /// @return The count of generated scaffolds
    function handlerCount() external view returns (uint256) {
        return _handlersKeys.length;
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

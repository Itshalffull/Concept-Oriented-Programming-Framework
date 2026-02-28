// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ConceptScaffoldGen
/// @notice Scaffold generator for Clef concept specifications
/// @dev Implements the ConceptScaffoldGen concept from Clef specification.
///      Provider contract: register() is pure and returns static metadata.
///      generate() produces concept spec scaffold files from a concept definition.
///      preview() returns what would be generated without persisting.

contract ConceptScaffoldGen {

    // --- Storage (from concept state) ---

    // entries
    mapping(bytes32 => bytes) private _entries;

    // specs
    mapping(bytes32 => bool) private _specs;
    bytes32[] private _specsKeys;

    // --- Types ---

    struct GenerateInput {
        string name;
        string typeParam;
        string purpose;
        bytes[] stateFields;
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
        string name;
        string typeParam;
        string purpose;
        bytes[] stateFields;
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
        capabilities[0] = "concept-spec";
        capabilities[1] = "state-fields";
        capabilities[2] = "action-signatures";

        result = RegisterOkResult({
            success: true,
            name: "concept-scaffold-gen",
            inputKind: "concept-definition",
            outputKind: "scaffold-files",
            capabilities: capabilities
        });
    }

    /// @notice generate - produces concept scaffold files and persists the generation record
    /// @param name The concept name
    /// @param typeParam The type parameter for the concept
    /// @param purpose The concept purpose description
    /// @param stateFields The concept state field definitions
    /// @param actions The concept action definitions
    /// @return result The generation result with produced files
    function generate(
        string memory name,
        string memory typeParam,
        string memory purpose,
        bytes[] memory stateFields,
        bytes[] memory actions
    ) external returns (GenerateOkResult memory result) {
        require(bytes(name).length > 0, "Concept name cannot be empty");
        require(bytes(purpose).length > 0, "Purpose cannot be empty");

        bytes32 specId = keccak256(abi.encodePacked(name));

        // Build scaffold files: concept spec + handler stub
        bytes[] memory files = new bytes[](2);

        // Concept spec scaffold
        files[0] = abi.encodePacked(
            "// Concept spec scaffold: ", name,
            "\n// Type: ", typeParam,
            "\n// Purpose: ", purpose,
            "\n// State fields: ", _uint2str(stateFields.length),
            "\n// Actions: ", _uint2str(actions.length)
        );

        // Handler stub scaffold
        files[1] = abi.encodePacked(
            "// Handler scaffold: ", name,
            "\n// Actions to implement: ", _uint2str(actions.length)
        );

        // Persist generation record
        _entries[specId] = abi.encode(name, typeParam, purpose, stateFields.length, actions.length, block.timestamp);
        if (!_specs[specId]) {
            _specs[specId] = true;
            _specsKeys.push(specId);
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
    /// @param name The concept name
    /// @param typeParam The type parameter for the concept
    /// @param purpose The concept purpose description
    /// @param stateFields The concept state field definitions
    /// @param actions The concept action definitions
    /// @return result The preview result with files that would be produced
    function preview(
        string memory name,
        string memory typeParam,
        string memory purpose,
        bytes[] memory stateFields,
        bytes[] memory actions
    ) external view returns (PreviewOkResult memory result) {
        require(bytes(name).length > 0, "Concept name cannot be empty");
        require(bytes(purpose).length > 0, "Purpose cannot be empty");

        bytes32 specId = keccak256(abi.encodePacked(name));

        bytes[] memory files = new bytes[](2);

        files[0] = abi.encodePacked(
            "// Concept spec scaffold: ", name,
            "\n// Type: ", typeParam,
            "\n// Purpose: ", purpose,
            "\n// State fields: ", _uint2str(stateFields.length),
            "\n// Actions: ", _uint2str(actions.length)
        );

        files[1] = abi.encodePacked(
            "// Handler scaffold: ", name,
            "\n// Actions to implement: ", _uint2str(actions.length)
        );

        int256 wouldSkip = _specs[specId] ? int256(1) : int256(0);
        int256 wouldWrite = int256(2) - wouldSkip;

        result = PreviewOkResult({
            success: true,
            files: files,
            wouldWrite: wouldWrite,
            wouldSkip: wouldSkip
        });
    }

    // --- Views ---

    /// @notice Check if a concept scaffold has been generated
    /// @param name The concept name to check
    /// @return Whether the scaffold exists
    function hasSpec(string memory name) external view returns (bool) {
        return _specs[keccak256(abi.encodePacked(name))];
    }

    /// @notice Get the number of generated concept scaffolds
    /// @return The count of generated scaffolds
    function specCount() external view returns (uint256) {
        return _specsKeys.length;
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

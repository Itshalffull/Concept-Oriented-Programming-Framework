// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SyncScaffoldGen
/// @notice Scaffold generator for Clef sync specifications
/// @dev Implements the SyncScaffoldGen concept from Clef specification.
///      Provider contract: register() is pure and returns static metadata.
///      generate() produces sync scaffold files from a sync definition.
///      preview() returns what would be generated without persisting.

contract SyncScaffoldGen {

    // --- Storage (from concept state) ---

    // entries
    mapping(bytes32 => bytes) private _entries;

    // specs
    mapping(bytes32 => bool) private _specs;
    bytes32[] private _specsKeys;

    // --- Types ---

    struct GenerateInput {
        string name;
        bytes trigger;
        bytes[] effects;
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
        bytes trigger;
        bytes[] effects;
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
        capabilities[0] = "sync-scaffold";
        capabilities[1] = "trigger-definition";
        capabilities[2] = "effect-wiring";

        result = RegisterOkResult({
            success: true,
            name: "sync-scaffold-gen",
            inputKind: "sync-spec",
            outputKind: "scaffold-files",
            capabilities: capabilities
        });
    }

    /// @notice generate - produces sync scaffold files and persists the generation record
    /// @param name The sync specification name
    /// @param trigger The trigger definition for the sync rule
    /// @param effects The effect definitions triggered by the sync rule
    /// @return result The generation result with produced files
    function generate(
        string memory name,
        bytes memory trigger,
        bytes[] memory effects
    ) external returns (GenerateOkResult memory result) {
        require(bytes(name).length > 0, "Sync name cannot be empty");
        require(trigger.length > 0, "Trigger cannot be empty");

        bytes32 specId = keccak256(abi.encodePacked(name));

        // Build scaffold files: sync spec + handler
        bytes[] memory files = new bytes[](2);

        // Sync specification scaffold
        files[0] = abi.encodePacked(
            "// Sync scaffold: ", name,
            "\n// Trigger size: ", _uint2str(trigger.length),
            "\n// Effects: ", _uint2str(effects.length)
        );

        // Sync handler scaffold
        files[1] = abi.encodePacked(
            "// Sync handler scaffold: ", name,
            "\n// Effect handlers: ", _uint2str(effects.length)
        );

        // Persist generation record
        _entries[specId] = abi.encode(name, trigger.length, effects.length, block.timestamp);
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
    /// @param name The sync specification name
    /// @param trigger The trigger definition for the sync rule
    /// @param effects The effect definitions triggered by the sync rule
    /// @return result The preview result with files that would be produced
    function preview(
        string memory name,
        bytes memory trigger,
        bytes[] memory effects
    ) external view returns (PreviewOkResult memory result) {
        require(bytes(name).length > 0, "Sync name cannot be empty");
        require(trigger.length > 0, "Trigger cannot be empty");

        bytes32 specId = keccak256(abi.encodePacked(name));

        bytes[] memory files = new bytes[](2);

        files[0] = abi.encodePacked(
            "// Sync scaffold: ", name,
            "\n// Trigger size: ", _uint2str(trigger.length),
            "\n// Effects: ", _uint2str(effects.length)
        );

        files[1] = abi.encodePacked(
            "// Sync handler scaffold: ", name,
            "\n// Effect handlers: ", _uint2str(effects.length)
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

    /// @notice Check if a sync scaffold has been generated
    /// @param name The sync name to check
    /// @return Whether the scaffold exists
    function hasSpec(string memory name) external view returns (bool) {
        return _specs[keccak256(abi.encodePacked(name))];
    }

    /// @notice Get the number of generated sync scaffolds
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

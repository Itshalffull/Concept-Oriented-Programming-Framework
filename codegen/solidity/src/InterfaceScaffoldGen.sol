// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title InterfaceScaffoldGen
/// @notice Interface scaffold generator for Clef concept specifications
/// @dev Implements the InterfaceScaffoldGen concept from Clef specification.
///      Scaffold generator pattern: register() returns metadata, generate() persists
///      scaffold records and returns files, preview() is read-only.

contract InterfaceScaffoldGen {

    // --- Types ---

    struct ScaffoldRecord {
        string name;
        string[] targets;
        string[] sdks;
        bytes[] files;
        int256 filesGenerated;
        uint256 timestamp;
        bool exists;
    }

    struct GenerateInput {
        string name;
        string[] targets;
        string[] sdks;
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
        string[] targets;
        string[] sdks;
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

    // --- Storage ---

    /// @dev Maps scaffold ID to its ScaffoldRecord
    mapping(bytes32 => ScaffoldRecord) private _scaffolds;

    /// @dev Ordered list of scaffold IDs
    bytes32[] private _scaffoldIds;

    /// @dev Nonce for unique scaffold ID generation
    uint256 private _nonce;

    // --- Events ---

    event GenerateCompleted(string variant, bytes[] files, int256 filesGenerated);
    event PreviewCompleted(string variant, bytes[] files, int256 wouldWrite, int256 wouldSkip);
    event RegisterCompleted(string variant, string[] capabilities);

    // --- Actions ---

    /// @notice register - returns static scaffold generator metadata
    /// @return result The registration result with provider capabilities
    function register() external pure returns (RegisterOkResult memory result) {
        string[] memory caps = new string[](2);
        caps[0] = "interface";
        caps[1] = "sdk";

        result = RegisterOkResult({
            success: true,
            name: "interface-scaffold-gen",
            inputKind: "concept-spec",
            outputKind: "interface-scaffold",
            capabilities: caps
        });
    }

    /// @notice generate - generates interface scaffold files from a concept name, targets, and SDKs
    /// @param name The concept name to scaffold
    /// @param targets The target platforms for the interface
    /// @param sdks The SDK targets to generate
    /// @return result The generation result with produced files
    function generate(string memory name, string[] memory targets, string[] memory sdks) external returns (GenerateOkResult memory result) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(targets.length > 0, "Targets cannot be empty");

        // Generate one file per target
        bytes[] memory files = new bytes[](targets.length);
        for (uint256 i = 0; i < targets.length; i++) {
            files[i] = abi.encodePacked(
                "// Interface scaffold: ", name,
                "\n// Target: ", targets[i]
            );
        }
        int256 filesGenerated = int256(int256(uint256(targets.length)));

        bytes32 scaffoldId = keccak256(abi.encodePacked(name, block.timestamp, _nonce));
        _nonce++;

        _scaffolds[scaffoldId] = ScaffoldRecord({
            name: name,
            targets: targets,
            sdks: sdks,
            files: files,
            filesGenerated: filesGenerated,
            timestamp: block.timestamp,
            exists: true
        });
        _scaffoldIds.push(scaffoldId);

        result = GenerateOkResult({
            success: true,
            files: files,
            filesGenerated: filesGenerated
        });

        emit GenerateCompleted("ok", files, filesGenerated);
    }

    /// @notice preview - previews the files that would be generated without persisting
    /// @param name The concept name to preview
    /// @param targets The target platforms for the interface
    /// @param sdks The SDK targets to preview
    /// @return result The preview result with files and write/skip counts
    function preview(string memory name, string[] memory targets, string[] memory sdks) external pure returns (PreviewOkResult memory result) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(targets.length > 0, "Targets cannot be empty");

        // Preview one file per target
        bytes[] memory files = new bytes[](targets.length);
        for (uint256 i = 0; i < targets.length; i++) {
            files[i] = abi.encodePacked(
                "// Interface scaffold: ", name,
                "\n// Target: ", targets[i]
            );
        }

        int256 wouldWrite = int256(uint256(targets.length));
        int256 wouldSkip = int256(uint256(sdks.length > targets.length ? sdks.length - targets.length : 0));

        result = PreviewOkResult({
            success: true,
            files: files,
            wouldWrite: wouldWrite,
            wouldSkip: wouldSkip
        });
    }

    // --- Views ---

    /// @notice Retrieve a scaffold record by ID
    /// @param scaffoldId The scaffold ID to look up
    /// @return name The concept name
    /// @return filesGenerated The number of files generated
    function getScaffold(bytes32 scaffoldId) external view returns (string memory name, int256 filesGenerated) {
        require(_scaffolds[scaffoldId].exists, "Scaffold not found");
        ScaffoldRecord storage rec = _scaffolds[scaffoldId];
        return (rec.name, rec.filesGenerated);
    }

    /// @notice Check if a scaffold record exists
    /// @param scaffoldId The scaffold ID to check
    /// @return Whether the scaffold record exists
    function scaffoldExists(bytes32 scaffoldId) external view returns (bool) {
        return _scaffolds[scaffoldId].exists;
    }
}

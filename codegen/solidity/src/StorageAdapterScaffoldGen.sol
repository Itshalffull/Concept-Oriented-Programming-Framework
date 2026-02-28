// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title StorageAdapterScaffoldGen
/// @notice Storage adapter scaffold generator for Clef concept specifications
/// @dev Implements the StorageAdapterScaffoldGen concept from Clef specification.
///      Scaffold generator pattern: register() returns metadata, generate() persists
///      scaffold records and returns files, preview() is read-only.

contract StorageAdapterScaffoldGen {

    // --- Types ---

    struct AdapterRecord {
        string name;
        string backend;
        bytes[] files;
        int256 filesGenerated;
        uint256 timestamp;
        bool exists;
    }

    struct GenerateInput {
        string name;
        string backend;
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
        string backend;
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

    /// @dev Maps adapter scaffold ID to its AdapterRecord
    mapping(bytes32 => AdapterRecord) private _adapters;

    /// @dev Ordered list of adapter scaffold IDs
    bytes32[] private _adapterIds;

    /// @dev Nonce for unique ID generation
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
        caps[0] = "storage";
        caps[1] = "adapter";

        result = RegisterOkResult({
            success: true,
            name: "storage-adapter-scaffold-gen",
            inputKind: "concept-spec",
            outputKind: "storage-adapter-scaffold",
            capabilities: caps
        });
    }

    /// @notice generate - generates storage adapter scaffold files for a given backend
    /// @param name The adapter name
    /// @param backend The storage backend type (e.g., "postgres", "sqlite", "redis")
    /// @return result The generation result with produced files
    function generate(string memory name, string memory backend) external returns (GenerateOkResult memory result) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(backend).length > 0, "Backend cannot be empty");

        // Generate adapter and config files for the storage backend
        bytes[] memory files = new bytes[](2);
        files[0] = abi.encodePacked(
            "// Storage adapter scaffold: ", name,
            "\n// Backend: ", backend,
            "\n// adapter.ts"
        );
        files[1] = abi.encodePacked(
            "// Storage adapter config: ", name,
            "\n// Backend: ", backend,
            "\n// config.ts"
        );

        int256 filesGenerated = int256(2);

        bytes32 adapterId = keccak256(abi.encodePacked(name, backend, block.timestamp, _nonce));
        _nonce++;

        _adapters[adapterId] = AdapterRecord({
            name: name,
            backend: backend,
            files: files,
            filesGenerated: filesGenerated,
            timestamp: block.timestamp,
            exists: true
        });
        _adapterIds.push(adapterId);

        result = GenerateOkResult({
            success: true,
            files: files,
            filesGenerated: filesGenerated
        });

        emit GenerateCompleted("ok", files, filesGenerated);
    }

    /// @notice preview - previews the files that would be generated without persisting
    /// @param name The adapter name
    /// @param backend The storage backend type
    /// @return result The preview result with files and write/skip counts
    function preview(string memory name, string memory backend) external pure returns (PreviewOkResult memory result) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(backend).length > 0, "Backend cannot be empty");

        // Preview adapter and config files
        bytes[] memory files = new bytes[](2);
        files[0] = abi.encodePacked(
            "// Storage adapter scaffold: ", name,
            "\n// Backend: ", backend,
            "\n// adapter.ts"
        );
        files[1] = abi.encodePacked(
            "// Storage adapter config: ", name,
            "\n// Backend: ", backend,
            "\n// config.ts"
        );

        result = PreviewOkResult({
            success: true,
            files: files,
            wouldWrite: int256(2),
            wouldSkip: int256(0)
        });
    }

    // --- Views ---

    /// @notice Retrieve an adapter scaffold record by ID
    /// @param adapterId The adapter scaffold ID to look up
    /// @return name The adapter name
    /// @return backend The backend type
    /// @return filesGenerated The number of files generated
    function getAdapter(bytes32 adapterId) external view returns (string memory name, string memory backend, int256 filesGenerated) {
        require(_adapters[adapterId].exists, "Adapter scaffold not found");
        AdapterRecord storage rec = _adapters[adapterId];
        return (rec.name, rec.backend, rec.filesGenerated);
    }

    /// @notice Check if an adapter scaffold record exists
    /// @param adapterId The adapter scaffold ID to check
    /// @return Whether the adapter scaffold record exists
    function adapterExists(bytes32 adapterId) external view returns (bool) {
        return _adapters[adapterId].exists;
    }
}

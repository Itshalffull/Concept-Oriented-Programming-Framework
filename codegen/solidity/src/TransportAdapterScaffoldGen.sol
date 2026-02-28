// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TransportAdapterScaffoldGen
/// @notice Transport adapter scaffold generator for Clef concept specifications
/// @dev Implements the TransportAdapterScaffoldGen concept from Clef specification.
///      Scaffold generator pattern: register() returns metadata, generate() persists
///      scaffold records and returns files, preview() is read-only.

contract TransportAdapterScaffoldGen {

    // --- Types ---

    struct AdapterRecord {
        string name;
        string protocol;
        bytes[] files;
        int256 filesGenerated;
        uint256 timestamp;
        bool exists;
    }

    struct GenerateInput {
        string name;
        string protocol;
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
        string protocol;
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
        caps[0] = "transport";
        caps[1] = "adapter";

        result = RegisterOkResult({
            success: true,
            name: "transport-adapter-scaffold-gen",
            inputKind: "concept-spec",
            outputKind: "transport-adapter-scaffold",
            capabilities: caps
        });
    }

    /// @notice generate - generates transport adapter scaffold files for a given protocol
    /// @param name The adapter name
    /// @param protocol The transport protocol type (e.g., "http", "grpc", "websocket")
    /// @return result The generation result with produced files
    function generate(string memory name, string memory protocol) external returns (GenerateOkResult memory result) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(protocol).length > 0, "Protocol cannot be empty");

        // Generate adapter and config files for the transport protocol
        bytes[] memory files = new bytes[](2);
        files[0] = abi.encodePacked(
            "// Transport adapter scaffold: ", name,
            "\n// Protocol: ", protocol,
            "\n// adapter.ts"
        );
        files[1] = abi.encodePacked(
            "// Transport adapter config: ", name,
            "\n// Protocol: ", protocol,
            "\n// config.ts"
        );

        int256 filesGenerated = int256(2);

        bytes32 adapterId = keccak256(abi.encodePacked(name, protocol, block.timestamp, _nonce));
        _nonce++;

        _adapters[adapterId] = AdapterRecord({
            name: name,
            protocol: protocol,
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
    /// @param protocol The transport protocol type
    /// @return result The preview result with files and write/skip counts
    function preview(string memory name, string memory protocol) external pure returns (PreviewOkResult memory result) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(protocol).length > 0, "Protocol cannot be empty");

        // Preview adapter and config files
        bytes[] memory files = new bytes[](2);
        files[0] = abi.encodePacked(
            "// Transport adapter scaffold: ", name,
            "\n// Protocol: ", protocol,
            "\n// adapter.ts"
        );
        files[1] = abi.encodePacked(
            "// Transport adapter config: ", name,
            "\n// Protocol: ", protocol,
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
    /// @return protocol The protocol type
    /// @return filesGenerated The number of files generated
    function getAdapter(bytes32 adapterId) external view returns (string memory name, string memory protocol, int256 filesGenerated) {
        require(_adapters[adapterId].exists, "Adapter scaffold not found");
        AdapterRecord storage rec = _adapters[adapterId];
        return (rec.name, rec.protocol, rec.filesGenerated);
    }

    /// @notice Check if an adapter scaffold record exists
    /// @param adapterId The adapter scaffold ID to check
    /// @return Whether the adapter scaffold record exists
    function adapterExists(bytes32 adapterId) external view returns (bool) {
        return _adapters[adapterId].exists;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title LanguageGrammar
/// @notice Language grammar registration and resolution
/// @dev Implements the LanguageGrammar concept from Clef specification.
///      Supports registering grammars with file extensions, resolving grammars
///      by extension or MIME type, and listing all registered grammars.

contract LanguageGrammar {
    // --- Types ---

    struct GrammarEntry {
        string name;
        string extensions;
        string parserWasmPath;
        string nodeTypes;
        string mimeType;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps grammar ID to its entry
    mapping(bytes32 => GrammarEntry) private _grammars;

    /// @dev Ordered list of all grammar IDs
    bytes32[] private _grammarKeys;

    /// @dev Maps file extension hash to grammar ID
    mapping(bytes32 => bytes32) private _extensionToGrammar;

    /// @dev Maps MIME type hash to grammar ID
    mapping(bytes32 => bytes32) private _mimeToGrammar;

    // --- Events ---

    event RegisterCompleted(string variant, bytes32 grammar);
    event ResolveCompleted(string variant, bytes32 grammar);
    event ResolveByMimeCompleted(string variant, bytes32 grammar);
    event GetCompleted(string variant, bytes32 grammar);
    event ListCompleted(string variant);

    // --- Actions ---

    /// @notice Register a new language grammar
    /// @param name The grammar name
    /// @param extensions Comma-separated file extensions (e.g. ".ts,.tsx")
    /// @param parserWasmPath Path to the WASM parser binary
    /// @param nodeTypes Serialized node type definitions
    /// @return grammarId The unique identifier for this grammar
    function register(string memory name, string memory extensions, string memory parserWasmPath, string memory nodeTypes) external returns (bytes32 grammarId) {
        require(bytes(name).length > 0, "Name cannot be empty");

        grammarId = keccak256(abi.encodePacked(name));

        // Check for duplicate registration
        require(!_grammars[grammarId].exists, "Grammar already registered");

        _grammars[grammarId] = GrammarEntry({
            name: name,
            extensions: extensions,
            parserWasmPath: parserWasmPath,
            nodeTypes: nodeTypes,
            mimeType: "",
            exists: true
        });

        // Index by extension for resolution
        bytes32 extHash = keccak256(abi.encodePacked(extensions));
        _extensionToGrammar[extHash] = grammarId;
        _grammarKeys.push(grammarId);

        emit RegisterCompleted("ok", grammarId);
        return grammarId;
    }

    /// @notice Resolve a grammar by file extension
    /// @param fileExtension The file extension to look up (e.g. ".ts")
    /// @return grammarId The grammar ID for the extension
    function resolve(string memory fileExtension) external view returns (bytes32 grammarId) {
        require(bytes(fileExtension).length > 0, "Extension cannot be empty");

        // Try direct extension match
        bytes32 extHash = keccak256(abi.encodePacked(fileExtension));
        grammarId = _extensionToGrammar[extHash];

        // If not found by direct match, scan registered grammars
        if (grammarId == bytes32(0)) {
            for (uint256 i = 0; i < _grammarKeys.length; i++) {
                bytes32 key = _grammarKeys[i];
                if (_grammars[key].exists) {
                    // Check if the extension appears in the grammar's extensions list
                    if (_containsSubstring(_grammars[key].extensions, fileExtension)) {
                        grammarId = key;
                        break;
                    }
                }
            }
        }

        require(grammarId != bytes32(0), "No grammar found for extension");
        return grammarId;
    }

    /// @notice Resolve a grammar by MIME type
    /// @param mimeType The MIME type to look up
    /// @return grammarId The grammar ID for the MIME type
    function resolveByMime(string memory mimeType) external view returns (bytes32 grammarId) {
        require(bytes(mimeType).length > 0, "MIME type cannot be empty");

        bytes32 mimeHash = keccak256(abi.encodePacked(mimeType));
        grammarId = _mimeToGrammar[mimeHash];

        require(grammarId != bytes32(0), "No grammar found for MIME type");
        return grammarId;
    }

    /// @notice Get detailed information about a grammar
    /// @param grammarId The grammar to look up
    /// @return name The grammar name
    /// @return extensions The supported file extensions
    /// @return parserWasmPath The parser WASM path
    function get(bytes32 grammarId) external view returns (string memory name, string memory extensions, string memory parserWasmPath) {
        require(_grammars[grammarId].exists, "Grammar not found");

        GrammarEntry storage entry = _grammars[grammarId];
        return (entry.name, entry.extensions, entry.parserWasmPath);
    }

    /// @notice List all registered grammars
    /// @return grammars Serialized list of grammar names
    function list() external view returns (string memory grammars) {
        bytes memory buf;
        uint256 found = 0;

        for (uint256 i = 0; i < _grammarKeys.length; i++) {
            bytes32 key = _grammarKeys[i];
            if (_grammars[key].exists) {
                if (found > 0) {
                    buf = abi.encodePacked(buf, ",");
                }
                buf = abi.encodePacked(buf, _grammars[key].name);
                found++;
            }
        }

        grammars = string(abi.encodePacked("[", buf, "]"));
        return grammars;
    }

    // --- Internal helpers ---

    /// @dev Check if haystack contains needle as a substring
    function _containsSubstring(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length > h.length) return false;
        if (n.length == 0) return true;

        for (uint256 i = 0; i <= h.length - n.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < n.length; j++) {
                if (h[i + j] != n[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        return false;
    }
}

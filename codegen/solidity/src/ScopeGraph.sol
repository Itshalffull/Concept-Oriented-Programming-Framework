// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ScopeGraph
/// @notice Scope graph management for symbol resolution across files
/// @dev Implements the ScopeGraph concept from Clef specification.
///      Supports building scope graphs from file/tree pairs, resolving references
///      within scopes, listing visible symbols, and cross-file resolution.

contract ScopeGraph {

    // --- Types ---

    struct BuildInput {
        string file;
        string tree;
    }

    struct BuildOkResult {
        bool success;
        bytes32 graph;
    }

    struct BuildUnsupportedLanguageResult {
        bool success;
        string language;
    }

    struct ResolveReferenceInput {
        bytes32 graph;
        string scope;
        string name;
    }

    struct ResolveReferenceOkResult {
        bool success;
        string symbol;
    }

    struct ResolveReferenceUnresolvedResult {
        bool success;
        string candidates;
    }

    struct ResolveReferenceAmbiguousResult {
        bool success;
        string symbols;
    }

    struct VisibleSymbolsInput {
        bytes32 graph;
        string scope;
    }

    struct VisibleSymbolsOkResult {
        bool success;
        string symbols;
    }

    struct ResolveCrossFileOkResult {
        bool success;
        int256 resolvedCount;
    }

    struct GetOkResult {
        bool success;
        bytes32 graph;
        string file;
        int256 scopeCount;
        int256 declarationCount;
        int256 unresolvedCount;
    }

    /// @dev Internal representation of a scope graph
    struct GraphEntry {
        string file;
        string tree;
        bool exists;
    }

    /// @dev A declaration within a scope graph
    struct Declaration {
        string name;
        string scope;
        bool exists;
    }

    /// @dev An unresolved reference within a scope graph
    struct UnresolvedRef {
        string name;
        string scope;
        bool resolved;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps graph ID to its GraphEntry
    mapping(bytes32 => GraphEntry) private _graphs;

    /// @dev Maps graph ID -> declaration index -> Declaration
    mapping(bytes32 => mapping(uint256 => Declaration)) private _declarations;

    /// @dev Maps graph ID to declaration count
    mapping(bytes32 => uint256) private _declarationCounts;

    /// @dev Maps graph ID -> scope name hash -> declaration index list count
    mapping(bytes32 => mapping(bytes32 => uint256)) private _scopeDeclarationCounts;

    /// @dev Maps graph ID -> scope name hash -> index -> declaration name
    mapping(bytes32 => mapping(bytes32 => mapping(uint256 => string))) private _scopeDeclarations;

    /// @dev Maps graph ID -> unresolved ref index -> UnresolvedRef
    mapping(bytes32 => mapping(uint256 => UnresolvedRef)) private _unresolvedRefs;

    /// @dev Maps graph ID to unresolved ref count
    mapping(bytes32 => uint256) private _unresolvedCounts;

    /// @dev Maps graph ID to scope count
    mapping(bytes32 => uint256) private _scopeCounts;

    /// @dev Maps graph ID -> scope name hash -> exists
    mapping(bytes32 => mapping(bytes32 => bool)) private _scopes;

    /// @dev Nonce for generating unique graph IDs
    uint256 private _nonce;

    // --- Events ---

    event BuildCompleted(string variant, bytes32 graph);
    event ResolveReferenceCompleted(string variant);
    event VisibleSymbolsCompleted(string variant);
    event ResolveCrossFileCompleted(string variant, int256 resolvedCount);
    event GetCompleted(string variant, bytes32 graph, int256 scopeCount, int256 declarationCount, int256 unresolvedCount);

    // --- Actions ---

    /// @notice build
    function build(string memory file, string memory tree) external returns (BuildOkResult memory) {
        require(bytes(file).length > 0, "File cannot be empty");
        require(bytes(tree).length > 0, "Tree cannot be empty");

        _nonce++;
        bytes32 graphId = keccak256(abi.encodePacked(file, tree, _nonce, block.timestamp));

        _graphs[graphId] = GraphEntry({
            file: file,
            tree: tree,
            exists: true
        });

        // Create a default global scope
        bytes32 globalScopeHash = keccak256(abi.encodePacked("global"));
        _scopes[graphId][globalScopeHash] = true;
        _scopeCounts[graphId] = 1;

        emit BuildCompleted("ok", graphId);

        return BuildOkResult({
            success: true,
            graph: graphId
        });
    }

    /// @notice resolveReference
    function resolveReference(bytes32 graph, string memory scope, string memory name) external returns (ResolveReferenceOkResult memory) {
        require(_graphs[graph].exists, "Graph not found");
        require(bytes(name).length > 0, "Name cannot be empty");

        bytes32 scopeHash = keccak256(abi.encodePacked(scope));
        uint256 count = _scopeDeclarationCounts[graph][scopeHash];

        // Search for the symbol in the given scope
        string memory found = "";
        uint256 matchCount = 0;

        for (uint256 i = 0; i < count; i++) {
            if (keccak256(abi.encodePacked(_scopeDeclarations[graph][scopeHash][i])) == keccak256(abi.encodePacked(name))) {
                found = _scopeDeclarations[graph][scopeHash][i];
                matchCount++;
            }
        }

        // If not found in direct scope, try global scope
        if (matchCount == 0 && keccak256(abi.encodePacked(scope)) != keccak256(abi.encodePacked("global"))) {
            bytes32 globalHash = keccak256(abi.encodePacked("global"));
            uint256 globalCount = _scopeDeclarationCounts[graph][globalHash];
            for (uint256 i = 0; i < globalCount; i++) {
                if (keccak256(abi.encodePacked(_scopeDeclarations[graph][globalHash][i])) == keccak256(abi.encodePacked(name))) {
                    found = _scopeDeclarations[graph][globalHash][i];
                    matchCount++;
                }
            }
        }

        require(matchCount > 0, "Symbol not found");

        emit ResolveReferenceCompleted("ok");

        return ResolveReferenceOkResult({
            success: true,
            symbol: found
        });
    }

    /// @notice visibleSymbols
    function visibleSymbols(bytes32 graph, string memory scope) external returns (VisibleSymbolsOkResult memory) {
        require(_graphs[graph].exists, "Graph not found");

        bytes32 scopeHash = keccak256(abi.encodePacked(scope));
        uint256 count = _scopeDeclarationCounts[graph][scopeHash];

        // Concatenate all visible symbol names with commas
        string memory result = "";
        for (uint256 i = 0; i < count; i++) {
            if (i > 0) {
                result = string(abi.encodePacked(result, ",", _scopeDeclarations[graph][scopeHash][i]));
            } else {
                result = _scopeDeclarations[graph][scopeHash][i];
            }
        }

        emit VisibleSymbolsCompleted("ok");

        return VisibleSymbolsOkResult({
            success: true,
            symbols: result
        });
    }

    /// @notice resolveCrossFile
    function resolveCrossFile(bytes32 graph) external returns (ResolveCrossFileOkResult memory) {
        require(_graphs[graph].exists, "Graph not found");

        uint256 totalUnresolved = _unresolvedCounts[graph];
        int256 resolvedCount = 0;

        // Attempt to resolve each unresolved reference against declarations
        for (uint256 i = 0; i < totalUnresolved; i++) {
            if (_unresolvedRefs[graph][i].exists && !_unresolvedRefs[graph][i].resolved) {
                string memory refName = _unresolvedRefs[graph][i].name;
                // Check global scope for the declaration
                bytes32 globalHash = keccak256(abi.encodePacked("global"));
                uint256 declCount = _scopeDeclarationCounts[graph][globalHash];
                for (uint256 j = 0; j < declCount; j++) {
                    if (keccak256(abi.encodePacked(_scopeDeclarations[graph][globalHash][j])) == keccak256(abi.encodePacked(refName))) {
                        _unresolvedRefs[graph][i].resolved = true;
                        resolvedCount++;
                        break;
                    }
                }
            }
        }

        emit ResolveCrossFileCompleted("ok", resolvedCount);

        return ResolveCrossFileOkResult({
            success: true,
            resolvedCount: resolvedCount
        });
    }

    /// @notice get
    function get(bytes32 graph) external returns (GetOkResult memory) {
        require(_graphs[graph].exists, "Graph not found");

        int256 scopeCount = int256(_scopeCounts[graph]);
        int256 declarationCount = int256(_declarationCounts[graph]);

        // Count remaining unresolved references
        uint256 totalUnresolved = _unresolvedCounts[graph];
        int256 unresolvedCount = 0;
        for (uint256 i = 0; i < totalUnresolved; i++) {
            if (_unresolvedRefs[graph][i].exists && !_unresolvedRefs[graph][i].resolved) {
                unresolvedCount++;
            }
        }

        emit GetCompleted("ok", graph, scopeCount, declarationCount, unresolvedCount);

        return GetOkResult({
            success: true,
            graph: graph,
            file: _graphs[graph].file,
            scopeCount: scopeCount,
            declarationCount: declarationCount,
            unresolvedCount: unresolvedCount
        });
    }

    // --- Helper Functions ---

    /// @notice Add a declaration to a scope within a graph
    /// @param graph The graph to add the declaration to
    /// @param scope The scope name
    /// @param name The declaration name
    function addDeclaration(bytes32 graph, string calldata scope, string calldata name) external {
        require(_graphs[graph].exists, "Graph not found");
        require(bytes(name).length > 0, "Name cannot be empty");

        bytes32 scopeHash = keccak256(abi.encodePacked(scope));

        // Create scope if it does not exist
        if (!_scopes[graph][scopeHash]) {
            _scopes[graph][scopeHash] = true;
            _scopeCounts[graph]++;
        }

        uint256 idx = _scopeDeclarationCounts[graph][scopeHash];
        _scopeDeclarations[graph][scopeHash][idx] = name;
        _scopeDeclarationCounts[graph][scopeHash] = idx + 1;

        uint256 declIdx = _declarationCounts[graph];
        _declarations[graph][declIdx] = Declaration({
            name: name,
            scope: scope,
            exists: true
        });
        _declarationCounts[graph] = declIdx + 1;
    }

    /// @notice Add an unresolved reference to a graph
    /// @param graph The graph to add the reference to
    /// @param name The reference name
    /// @param scope The scope where the reference occurs
    function addUnresolvedRef(bytes32 graph, string calldata name, string calldata scope) external {
        require(_graphs[graph].exists, "Graph not found");

        uint256 idx = _unresolvedCounts[graph];
        _unresolvedRefs[graph][idx] = UnresolvedRef({
            name: name,
            scope: scope,
            resolved: false,
            exists: true
        });
        _unresolvedCounts[graph] = idx + 1;
    }

    // --- Views ---

    /// @notice Check if a graph exists
    /// @param graph The graph ID to check
    /// @return Whether the graph exists
    function graphExists(bytes32 graph) external view returns (bool) {
        return _graphs[graph].exists;
    }
}

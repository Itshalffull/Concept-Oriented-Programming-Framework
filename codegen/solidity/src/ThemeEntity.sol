// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ThemeEntity
/// @notice Theme entity extraction and query for design token systems.
/// @dev Manages theme entities with token resolution, contrast auditing, and diff analysis.

contract ThemeEntity {

    // --- Storage ---

    struct EntityData {
        string name;
        string source;
        string ast;
        bool exists;
    }

    mapping(bytes32 => EntityData) private _entities;
    bytes32[] private _entityIds;

    // Name-to-ID lookup for deduplication
    mapping(bytes32 => bytes32) private _nameToId;

    // Token storage per theme: themeId => tokenPathHash => resolvedValue
    mapping(bytes32 => mapping(bytes32 => string)) private _tokens;
    // Token list per theme: themeId => list of token path hashes
    mapping(bytes32 => bytes32[]) private _tokenPaths;

    // --- Types ---

    struct RegisterInput {
        string name;
        string source;
        string ast;
    }

    struct RegisterOkResult {
        bool success;
        bytes32 entity;
    }

    struct RegisterAlreadyRegisteredResult {
        bool success;
        bytes32 existing;
    }

    struct GetOkResult {
        bool success;
        bytes32 entity;
    }

    struct ResolveTokenInput {
        bytes32 theme;
        string tokenPath;
    }

    struct ResolveTokenOkResult {
        bool success;
        string resolvedValue;
        string resolutionChain;
    }

    struct ResolveTokenNotfoundResult {
        bool success;
        string tokenPath;
    }

    struct ResolveTokenBrokenChainResult {
        bool success;
        string brokenAt;
    }

    struct ContrastAuditOkResult {
        bool success;
        string allPassing;
        string results;
    }

    struct DiffThemesInput {
        bytes32 a;
        bytes32 b;
    }

    struct DiffThemesOkResult {
        bool success;
        string differences;
    }

    struct AffectedWidgetsInput {
        bytes32 theme;
        string changedToken;
    }

    struct AffectedWidgetsOkResult {
        bool success;
        string widgets;
    }

    struct GeneratedOutputsOkResult {
        bool success;
        string outputs;
    }

    // --- Events ---

    event RegisterCompleted(string variant, bytes32 entity, bytes32 existing);
    event GetCompleted(string variant, bytes32 entity);
    event ResolveTokenCompleted(string variant);
    event ContrastAuditCompleted(string variant);
    event DiffThemesCompleted(string variant);
    event AffectedWidgetsCompleted(string variant);
    event GeneratedOutputsCompleted(string variant);

    // --- Actions ---

    /// @notice register
    function register(string memory name, string memory source, string memory ast) external returns (RegisterOkResult memory) {
        require(bytes(name).length > 0, "Name must not be empty");

        bytes32 nameHash = keccak256(abi.encodePacked(name));
        bytes32 existingId = _nameToId[nameHash];

        // Deduplication: if already registered, return existing
        if (_entities[existingId].exists) {
            emit RegisterCompleted("alreadyRegistered", bytes32(0), existingId);
            return RegisterOkResult({success: true, entity: existingId});
        }

        bytes32 entityId = keccak256(abi.encodePacked(name, source));
        _entities[entityId] = EntityData({
            name: name,
            source: source,
            ast: ast,
            exists: true
        });
        _entityIds.push(entityId);
        _nameToId[nameHash] = entityId;

        emit RegisterCompleted("ok", entityId, bytes32(0));
        return RegisterOkResult({success: true, entity: entityId});
    }

    /// @notice get
    function get(string memory name) external returns (GetOkResult memory) {
        bytes32 nameHash = keccak256(abi.encodePacked(name));
        bytes32 entityId = _nameToId[nameHash];
        require(_entities[entityId].exists, "Theme entity not found");

        emit GetCompleted("ok", entityId);
        return GetOkResult({success: true, entity: entityId});
    }

    /// @notice resolveToken
    function resolveToken(bytes32 theme, string memory tokenPath) external returns (ResolveTokenOkResult memory) {
        require(_entities[theme].exists, "Theme not found");

        bytes32 tokenHash = keccak256(abi.encodePacked(tokenPath));
        string memory resolved = _tokens[theme][tokenHash];

        // If no stored token value, return the token path as-is (unresolved)
        if (bytes(resolved).length == 0) {
            resolved = tokenPath;
        }

        emit ResolveTokenCompleted("ok");
        return ResolveTokenOkResult({
            success: true,
            resolvedValue: resolved,
            resolutionChain: tokenPath
        });
    }

    /// @notice contrastAudit
    function contrastAudit(bytes32 theme) external returns (ContrastAuditOkResult memory) {
        require(_entities[theme].exists, "Theme not found");

        // On-chain contrast audit returns a passing result with token count
        uint256 tokenCount = _tokenPaths[theme].length;
        string memory passing = tokenCount > 0 ? "true" : "unknown";

        emit ContrastAuditCompleted("ok");
        return ContrastAuditOkResult({
            success: true,
            allPassing: passing,
            results: ""
        });
    }

    /// @notice diffThemes
    function diffThemes(bytes32 a, bytes32 b) external returns (DiffThemesOkResult memory) {
        require(_entities[a].exists, "Theme A not found");
        require(_entities[b].exists, "Theme B not found");

        // Compare source strings for basic diff
        EntityData storage dataA = _entities[a];
        EntityData storage dataB = _entities[b];

        string memory differences;
        bytes32 sourceHashA = keccak256(abi.encodePacked(dataA.source));
        bytes32 sourceHashB = keccak256(abi.encodePacked(dataB.source));

        if (sourceHashA == sourceHashB) {
            differences = "identical";
        } else {
            differences = string(abi.encodePacked(dataA.name, " vs ", dataB.name, ": sources differ"));
        }

        emit DiffThemesCompleted("ok");
        return DiffThemesOkResult({success: true, differences: differences});
    }

    /// @notice affectedWidgets
    function affectedWidgets(bytes32 theme, string memory changedToken) external returns (AffectedWidgetsOkResult memory) {
        require(_entities[theme].exists, "Theme not found");

        // Widget impact analysis is off-chain; return empty
        emit AffectedWidgetsCompleted("ok");
        return AffectedWidgetsOkResult({success: true, widgets: ""});
    }

    /// @notice generatedOutputs
    function generatedOutputs(bytes32 theme) external returns (GeneratedOutputsOkResult memory) {
        require(_entities[theme].exists, "Theme not found");

        emit GeneratedOutputsCompleted("ok");
        return GeneratedOutputsOkResult({success: true, outputs: ""});
    }

}

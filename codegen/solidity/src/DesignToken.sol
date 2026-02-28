// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DesignToken
/// @notice Design token management with aliasing, resolution, and export capabilities.
contract DesignToken {

    // --- Storage ---

    struct TokenEntry {
        string name;
        string value;
        string tokenType;
        string tier;
        bool isAlias;
        bytes32 aliasRef;
        uint256 createdAt;
    }

    mapping(bytes32 => TokenEntry) private _tokens;
    mapping(bytes32 => bool) private _exists;
    bytes32[] private _tokenKeys;

    // --- Types ---

    struct DefineOkResult {
        bool success;
        bytes32 token;
    }

    struct AliasOkResult {
        bool success;
        bytes32 token;
    }

    struct ResolveOkResult {
        bool success;
        bytes32 token;
        string resolvedValue;
    }

    struct UpdateOkResult {
        bool success;
        bytes32 token;
    }

    struct RemoveOkResult {
        bool success;
        bytes32 token;
    }

    struct ExportOkResult {
        bool success;
        string output;
    }

    // --- Events ---

    event DefineCompleted(string variant, bytes32 indexed token);
    event AliasCompleted(string variant, bytes32 indexed token);
    event ResolveCompleted(string variant, bytes32 indexed token);
    event UpdateCompleted(string variant, bytes32 indexed token);
    event RemoveCompleted(string variant, bytes32 indexed token);
    event ExportCompleted(string variant);

    // --- Actions ---

    /// @notice Define a design token with a name, value, type, and tier.
    function defineToken(bytes32 token, string memory name, string memory value, string memory tokenType, string memory tier) external returns (DefineOkResult memory) {
        require(!_exists[token], "Token already defined");
        require(bytes(name).length > 0, "Name required");

        _tokens[token] = TokenEntry({
            name: name,
            value: value,
            tokenType: tokenType,
            tier: tier,
            isAlias: false,
            aliasRef: bytes32(0),
            createdAt: block.timestamp
        });
        _exists[token] = true;
        _tokenKeys.push(token);

        emit DefineCompleted("ok", token);
        return DefineOkResult({success: true, token: token});
    }

    /// @notice Create an alias token that references another token.
    function createAlias(bytes32 token, string memory name, bytes32 refToken, string memory tier) external returns (AliasOkResult memory) {
        require(!_exists[token], "Token already defined");
        require(_exists[refToken], "Referenced token not found");
        // Prevent direct cycle (alias pointing to itself)
        require(token != refToken, "Alias cycle detected");

        _tokens[token] = TokenEntry({
            name: name,
            value: "",
            tokenType: _tokens[refToken].tokenType,
            tier: tier,
            isAlias: true,
            aliasRef: refToken,
            createdAt: block.timestamp
        });
        _exists[token] = true;
        _tokenKeys.push(token);

        emit AliasCompleted("ok", token);
        return AliasOkResult({success: true, token: token});
    }

    /// @notice Resolve a token to its final computed value, following alias chains.
    function resolve(bytes32 token) external returns (ResolveOkResult memory) {
        require(_exists[token], "Token not found");

        bytes32 current = token;
        uint256 maxDepth = 20;
        uint256 depth = 0;

        while (_tokens[current].isAlias && depth < maxDepth) {
            current = _tokens[current].aliasRef;
            require(_exists[current], "Broken alias chain");
            depth++;
        }
        require(depth < maxDepth, "Alias chain too deep");

        string memory resolvedValue = _tokens[current].value;

        emit ResolveCompleted("ok", token);
        return ResolveOkResult({success: true, token: token, resolvedValue: resolvedValue});
    }

    /// @notice Update the value of an existing token.
    function update(bytes32 token, string memory value) external returns (UpdateOkResult memory) {
        require(_exists[token], "Token not found");

        _tokens[token].value = value;

        emit UpdateCompleted("ok", token);
        return UpdateOkResult({success: true, token: token});
    }

    /// @notice Remove a token from the registry.
    function remove(bytes32 token) external returns (RemoveOkResult memory) {
        require(_exists[token], "Token not found");

        delete _tokens[token];
        _exists[token] = false;

        emit RemoveCompleted("ok", token);
        return RemoveOkResult({success: true, token: token});
    }

    /// @notice Export all tokens in the specified format.
    function exportTokens(string memory format) external returns (ExportOkResult memory) {
        string memory output = "";
        bool first = true;

        for (uint256 i = 0; i < _tokenKeys.length; i++) {
            bytes32 key = _tokenKeys[i];
            if (!_exists[key]) continue;

            if (!first) {
                output = string(abi.encodePacked(output, ";"));
            }
            output = string(abi.encodePacked(
                output, _tokens[key].name, ":", _tokens[key].value
            ));
            first = false;
        }

        emit ExportCompleted("ok");
        return ExportOkResult({success: true, output: output});
    }

}

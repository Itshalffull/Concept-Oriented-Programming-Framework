// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Symbol
/// @notice Symbol management for defining, resolving, and querying code symbols
/// @dev Implements the Symbol concept from Clef specification.
///      Supports registering symbols with name/kind/location, resolving by
///      qualified name, finding by kind or file, and renaming.

contract Symbol {

    // --- Types ---

    struct RegisterInput {
        string symbolString;
        string kind;
        string displayName;
        string definingFile;
    }

    struct RegisterOkResult {
        bool success;
        bytes32 symbol;
    }

    struct RegisterAlreadyExistsResult {
        bool success;
        bytes32 existing;
    }

    struct ResolveOkResult {
        bool success;
        bytes32 symbol;
    }

    struct ResolveAmbiguousResult {
        bool success;
        string candidates;
    }

    struct FindByKindInput {
        string kind;
        string namespace;
    }

    struct FindByKindOkResult {
        bool success;
        string symbols;
    }

    struct FindByFileOkResult {
        bool success;
        string symbols;
    }

    struct RenameInput {
        bytes32 symbol;
        string newName;
    }

    struct RenameOkResult {
        bool success;
        string oldName;
        int256 occurrencesUpdated;
    }

    struct RenameConflictResult {
        bool success;
        bytes32 conflicting;
    }

    struct GetOkResult {
        bool success;
        bytes32 symbol;
        string symbolString;
        string kind;
        string displayName;
        string visibility;
        string definingFile;
        string namespace;
    }

    /// @dev Internal representation of a symbol entry
    struct SymbolEntry {
        string symbolString;
        string kind;
        string displayName;
        string visibility;
        string definingFile;
        string namespace;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps symbol ID to its SymbolEntry
    mapping(bytes32 => SymbolEntry) private _symbols;

    /// @dev Maps symbolString hash to symbol ID for resolution
    mapping(bytes32 => bytes32) private _symbolByString;

    /// @dev Ordered list of all symbol IDs
    bytes32[] private _symbolIds;

    // --- Events ---

    event RegisterCompleted(string variant, bytes32 symbol, bytes32 existing);
    event ResolveCompleted(string variant, bytes32 symbol);
    event FindByKindCompleted(string variant);
    event FindByFileCompleted(string variant);
    event RenameCompleted(string variant, int256 occurrencesUpdated, bytes32 conflicting);
    event GetCompleted(string variant, bytes32 symbol);

    // --- Actions ---

    /// @notice register
    function register(string memory symbolString, string memory kind, string memory displayName, string memory definingFile) external returns (RegisterOkResult memory) {
        require(bytes(symbolString).length > 0, "Symbol string cannot be empty");
        require(bytes(kind).length > 0, "Kind cannot be empty");

        bytes32 stringHash = keccak256(abi.encodePacked(symbolString));

        // Check if symbol already exists
        bytes32 existingId = _symbolByString[stringHash];
        if (existingId != bytes32(0) && _symbols[existingId].exists) {
            revert("Symbol already exists");
        }

        bytes32 symbolId = keccak256(abi.encodePacked(symbolString, kind, definingFile, _symbolIds.length, block.timestamp));

        _symbols[symbolId] = SymbolEntry({
            symbolString: symbolString,
            kind: kind,
            displayName: displayName,
            visibility: "public",
            definingFile: definingFile,
            namespace: "",
            exists: true
        });

        _symbolByString[stringHash] = symbolId;
        _symbolIds.push(symbolId);

        emit RegisterCompleted("ok", symbolId, bytes32(0));

        return RegisterOkResult({
            success: true,
            symbol: symbolId
        });
    }

    /// @notice resolve
    function resolve(string memory symbolString) external returns (ResolveOkResult memory) {
        require(bytes(symbolString).length > 0, "Symbol string cannot be empty");

        bytes32 stringHash = keccak256(abi.encodePacked(symbolString));
        bytes32 symbolId = _symbolByString[stringHash];

        require(symbolId != bytes32(0) && _symbols[symbolId].exists, "Symbol not found");

        emit ResolveCompleted("ok", symbolId);

        return ResolveOkResult({
            success: true,
            symbol: symbolId
        });
    }

    /// @notice findByKind
    function findByKind(string memory kind, string memory namespace) external returns (FindByKindOkResult memory) {
        require(bytes(kind).length > 0, "Kind cannot be empty");

        string memory result = "";
        bool hasNamespaceFilter = bytes(namespace).length > 0;
        bytes32 kindHash = keccak256(abi.encodePacked(kind));
        bool first = true;

        for (uint256 i = 0; i < _symbolIds.length; i++) {
            SymbolEntry storage entry = _symbols[_symbolIds[i]];
            if (entry.exists && keccak256(abi.encodePacked(entry.kind)) == kindHash) {
                if (hasNamespaceFilter) {
                    if (keccak256(abi.encodePacked(entry.namespace)) != keccak256(abi.encodePacked(namespace))) {
                        continue;
                    }
                }
                if (!first) {
                    result = string(abi.encodePacked(result, ",", entry.symbolString));
                } else {
                    result = entry.symbolString;
                    first = false;
                }
            }
        }

        emit FindByKindCompleted("ok");

        return FindByKindOkResult({
            success: true,
            symbols: result
        });
    }

    /// @notice findByFile
    function findByFile(string memory file) external returns (FindByFileOkResult memory) {
        require(bytes(file).length > 0, "File cannot be empty");

        bytes32 fileHash = keccak256(abi.encodePacked(file));
        string memory result = "";
        bool first = true;

        for (uint256 i = 0; i < _symbolIds.length; i++) {
            SymbolEntry storage entry = _symbols[_symbolIds[i]];
            if (entry.exists && keccak256(abi.encodePacked(entry.definingFile)) == fileHash) {
                if (!first) {
                    result = string(abi.encodePacked(result, ",", entry.symbolString));
                } else {
                    result = entry.symbolString;
                    first = false;
                }
            }
        }

        emit FindByFileCompleted("ok");

        return FindByFileOkResult({
            success: true,
            symbols: result
        });
    }

    /// @notice rename
    function rename(bytes32 symbol, string memory newName) external returns (RenameOkResult memory) {
        require(_symbols[symbol].exists, "Symbol not found");
        require(bytes(newName).length > 0, "New name cannot be empty");

        // Check for naming conflict
        bytes32 newHash = keccak256(abi.encodePacked(newName));
        bytes32 conflicting = _symbolByString[newHash];
        if (conflicting != bytes32(0) && _symbols[conflicting].exists) {
            revert("Name conflicts with existing symbol");
        }

        string memory oldName = _symbols[symbol].symbolString;

        // Remove old string mapping
        bytes32 oldHash = keccak256(abi.encodePacked(oldName));
        delete _symbolByString[oldHash];

        // Update to new name
        _symbols[symbol].symbolString = newName;
        _symbols[symbol].displayName = newName;
        _symbolByString[newHash] = symbol;

        emit RenameCompleted("ok", 1, bytes32(0));

        return RenameOkResult({
            success: true,
            oldName: oldName,
            occurrencesUpdated: 1
        });
    }

    /// @notice get
    function get(bytes32 symbol) external returns (GetOkResult memory) {
        require(_symbols[symbol].exists, "Symbol not found");

        SymbolEntry storage entry = _symbols[symbol];

        emit GetCompleted("ok", symbol);

        return GetOkResult({
            success: true,
            symbol: symbol,
            symbolString: entry.symbolString,
            kind: entry.kind,
            displayName: entry.displayName,
            visibility: entry.visibility,
            definingFile: entry.definingFile,
            namespace: entry.namespace
        });
    }

    // --- Views ---

    /// @notice Check if a symbol exists
    /// @param symbol The symbol ID to check
    /// @return Whether the symbol exists
    function symbolExists(bytes32 symbol) external view returns (bool) {
        return _symbols[symbol].exists;
    }

    /// @notice Get the total number of registered symbols
    /// @return The count of registered symbols
    function symbolCount() external view returns (uint256) {
        return _symbolIds.length;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ScoreIndex
/// @notice Score index management for concepts, syncs, symbols, and files
/// @dev Implements the ScoreIndex concept from Clef specification.
///      Maintains separate indexes for concepts, syncs, symbols, and files
///      with upsert, removal, clearing, and statistics capabilities.

contract ScoreIndex {
    // --- Types ---

    struct ConceptEntry {
        string name;
        string purpose;
        string[] actions;
        string[] stateFields;
        string file;
        bool exists;
    }

    struct SyncEntry {
        string name;
        string annotation;
        string[] triggers;
        string[] effects;
        string file;
        bool exists;
    }

    struct SymbolEntry {
        string name;
        string kind;
        string file;
        int256 line;
        string scope;
        bool exists;
    }

    struct FileEntry {
        string path;
        string language;
        string role;
        string[] definitions;
        bool exists;
    }

    // --- Storage ---

    mapping(bytes32 => ConceptEntry) private _concepts;
    bytes32[] private _conceptKeys;

    mapping(bytes32 => SyncEntry) private _syncs;
    bytes32[] private _syncKeys;

    mapping(bytes32 => SymbolEntry) private _symbols;
    bytes32[] private _symbolKeys;

    mapping(bytes32 => FileEntry) private _files;
    bytes32[] private _fileKeys;

    uint256 private _lastUpdated;

    // --- Events ---

    event UpsertConceptCompleted(string variant, bytes32 index);
    event UpsertSyncCompleted(string variant, bytes32 index);
    event UpsertSymbolCompleted(string variant, bytes32 index);
    event UpsertFileCompleted(string variant, bytes32 index);
    event RemoveByFileCompleted(string variant, int256 removed);
    event ClearCompleted(string variant, int256 cleared);
    event StatsCompleted(string variant, int256 conceptCount, int256 syncCount, int256 symbolCount, int256 fileCount, uint256 lastUpdated);

    // --- Actions ---

    /// @notice Upsert a concept into the index
    /// @param name The concept name
    /// @param purpose The concept's purpose description
    /// @param actions The concept's action names
    /// @param stateFields The concept's state field names
    /// @param file The source file path
    /// @return indexId The unique index identifier for this concept
    function upsertConcept(string memory name, string memory purpose, string[] memory actions, string[] memory stateFields, string memory file) external returns (bytes32 indexId) {
        require(bytes(name).length > 0, "Name cannot be empty");

        indexId = keccak256(abi.encodePacked("concept", name));

        if (!_concepts[indexId].exists) {
            _conceptKeys.push(indexId);
        }

        _concepts[indexId] = ConceptEntry({
            name: name,
            purpose: purpose,
            actions: actions,
            stateFields: stateFields,
            file: file,
            exists: true
        });

        _lastUpdated = block.timestamp;

        emit UpsertConceptCompleted("ok", indexId);
        return indexId;
    }

    /// @notice Upsert a sync into the index
    /// @param name The sync name
    /// @param annotation The sync annotation
    /// @param triggers The sync trigger names
    /// @param effects The sync effect names
    /// @param file The source file path
    /// @return indexId The unique index identifier for this sync
    function upsertSync(string memory name, string memory annotation, string[] memory triggers, string[] memory effects, string memory file) external returns (bytes32 indexId) {
        require(bytes(name).length > 0, "Name cannot be empty");

        indexId = keccak256(abi.encodePacked("sync", name));

        if (!_syncs[indexId].exists) {
            _syncKeys.push(indexId);
        }

        _syncs[indexId] = SyncEntry({
            name: name,
            annotation: annotation,
            triggers: triggers,
            effects: effects,
            file: file,
            exists: true
        });

        _lastUpdated = block.timestamp;

        emit UpsertSyncCompleted("ok", indexId);
        return indexId;
    }

    /// @notice Upsert a symbol into the index
    /// @param name The symbol name
    /// @param kind The symbol kind (function, class, variable, etc.)
    /// @param file The source file path
    /// @param line The line number
    /// @param scope The symbol's scope
    /// @return indexId The unique index identifier for this symbol
    function upsertSymbol(string memory name, string memory kind, string memory file, int256 line, string memory scope) external returns (bytes32 indexId) {
        require(bytes(name).length > 0, "Name cannot be empty");

        indexId = keccak256(abi.encodePacked("symbol", name, file, line));

        if (!_symbols[indexId].exists) {
            _symbolKeys.push(indexId);
        }

        _symbols[indexId] = SymbolEntry({
            name: name,
            kind: kind,
            file: file,
            line: line,
            scope: scope,
            exists: true
        });

        _lastUpdated = block.timestamp;

        emit UpsertSymbolCompleted("ok", indexId);
        return indexId;
    }

    /// @notice Upsert a file into the index
    /// @param path The file path
    /// @param language The programming language
    /// @param role The file role (spec, handler, test, etc.)
    /// @param definitions The definitions contained in the file
    /// @return indexId The unique index identifier for this file
    function upsertFile(string memory path, string memory language, string memory role, string[] memory definitions) external returns (bytes32 indexId) {
        require(bytes(path).length > 0, "Path cannot be empty");

        indexId = keccak256(abi.encodePacked("file", path));

        if (!_files[indexId].exists) {
            _fileKeys.push(indexId);
        }

        _files[indexId] = FileEntry({
            path: path,
            language: language,
            role: role,
            definitions: definitions,
            exists: true
        });

        _lastUpdated = block.timestamp;

        emit UpsertFileCompleted("ok", indexId);
        return indexId;
    }

    /// @notice Remove all index entries associated with a given file path
    /// @param path The file path whose entries should be removed
    /// @return removed The number of entries removed
    function removeByFile(string memory path) external returns (int256 removed) {
        require(bytes(path).length > 0, "Path cannot be empty");
        removed = 0;

        // Remove matching concepts
        for (uint256 i = 0; i < _conceptKeys.length; i++) {
            if (_concepts[_conceptKeys[i]].exists &&
                keccak256(bytes(_concepts[_conceptKeys[i]].file)) == keccak256(bytes(path))) {
                delete _concepts[_conceptKeys[i]];
                removed++;
            }
        }

        // Remove matching syncs
        for (uint256 i = 0; i < _syncKeys.length; i++) {
            if (_syncs[_syncKeys[i]].exists &&
                keccak256(bytes(_syncs[_syncKeys[i]].file)) == keccak256(bytes(path))) {
                delete _syncs[_syncKeys[i]];
                removed++;
            }
        }

        // Remove matching symbols
        for (uint256 i = 0; i < _symbolKeys.length; i++) {
            if (_symbols[_symbolKeys[i]].exists &&
                keccak256(bytes(_symbols[_symbolKeys[i]].file)) == keccak256(bytes(path))) {
                delete _symbols[_symbolKeys[i]];
                removed++;
            }
        }

        // Remove matching files
        bytes32 fileId = keccak256(abi.encodePacked("file", path));
        if (_files[fileId].exists) {
            delete _files[fileId];
            removed++;
        }

        _lastUpdated = block.timestamp;

        emit RemoveByFileCompleted("ok", removed);
        return removed;
    }

    /// @notice Clear all index entries
    /// @return cleared The total number of entries cleared
    function clear() external returns (int256 cleared) {
        cleared = int256(uint256(_conceptKeys.length + _syncKeys.length + _symbolKeys.length + _fileKeys.length));

        for (uint256 i = 0; i < _conceptKeys.length; i++) {
            delete _concepts[_conceptKeys[i]];
        }
        delete _conceptKeys;

        for (uint256 i = 0; i < _syncKeys.length; i++) {
            delete _syncs[_syncKeys[i]];
        }
        delete _syncKeys;

        for (uint256 i = 0; i < _symbolKeys.length; i++) {
            delete _symbols[_symbolKeys[i]];
        }
        delete _symbolKeys;

        for (uint256 i = 0; i < _fileKeys.length; i++) {
            delete _files[_fileKeys[i]];
        }
        delete _fileKeys;

        _lastUpdated = block.timestamp;

        emit ClearCompleted("ok", cleared);
        return cleared;
    }

    /// @notice Get index statistics
    /// @return conceptCount Number of indexed concepts
    /// @return syncCount Number of indexed syncs
    /// @return symbolCount Number of indexed symbols
    /// @return fileCount Number of indexed files
    /// @return lastUpdated Timestamp of last index modification
    function stats() external view returns (int256 conceptCount, int256 syncCount, int256 symbolCount, int256 fileCount, uint256 lastUpdated) {
        // Count only existing entries (some may have been soft-deleted via removeByFile)
        int256 cc = 0;
        for (uint256 i = 0; i < _conceptKeys.length; i++) {
            if (_concepts[_conceptKeys[i]].exists) cc++;
        }
        int256 sc = 0;
        for (uint256 i = 0; i < _syncKeys.length; i++) {
            if (_syncs[_syncKeys[i]].exists) sc++;
        }
        int256 syc = 0;
        for (uint256 i = 0; i < _symbolKeys.length; i++) {
            if (_symbols[_symbolKeys[i]].exists) syc++;
        }
        int256 fc = 0;
        for (uint256 i = 0; i < _fileKeys.length; i++) {
            if (_files[_fileKeys[i]].exists) fc++;
        }

        return (cc, sc, syc, fc, _lastUpdated);
    }
}

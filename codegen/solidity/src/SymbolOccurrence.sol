// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SymbolOccurrence
/// @notice Symbol occurrence tracking for recording and finding symbol locations
/// @dev Implements the SymbolOccurrence concept from Clef specification.
///      Supports recording occurrence locations with position data, finding
///      definitions, references, occurrences at positions, and occurrences in files.

contract SymbolOccurrence {

    // --- Types ---

    struct RecordInput {
        string symbol;
        string file;
        int256 startRow;
        int256 startCol;
        int256 endRow;
        int256 endCol;
        int256 startByte;
        int256 endByte;
        string role;
    }

    struct RecordOkResult {
        bool success;
        bytes32 occurrence;
    }

    struct FindDefinitionsOkResult {
        bool success;
        string occurrences;
    }

    struct FindReferencesInput {
        string symbol;
        string roleFilter;
    }

    struct FindReferencesOkResult {
        bool success;
        string occurrences;
    }

    struct FindAtPositionInput {
        string file;
        int256 row;
        int256 col;
    }

    struct FindAtPositionOkResult {
        bool success;
        bytes32 occurrence;
        string symbol;
    }

    struct FindInFileOkResult {
        bool success;
        string occurrences;
    }

    /// @dev Internal representation of an occurrence entry
    struct OccurrenceEntry {
        string symbol;
        string file;
        int256 startRow;
        int256 startCol;
        int256 endRow;
        int256 endCol;
        int256 startByte;
        int256 endByte;
        string role;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps occurrence ID to its OccurrenceEntry
    mapping(bytes32 => OccurrenceEntry) private _occurrences;

    /// @dev Ordered list of all occurrence IDs
    bytes32[] private _occurrenceIds;

    /// @dev Nonce for unique ID generation
    uint256 private _nonce;

    // --- Events ---

    event RecordCompleted(string variant, bytes32 occurrence);
    event FindDefinitionsCompleted(string variant);
    event FindReferencesCompleted(string variant);
    event FindAtPositionCompleted(string variant, bytes32 occurrence);
    event FindInFileCompleted(string variant);

    // --- Actions ---

    /// @notice record
    function record(string memory symbol, string memory file, int256 startRow, int256 startCol, int256 endRow, int256 endCol, int256 startByte, int256 endByte, string memory role) external returns (RecordOkResult memory) {
        require(bytes(symbol).length > 0, "Symbol cannot be empty");
        require(bytes(file).length > 0, "File cannot be empty");
        require(bytes(role).length > 0, "Role cannot be empty");

        _nonce++;
        bytes32 occurrenceId = keccak256(abi.encodePacked(symbol, file, startRow, startCol, _nonce));

        _occurrences[occurrenceId] = OccurrenceEntry({
            symbol: symbol,
            file: file,
            startRow: startRow,
            startCol: startCol,
            endRow: endRow,
            endCol: endCol,
            startByte: startByte,
            endByte: endByte,
            role: role,
            exists: true
        });

        _occurrenceIds.push(occurrenceId);

        emit RecordCompleted("ok", occurrenceId);

        return RecordOkResult({
            success: true,
            occurrence: occurrenceId
        });
    }

    /// @notice findDefinitions
    function findDefinitions(string memory symbol) external returns (FindDefinitionsOkResult memory) {
        require(bytes(symbol).length > 0, "Symbol cannot be empty");

        bytes32 symbolHash = keccak256(abi.encodePacked(symbol));
        bytes32 defHash = keccak256(abi.encodePacked("definition"));
        string memory result = "";
        bool first = true;

        for (uint256 i = 0; i < _occurrenceIds.length; i++) {
            OccurrenceEntry storage entry = _occurrences[_occurrenceIds[i]];
            if (entry.exists
                && keccak256(abi.encodePacked(entry.symbol)) == symbolHash
                && keccak256(abi.encodePacked(entry.role)) == defHash) {
                string memory loc = string(abi.encodePacked(entry.file));
                if (!first) {
                    result = string(abi.encodePacked(result, ",", loc));
                } else {
                    result = loc;
                    first = false;
                }
            }
        }

        emit FindDefinitionsCompleted("ok");

        return FindDefinitionsOkResult({
            success: true,
            occurrences: result
        });
    }

    /// @notice findReferences
    function findReferences(string memory symbol, string memory roleFilter) external returns (FindReferencesOkResult memory) {
        require(bytes(symbol).length > 0, "Symbol cannot be empty");

        bytes32 symbolHash = keccak256(abi.encodePacked(symbol));
        bool hasRoleFilter = bytes(roleFilter).length > 0;
        bytes32 roleHash = keccak256(abi.encodePacked(roleFilter));
        string memory result = "";
        bool first = true;

        for (uint256 i = 0; i < _occurrenceIds.length; i++) {
            OccurrenceEntry storage entry = _occurrences[_occurrenceIds[i]];
            if (entry.exists && keccak256(abi.encodePacked(entry.symbol)) == symbolHash) {
                if (hasRoleFilter && keccak256(abi.encodePacked(entry.role)) != roleHash) {
                    continue;
                }
                string memory loc = string(abi.encodePacked(entry.file));
                if (!first) {
                    result = string(abi.encodePacked(result, ",", loc));
                } else {
                    result = loc;
                    first = false;
                }
            }
        }

        emit FindReferencesCompleted("ok");

        return FindReferencesOkResult({
            success: true,
            occurrences: result
        });
    }

    /// @notice findAtPosition
    function findAtPosition(string memory file, int256 row, int256 col) external returns (FindAtPositionOkResult memory) {
        require(bytes(file).length > 0, "File cannot be empty");

        bytes32 fileHash = keccak256(abi.encodePacked(file));

        for (uint256 i = 0; i < _occurrenceIds.length; i++) {
            OccurrenceEntry storage entry = _occurrences[_occurrenceIds[i]];
            if (entry.exists && keccak256(abi.encodePacked(entry.file)) == fileHash) {
                // Check if position falls within the occurrence range
                if (row >= entry.startRow && row <= entry.endRow) {
                    if (row == entry.startRow && col < entry.startCol) continue;
                    if (row == entry.endRow && col > entry.endCol) continue;

                    emit FindAtPositionCompleted("ok", _occurrenceIds[i]);

                    return FindAtPositionOkResult({
                        success: true,
                        occurrence: _occurrenceIds[i],
                        symbol: entry.symbol
                    });
                }
            }
        }

        revert("No occurrence at position");
    }

    /// @notice findInFile
    function findInFile(string memory file) external returns (FindInFileOkResult memory) {
        require(bytes(file).length > 0, "File cannot be empty");

        bytes32 fileHash = keccak256(abi.encodePacked(file));
        string memory result = "";
        bool first = true;

        for (uint256 i = 0; i < _occurrenceIds.length; i++) {
            OccurrenceEntry storage entry = _occurrences[_occurrenceIds[i]];
            if (entry.exists && keccak256(abi.encodePacked(entry.file)) == fileHash) {
                if (!first) {
                    result = string(abi.encodePacked(result, ",", entry.symbol));
                } else {
                    result = entry.symbol;
                    first = false;
                }
            }
        }

        emit FindInFileCompleted("ok");

        return FindInFileOkResult({
            success: true,
            occurrences: result
        });
    }

    // --- Views ---

    /// @notice Check if an occurrence exists
    /// @param occurrence The occurrence ID to check
    /// @return Whether the occurrence exists
    function occurrenceExists(bytes32 occurrence) external view returns (bool) {
        return _occurrences[occurrence].exists;
    }

    /// @notice Get the total number of recorded occurrences
    /// @return The count of occurrences
    function occurrenceCount() external view returns (uint256) {
        return _occurrenceIds.length;
    }
}

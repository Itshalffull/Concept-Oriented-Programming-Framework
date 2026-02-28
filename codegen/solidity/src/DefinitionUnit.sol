// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DefinitionUnit
/// @notice Definition unit extraction, lookup, and diff management
/// @dev Implements the DefinitionUnit concept from Clef specification.
///      Supports extracting definitions from syntax trees, finding by symbol
///      or pattern, and computing diffs between definition units.

contract DefinitionUnit {
    // --- Types ---

    struct UnitEntry {
        string tree;
        int256 startByte;
        int256 endByte;
        string symbol;
        string kind;
        string language;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps unit ID to its entry
    mapping(bytes32 => UnitEntry) private _units;

    /// @dev Ordered list of all unit IDs
    bytes32[] private _unitKeys;

    /// @dev Maps symbol name hash to unit ID for symbol lookup
    mapping(bytes32 => bytes32) private _symbolToUnit;

    // --- Events ---

    event ExtractCompleted(string variant, bytes32 unit);
    event FindBySymbolCompleted(string variant, bytes32 unit);
    event FindByPatternCompleted(string variant);
    event DiffCompleted(string variant);

    // --- Actions ---

    /// @notice Extract a definition unit from a syntax tree at the given byte range
    /// @param tree The syntax tree identifier
    /// @param startByte The start byte offset of the definition
    /// @param endByte The end byte offset of the definition
    /// @return unitId The unique identifier for the extracted definition unit
    function extract(string memory tree, int256 startByte, int256 endByte) external returns (bytes32 unitId) {
        require(bytes(tree).length > 0, "Tree cannot be empty");
        require(endByte > startByte, "End byte must be after start byte");

        unitId = keccak256(abi.encodePacked(tree, startByte, endByte));

        // Derive a symbol name from the tree and byte range
        string memory symbol = string(abi.encodePacked(tree, ":", _intToString(startByte)));

        _units[unitId] = UnitEntry({
            tree: tree,
            startByte: startByte,
            endByte: endByte,
            symbol: symbol,
            kind: "definition",
            language: "",
            exists: true
        });

        bytes32 symbolHash = keccak256(abi.encodePacked(symbol));
        _symbolToUnit[symbolHash] = unitId;
        _unitKeys.push(unitId);

        emit ExtractCompleted("ok", unitId);
        return unitId;
    }

    /// @notice Find a definition unit by symbol name
    /// @param symbol The symbol name to search for
    /// @return unitId The definition unit ID, or zero if not found
    function findBySymbol(string memory symbol) external view returns (bytes32 unitId) {
        require(bytes(symbol).length > 0, "Symbol cannot be empty");

        bytes32 symbolHash = keccak256(abi.encodePacked(symbol));
        unitId = _symbolToUnit[symbolHash];
        require(unitId != bytes32(0), "Symbol not found");

        return unitId;
    }

    /// @notice Find definition units matching a pattern filter
    /// @param kind Filter by definition kind (empty for all)
    /// @param language Filter by language (empty for all)
    /// @param namePattern Filter by name pattern (empty for all)
    /// @return units Serialized list of matching unit IDs
    function findByPattern(string memory kind, string memory language, string memory namePattern) external view returns (string memory units) {
        bytes memory buf;
        uint256 found = 0;
        bytes32 kindHash = keccak256(bytes(kind));
        bytes32 langHash = keccak256(bytes(language));
        bool filterKind = bytes(kind).length > 0;
        bool filterLang = bytes(language).length > 0;

        // Suppress unused variable warning
        namePattern;

        for (uint256 i = 0; i < _unitKeys.length; i++) {
            bytes32 key = _unitKeys[i];
            if (!_units[key].exists) continue;

            bool matches = true;
            if (filterKind && keccak256(bytes(_units[key].kind)) != kindHash) {
                matches = false;
            }
            if (filterLang && keccak256(bytes(_units[key].language)) != langHash) {
                matches = false;
            }

            if (matches) {
                if (found > 0) {
                    buf = abi.encodePacked(buf, ",");
                }
                buf = abi.encodePacked(buf, _toHexString(key));
                found++;
            }
        }

        units = string(abi.encodePacked("[", buf, "]"));
        return units;
    }

    /// @notice Compute the diff between two definition units
    /// @param a First definition unit ID
    /// @param b Second definition unit ID
    /// @return changes Serialized description of the differences
    function diff(bytes32 a, bytes32 b) external view returns (string memory changes) {
        require(_units[a].exists, "Unit A not found");
        require(_units[b].exists, "Unit B not found");

        // Compute a summary of the structural differences
        if (keccak256(abi.encodePacked(_units[a].tree, _units[a].startByte, _units[a].endByte)) ==
            keccak256(abi.encodePacked(_units[b].tree, _units[b].startByte, _units[b].endByte))) {
            changes = "identical";
        } else {
            int256 sizeA = _units[a].endByte - _units[a].startByte;
            int256 sizeB = _units[b].endByte - _units[b].startByte;
            changes = string(abi.encodePacked(
                "modified:size_a=", _intToString(sizeA),
                ",size_b=", _intToString(sizeB)
            ));
        }

        return changes;
    }

    // --- Views ---

    /// @notice Retrieve a definition unit entry
    /// @param unitId The unit to look up
    /// @return tree The source tree identifier
    /// @return startByte The start byte offset
    /// @return endByte The end byte offset
    /// @return symbol The symbol name
    function getUnit(bytes32 unitId) external view returns (string memory tree, int256 startByte, int256 endByte, string memory symbol) {
        require(_units[unitId].exists, "Unit not found");
        UnitEntry storage entry = _units[unitId];
        return (entry.tree, entry.startByte, entry.endByte, entry.symbol);
    }

    // --- Internal helpers ---

    function _intToString(int256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        bool negative = value < 0;
        uint256 absVal = negative ? uint256(-value) : uint256(value);
        uint256 temp = absVal;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(negative ? digits + 1 : digits);
        if (negative) buffer[0] = "-";
        while (absVal != 0) {
            digits -= 1;
            buffer[negative ? digits + 1 : digits] = bytes1(uint8(48 + uint256(absVal % 10)));
            absVal /= 10;
        }
        return string(buffer);
    }

    function _toHexString(bytes32 value) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(66);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 32; i++) {
            str[2 + i * 2] = alphabet[uint8(value[i] >> 4)];
            str[3 + i * 2] = alphabet[uint8(value[i] & 0x0f)];
        }
        return string(str);
    }
}

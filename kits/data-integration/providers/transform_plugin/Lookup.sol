// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Lookup Transform Provider
/// @notice Map values via an on-chain lookup table.
/// See Architecture doc for transform plugin interface contract.
contract LookupTransformProvider {
    string public constant PROVIDER_ID = "lookup";
    string public constant PLUGIN_TYPE = "transform_plugin";

    struct LookupEntry {
        string key;
        string value;
    }

    mapping(bytes32 => string) private _table;
    mapping(bytes32 => bool) private _exists;
    string private _defaultValue;
    bool private _hasDefault;

    /// @notice Set the lookup table entries.
    function setTable(LookupEntry[] calldata entries) external {
        for (uint i = 0; i < entries.length; i++) {
            bytes32 keyHash = keccak256(bytes(entries[i].key));
            _table[keyHash] = entries[i].value;
            _exists[keyHash] = true;

            // Also store lowercase version for case-insensitive matching
            bytes32 lowerHash = keccak256(bytes(_toLower(entries[i].key)));
            if (!_exists[lowerHash]) {
                _table[lowerHash] = entries[i].value;
                _exists[lowerHash] = true;
            }
        }
    }

    /// @notice Set the default value for unmatched keys.
    function setDefault(string calldata defaultVal) external {
        _defaultValue = defaultVal;
        _hasDefault = true;
    }

    /// @notice Look up the value; config is unused (table set via setTable).
    function transform(string calldata value, string calldata /* config */) external view returns (string memory) {
        // Direct match
        bytes32 keyHash = keccak256(bytes(value));
        if (_exists[keyHash]) {
            return _table[keyHash];
        }

        // Case-insensitive match
        bytes32 lowerHash = keccak256(bytes(_toLower(value)));
        if (_exists[lowerHash]) {
            return _table[lowerHash];
        }

        // Default
        if (_hasDefault) {
            return _defaultValue;
        }

        return value;
    }

    function inputType() external pure returns (string memory) {
        return "string";
    }

    function outputType() external pure returns (string memory) {
        return "string";
    }

    function _toLower(string memory str) internal pure returns (string memory) {
        bytes memory bStr = bytes(str);
        bytes memory bLower = new bytes(bStr.length);
        for (uint i = 0; i < bStr.length; i++) {
            if (bStr[i] >= 0x41 && bStr[i] <= 0x5A) {
                bLower[i] = bytes1(uint8(bStr[i]) + 32);
            } else {
                bLower[i] = bStr[i];
            }
        }
        return string(bLower);
    }
}

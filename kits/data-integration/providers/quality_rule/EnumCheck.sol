// SPDX-License-Identifier: MIT
// Quality Rule Provider: Enum Check Validation
// Validates field values belong to a set of allowed values using on-chain mappings.
// Dimension: validity

pragma solidity ^0.8.20;

contract EnumCheckQualityProvider {
    string public constant PROVIDER_ID = "enum_check";
    string public constant PLUGIN_TYPE = "quality_rule";

    /// @notice Owner who can manage allowed values.
    address public owner;

    /// @notice Mapping of field name hash => allowed value hash => is allowed.
    mapping(bytes32 => mapping(bytes32 => bool)) private _allowedValues;

    /// @notice Mapping of field name hash => number of allowed values registered.
    mapping(bytes32 => uint256) private _allowedCount;

    /// @notice Whether comparison should be case-sensitive for a field.
    mapping(bytes32 => bool) private _caseSensitive;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can manage allowed values");
        _;
    }

    /// @notice Register allowed values for a specific field.
    /// @param field The field name.
    /// @param values Array of allowed value hashes (keccak256 of the string values).
    /// @param caseSensitive Whether comparison should be case-sensitive.
    function registerAllowedValues(
        string calldata field,
        bytes32[] calldata values,
        bool caseSensitive
    ) external onlyOwner {
        bytes32 fieldHash = keccak256(bytes(field));
        _caseSensitive[fieldHash] = caseSensitive;

        for (uint256 i = 0; i < values.length; i++) {
            _allowedValues[fieldHash][values[i]] = true;
        }
        _allowedCount[fieldHash] += values.length;
    }

    /// @notice Validates a value is in the allowed set.
    /// @param recordId Record identifier.
    /// @param field The field name.
    /// @param value The field value string.
    /// @param config Configuration string.
    function validate(
        bytes32 recordId,
        string calldata field,
        string calldata value,
        string calldata config
    ) external view returns (bool valid, string memory message, uint8 severity) {
        if (bytes(value).length == 0) {
            return (true, "", 1);
        }

        bytes32 fieldHash = keccak256(bytes(field));

        if (_allowedCount[fieldHash] == 0) {
            return (false, string.concat("Enum check for field '", field, "': no allowed values registered."), 1);
        }

        bytes32 valueHash;
        if (_caseSensitive[fieldHash]) {
            valueHash = keccak256(bytes(value));
        } else {
            valueHash = keccak256(bytes(_toLower(value)));
        }

        if (!_allowedValues[fieldHash][valueHash]) {
            return (
                false,
                string.concat("Field '", field, "' value is not in the allowed set."),
                0
            );
        }

        return (true, "", 0);
    }

    /// @notice Converts a string to lowercase (ASCII only).
    function _toLower(string calldata str) internal pure returns (string memory) {
        bytes memory b = bytes(str);
        bytes memory result = new bytes(b.length);
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] >= 0x41 && b[i] <= 0x5A) {
                result[i] = bytes1(uint8(b[i]) + 32);
            } else {
                result[i] = b[i];
            }
        }
        return string(result);
    }

    function appliesTo(string calldata /* fieldType */) external pure returns (bool) {
        return true;
    }

    function dimension() external pure returns (string memory) {
        return "validity";
    }
}

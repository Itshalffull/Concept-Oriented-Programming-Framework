// SPDX-License-Identifier: MIT
// Quality Rule Provider: Unique Value Validation
// Ensures field values are unique across all records using on-chain mappings.
// Dimension: uniqueness

pragma solidity ^0.8.20;

contract UniqueQualityProvider {
    string public constant PROVIDER_ID = "unique";
    string public constant PLUGIN_TYPE = "quality_rule";

    /// @notice Tracks seen values: keccak256(field, value) => exists
    mapping(bytes32 => bool) private _seenValues;

    /// @notice Tracks seen values per type: keccak256(type, field, value) => exists
    mapping(bytes32 => bool) private _scopedSeenValues;

    /// @notice Owner who can reset state.
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    /// @notice Validates uniqueness by checking an internal mapping.
    /// @param recordId Unique identifier for the record.
    /// @param field The field name being validated.
    /// @param value The field value to check for uniqueness.
    /// @param config Encoded config; may contain scope type.
    /// @return valid Whether the value is unique.
    /// @return message Validation message.
    /// @return severity 0 = error, 1 = warning, 2 = info.
    function validate(
        bytes32 recordId,
        string calldata field,
        string calldata value,
        string calldata config
    ) external returns (bool valid, string memory message, uint8 severity) {
        if (bytes(value).length == 0) {
            return (true, "", 0);
        }

        bytes32 valueHash = keccak256(abi.encodePacked(field, "::", value));

        if (_seenValues[valueHash]) {
            return (
                false,
                string.concat("Field '", field, "' value is not unique."),
                0
            );
        }

        _seenValues[valueHash] = true;
        return (true, "", 0);
    }

    /// @notice Validates uniqueness within a specific record type scope.
    /// @param recordType The type/category of the record.
    /// @param field The field name being validated.
    /// @param value The field value to check.
    function validateScoped(
        string calldata recordType,
        string calldata field,
        string calldata value
    ) external returns (bool valid, string memory message, uint8 severity) {
        if (bytes(value).length == 0) {
            return (true, "", 0);
        }

        bytes32 valueHash = keccak256(abi.encodePacked(recordType, "::", field, "::", value));

        if (_scopedSeenValues[valueHash]) {
            return (
                false,
                string.concat("Field '", field, "' value is not unique within type '", recordType, "'."),
                0
            );
        }

        _scopedSeenValues[valueHash] = true;
        return (true, "", 0);
    }

    function appliesTo(string calldata /* fieldType */) external pure returns (bool) {
        return true;
    }

    function dimension() external pure returns (string memory) {
        return "uniqueness";
    }
}

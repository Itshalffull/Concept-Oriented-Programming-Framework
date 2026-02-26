// SPDX-License-Identifier: MIT
// Quality Rule Provider: Foreign Key Validation
// Ensures referenced entities exist using on-chain mapping lookups.
// Dimension: consistency

pragma solidity ^0.8.20;

contract ForeignKeyQualityProvider {
    string public constant PROVIDER_ID = "foreign_key";
    string public constant PLUGIN_TYPE = "quality_rule";

    address public owner;

    /// @notice Reference store: keccak256(targetType, targetField, refValue) => exists.
    mapping(bytes32 => bool) private _references;

    /// @notice Track whether references have been loaded for a target.
    mapping(bytes32 => bool) private _targetLoaded;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can manage references");
        _;
    }

    /// @notice Register reference values for a target type and field.
    /// @param targetType The target content type name.
    /// @param targetField The target field name.
    /// @param valueHashes Array of keccak256 hashes of valid reference values.
    function registerReferences(
        string calldata targetType,
        string calldata targetField,
        bytes32[] calldata valueHashes
    ) external onlyOwner {
        bytes32 targetKey = keccak256(abi.encodePacked(targetType, "::", targetField));
        _targetLoaded[targetKey] = true;

        for (uint256 i = 0; i < valueHashes.length; i++) {
            bytes32 refKey = keccak256(abi.encodePacked(targetType, "::", targetField, "::", valueHashes[i]));
            _references[refKey] = true;
        }
    }

    /// @notice Register a single string reference value.
    function registerReference(
        string calldata targetType,
        string calldata targetField,
        string calldata value
    ) external onlyOwner {
        bytes32 targetKey = keccak256(abi.encodePacked(targetType, "::", targetField));
        _targetLoaded[targetKey] = true;

        bytes32 valueHash = keccak256(bytes(value));
        bytes32 refKey = keccak256(abi.encodePacked(targetType, "::", targetField, "::", valueHash));
        _references[refKey] = true;
    }

    /// @notice Validates that a foreign key reference exists.
    /// @param recordId Record identifier.
    /// @param field The field name containing the reference.
    /// @param value The reference value to look up.
    /// @param config Unused in Solidity version.
    function validate(
        bytes32 recordId,
        string calldata field,
        string calldata value,
        string calldata config
    ) external view returns (bool valid, string memory message, uint8 severity) {
        if (bytes(value).length == 0) {
            return (true, "", 0);
        }

        // Default: requires explicit validateFK call with target info
        return (true, "", 0);
    }

    /// @notice Validates a foreign key reference against a specific target type and field.
    /// @param field The source field name.
    /// @param value The reference value.
    /// @param targetType The target content type.
    /// @param targetField The target field name.
    function validateFK(
        string calldata field,
        string calldata value,
        string calldata targetType,
        string calldata targetField
    ) external view returns (bool valid, string memory message, uint8 severity) {
        if (bytes(value).length == 0) {
            return (true, "", 0);
        }

        bytes32 targetKey = keccak256(abi.encodePacked(targetType, "::", targetField));
        if (!_targetLoaded[targetKey]) {
            return (
                false,
                string.concat("Foreign key rule for field '", field, "': no reference data loaded for target."),
                0
            );
        }

        bytes32 valueHash = keccak256(bytes(value));
        bytes32 refKey = keccak256(abi.encodePacked(targetType, "::", targetField, "::", valueHash));

        if (!_references[refKey]) {
            return (
                false,
                string.concat("Field '", field, "' has a dangling reference. Value not found in target."),
                0
            );
        }

        return (true, "", 0);
    }

    function appliesTo(string calldata /* fieldType */) external pure returns (bool) {
        return true;
    }

    function dimension() external pure returns (string memory) {
        return "consistency";
    }
}

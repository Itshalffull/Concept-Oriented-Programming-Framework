// SPDX-License-Identifier: MIT
// Quality Rule Provider: Required Field Validation
// Ensures fields contain non-empty values (bytes length > 0).
// Dimension: completeness

pragma solidity ^0.8.20;

contract RequiredQualityProvider {
    string public constant PROVIDER_ID = "required";
    string public constant PLUGIN_TYPE = "quality_rule";

    /// @notice Whether to treat whitespace-only strings as empty.
    bool public treatWhitespaceAsEmpty;

    constructor(bool _treatWhitespaceAsEmpty) {
        treatWhitespaceAsEmpty = _treatWhitespaceAsEmpty;
    }

    /// @notice Validates that the value is non-empty.
    /// @param recordId Unique identifier for the record being validated.
    /// @param field The field name being checked.
    /// @param value The field value as a string.
    /// @param config JSON-encoded configuration (unused for basic required check).
    /// @return valid Whether the value passes the required check.
    /// @return message Human-readable validation message.
    /// @return severity 0 = error, 1 = warning, 2 = info.
    function validate(
        bytes32 recordId,
        string calldata field,
        string calldata value,
        string calldata config
    ) external view returns (bool valid, string memory message, uint8 severity) {
        bytes memory valueBytes = bytes(value);

        if (valueBytes.length == 0) {
            return (false, string.concat("Field '", field, "' is required but has no value."), 0);
        }

        if (treatWhitespaceAsEmpty) {
            bool allWhitespace = true;
            for (uint256 i = 0; i < valueBytes.length; i++) {
                bytes1 b = valueBytes[i];
                if (b != 0x20 && b != 0x09 && b != 0x0A && b != 0x0D) {
                    allWhitespace = false;
                    break;
                }
            }
            if (allWhitespace) {
                return (false, string.concat("Field '", field, "' is required but is whitespace-only."), 0);
            }
        }

        return (true, "", 0);
    }

    /// @notice Checks whether this rule applies to the given field type.
    function appliesTo(string calldata /* fieldType */) external pure returns (bool) {
        // Required rule applies to all field types.
        return true;
    }

    /// @notice Returns the quality dimension this rule measures.
    function dimension() external pure returns (string memory) {
        return "completeness";
    }
}

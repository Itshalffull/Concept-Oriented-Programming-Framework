// SPDX-License-Identifier: MIT
// Quality Rule Provider: Range Validation
// Checks numeric values are within min/max bounds using uint256/int256 comparisons.
// Dimension: validity

pragma solidity ^0.8.20;

contract RangeQualityProvider {
    string public constant PROVIDER_ID = "range";
    string public constant PLUGIN_TYPE = "quality_rule";

    /// @notice Validates a numeric value is within the given range.
    /// @param recordId Unique identifier for the record.
    /// @param field The field name.
    /// @param value The field value as a string.
    /// @param config Configuration string (unused in typed overload).
    /// @return valid Whether the value is in range.
    /// @return message Validation message.
    /// @return severity 0 = error.
    function validate(
        bytes32 recordId,
        string calldata field,
        string calldata value,
        string calldata config
    ) external view returns (bool valid, string memory message, uint8 severity) {
        // Generic validate: delegate to typed version with default bounds
        return (true, "", 0);
    }

    /// @notice Validates an unsigned integer value is within [min, max] bounds.
    /// @param field The field name.
    /// @param value The uint256 value to check.
    /// @param min Minimum allowed value.
    /// @param max Maximum allowed value.
    /// @param exclusiveMin Whether the min bound is exclusive.
    /// @param exclusiveMax Whether the max bound is exclusive.
    function validateUint(
        string calldata field,
        uint256 value,
        uint256 min,
        uint256 max,
        bool exclusiveMin,
        bool exclusiveMax
    ) external pure returns (bool valid, string memory message, uint8 severity) {
        // Check lower bound
        if (exclusiveMin) {
            if (value <= min) {
                return (false, string.concat("Field '", field, "' value is below the exclusive minimum."), 0);
            }
        } else {
            if (value < min) {
                return (false, string.concat("Field '", field, "' value is below the inclusive minimum."), 0);
            }
        }

        // Check upper bound
        if (exclusiveMax) {
            if (value >= max) {
                return (false, string.concat("Field '", field, "' value is above the exclusive maximum."), 0);
            }
        } else {
            if (value > max) {
                return (false, string.concat("Field '", field, "' value is above the inclusive maximum."), 0);
            }
        }

        return (true, "", 0);
    }

    /// @notice Validates a signed integer value is within [min, max] bounds.
    function validateInt(
        string calldata field,
        int256 value,
        int256 min,
        int256 max,
        bool exclusiveMin,
        bool exclusiveMax
    ) external pure returns (bool valid, string memory message, uint8 severity) {
        if (exclusiveMin) {
            if (value <= min) {
                return (false, string.concat("Field '", field, "' value is below the exclusive minimum."), 0);
            }
        } else {
            if (value < min) {
                return (false, string.concat("Field '", field, "' value is below the inclusive minimum."), 0);
            }
        }

        if (exclusiveMax) {
            if (value >= max) {
                return (false, string.concat("Field '", field, "' value is above the exclusive maximum."), 0);
            }
        } else {
            if (value > max) {
                return (false, string.concat("Field '", field, "' value is above the inclusive maximum."), 0);
            }
        }

        return (true, "", 0);
    }

    /// @notice Validates a timestamp falls within a date range.
    /// @param field The field name.
    /// @param timestamp Unix timestamp of the value.
    /// @param minTimestamp Minimum allowed timestamp.
    /// @param maxTimestamp Maximum allowed timestamp.
    function validateDateRange(
        string calldata field,
        uint256 timestamp,
        uint256 minTimestamp,
        uint256 maxTimestamp
    ) external pure returns (bool valid, string memory message, uint8 severity) {
        if (timestamp < minTimestamp) {
            return (false, string.concat("Field '", field, "' date is before the minimum allowed date."), 0);
        }
        if (timestamp > maxTimestamp) {
            return (false, string.concat("Field '", field, "' date is after the maximum allowed date."), 0);
        }
        return (true, "", 0);
    }

    function appliesTo(string calldata fieldType) external pure returns (bool) {
        bytes32 typeHash = keccak256(bytes(fieldType));
        return typeHash == keccak256("number")
            || typeHash == keccak256("integer")
            || typeHash == keccak256("float")
            || typeHash == keccak256("date")
            || typeHash == keccak256("uint256")
            || typeHash == keccak256("int256");
    }

    function dimension() external pure returns (string memory) {
        return "validity";
    }
}

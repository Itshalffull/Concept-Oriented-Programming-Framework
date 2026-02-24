// SPDX-License-Identifier: MIT
// Quality Rule Provider: Cross-Field Validation
// Evaluates multi-field validation rules on-chain using typed comparisons.
// Dimension: consistency

pragma solidity ^0.8.20;

contract CrossFieldQualityProvider {
    string public constant PROVIDER_ID = "cross_field";
    string public constant PLUGIN_TYPE = "quality_rule";

    /// @notice Comparison operators for cross-field rules.
    enum CompareOp { GT, GTE, LT, LTE, EQ, NEQ }

    /// @notice Generic validate entry point.
    function validate(
        bytes32 recordId,
        string calldata field,
        string calldata value,
        string calldata config
    ) external view returns (bool valid, string memory message, uint8 severity) {
        // Cross-field validation requires multiple field values;
        // use typed overloads for actual validation.
        return (true, "", 0);
    }

    /// @notice Validates that two uint256 values satisfy a comparison.
    /// @param field The logical rule name or primary field.
    /// @param leftValue The left-hand side value.
    /// @param rightValue The right-hand side value.
    /// @param op The comparison operator.
    function validateUintComparison(
        string calldata field,
        uint256 leftValue,
        uint256 rightValue,
        CompareOp op
    ) external pure returns (bool valid, string memory message, uint8 severity) {
        bool result;

        if (op == CompareOp.GT) {
            result = leftValue > rightValue;
        } else if (op == CompareOp.GTE) {
            result = leftValue >= rightValue;
        } else if (op == CompareOp.LT) {
            result = leftValue < rightValue;
        } else if (op == CompareOp.LTE) {
            result = leftValue <= rightValue;
        } else if (op == CompareOp.EQ) {
            result = leftValue == rightValue;
        } else {
            result = leftValue != rightValue;
        }

        if (!result) {
            return (false, string.concat("Cross-field validation failed for '", field, "'."), 0);
        }
        return (true, "", 0);
    }

    /// @notice Validates that two int256 values satisfy a comparison.
    function validateIntComparison(
        string calldata field,
        int256 leftValue,
        int256 rightValue,
        CompareOp op
    ) external pure returns (bool valid, string memory message, uint8 severity) {
        bool result;

        if (op == CompareOp.GT) {
            result = leftValue > rightValue;
        } else if (op == CompareOp.GTE) {
            result = leftValue >= rightValue;
        } else if (op == CompareOp.LT) {
            result = leftValue < rightValue;
        } else if (op == CompareOp.LTE) {
            result = leftValue <= rightValue;
        } else if (op == CompareOp.EQ) {
            result = leftValue == rightValue;
        } else {
            result = leftValue != rightValue;
        }

        if (!result) {
            return (false, string.concat("Cross-field validation failed for '", field, "'."), 0);
        }
        return (true, "", 0);
    }

    /// @notice Conditional required: if conditionField has conditionValue, then requiredField must be non-empty.
    /// @param field The rule name.
    /// @param conditionValue The value that triggers the requirement.
    /// @param actualConditionValue The actual value of the condition field.
    /// @param requiredFieldValue The value of the field that must be non-empty.
    function validateConditionalRequired(
        string calldata field,
        string calldata conditionValue,
        string calldata actualConditionValue,
        string calldata requiredFieldValue
    ) external pure returns (bool valid, string memory message, uint8 severity) {
        // Check if condition is met
        if (keccak256(bytes(actualConditionValue)) == keccak256(bytes(conditionValue))) {
            // Condition met: required field must have value
            if (bytes(requiredFieldValue).length == 0) {
                return (
                    false,
                    string.concat("Cross-field validation failed for '", field, "': conditional required field is empty."),
                    0
                );
            }
        }
        return (true, "", 0);
    }

    /// @notice Validates that exactly one of the provided boolean flags is true.
    /// @param field The rule name.
    /// @param flags Array of boolean values representing field presence.
    function validateExactlyOneOf(
        string calldata field,
        bool[] calldata flags
    ) external pure returns (bool valid, string memory message, uint8 severity) {
        uint256 count = 0;
        for (uint256 i = 0; i < flags.length; i++) {
            if (flags[i]) count++;
        }
        if (count != 1) {
            return (
                false,
                string.concat("Cross-field validation failed for '", field, "': exactly one field must be present."),
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

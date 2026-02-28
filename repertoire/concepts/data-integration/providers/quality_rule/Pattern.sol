// SPDX-License-Identifier: MIT
// Quality Rule Provider: Pattern Validation
// Basic character-by-character pattern matching for on-chain string validation.
// Dimension: validity

pragma solidity ^0.8.20;

contract PatternQualityProvider {
    string public constant PROVIDER_ID = "pattern";
    string public constant PLUGIN_TYPE = "quality_rule";

    /// @notice Validates a string value against a simple pattern.
    /// @param recordId Unique record identifier.
    /// @param field The field name.
    /// @param value The string value to validate.
    /// @param config Configuration (pattern encoded separately for gas efficiency).
    function validate(
        bytes32 recordId,
        string calldata field,
        string calldata value,
        string calldata config
    ) external view returns (bool valid, string memory message, uint8 severity) {
        // Default validate always passes; use validatePattern for actual matching
        return (true, "", 0);
    }

    /// @notice Matches value against a simple pattern using character classes.
    /// @dev Supports: 'A' = uppercase letter, 'a' = lowercase letter, '9' = digit,
    ///      '*' = any character, literal characters match themselves.
    /// @param field The field name.
    /// @param value The string to validate.
    /// @param pattern The pattern string (e.g., "999-999-9999" for phone numbers).
    function validatePattern(
        string calldata field,
        string calldata value,
        string calldata pattern
    ) external pure returns (bool valid, string memory message, uint8 severity) {
        bytes memory valueBytes = bytes(value);
        bytes memory patternBytes = bytes(pattern);

        if (valueBytes.length != patternBytes.length) {
            return (
                false,
                string.concat("Field '", field, "' length does not match pattern length."),
                0
            );
        }

        for (uint256 i = 0; i < patternBytes.length; i++) {
            bytes1 p = patternBytes[i];
            bytes1 v = valueBytes[i];

            if (p == 0x39) { // '9' - digit expected
                if (v < 0x30 || v > 0x39) {
                    return (false, string.concat("Field '", field, "' does not match pattern: expected digit."), 0);
                }
            } else if (p == 0x41) { // 'A' - uppercase letter expected
                if (v < 0x41 || v > 0x5A) {
                    return (false, string.concat("Field '", field, "' does not match pattern: expected uppercase letter."), 0);
                }
            } else if (p == 0x61) { // 'a' - lowercase letter expected
                if (v < 0x61 || v > 0x7A) {
                    return (false, string.concat("Field '", field, "' does not match pattern: expected lowercase letter."), 0);
                }
            } else if (p == 0x2A) { // '*' - any character
                continue;
            } else {
                // Literal match
                if (v != p) {
                    return (false, string.concat("Field '", field, "' does not match pattern at position."), 0);
                }
            }
        }

        return (true, "", 0);
    }

    /// @notice Checks if value contains only hex characters (0-9, a-f, A-F).
    function validateHexPattern(
        string calldata field,
        string calldata value
    ) external pure returns (bool valid, string memory message, uint8 severity) {
        bytes memory valueBytes = bytes(value);
        for (uint256 i = 0; i < valueBytes.length; i++) {
            bytes1 b = valueBytes[i];
            bool isHex = (b >= 0x30 && b <= 0x39)
                || (b >= 0x41 && b <= 0x46)
                || (b >= 0x61 && b <= 0x66);
            if (!isHex) {
                return (false, string.concat("Field '", field, "' contains non-hex character."), 0);
            }
        }
        return (true, "", 0);
    }

    /// @notice Checks if value matches an email-like pattern: chars@chars.chars
    function validateEmailPattern(
        string calldata field,
        string calldata value
    ) external pure returns (bool valid, string memory message, uint8 severity) {
        bytes memory v = bytes(value);
        bool foundAt = false;
        bool foundDotAfterAt = false;
        uint256 atPos = 0;

        for (uint256 i = 0; i < v.length; i++) {
            if (v[i] == 0x40) { // '@'
                if (foundAt || i == 0) {
                    return (false, string.concat("Field '", field, "' is not a valid email pattern."), 0);
                }
                foundAt = true;
                atPos = i;
            }
            if (v[i] == 0x2E && foundAt && i > atPos + 1) { // '.' after '@'
                foundDotAfterAt = true;
            }
        }

        if (!foundAt || !foundDotAfterAt) {
            return (false, string.concat("Field '", field, "' is not a valid email pattern."), 0);
        }
        return (true, "", 0);
    }

    function appliesTo(string calldata fieldType) external pure returns (bool) {
        return keccak256(bytes(fieldType)) == keccak256("string");
    }

    function dimension() external pure returns (string memory) {
        return "validity";
    }
}

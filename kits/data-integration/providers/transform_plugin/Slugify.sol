// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Slugify Transform Provider
/// @notice Generate URL-safe slug from input string.
/// See Architecture doc for transform plugin interface contract.
contract SlugifyTransformProvider {
    string public constant PROVIDER_ID = "slugify";
    string public constant PLUGIN_TYPE = "transform_plugin";

    /// @notice Generate a URL-safe slug. Config is ignored (uses default '-' separator).
    /// @param value The input string to slugify.
    /// @param config Unused (separator defaults to hyphen).
    /// @return The URL-safe slug.
    function transform(string calldata value, string calldata config) external pure returns (string memory) {
        bytes memory input = bytes(value);
        if (input.length == 0) return "";

        // Suppress unused parameter warning
        config;

        bytes memory result = new bytes(input.length);
        uint len = 0;
        bool lastWasSep = true; // Avoid leading hyphen

        for (uint i = 0; i < input.length; i++) {
            bytes1 ch = input[i];

            // Lowercase letters: pass through
            if (ch >= 0x61 && ch <= 0x7A) {
                result[len++] = ch;
                lastWasSep = false;
            }
            // Uppercase letters: convert to lowercase
            else if (ch >= 0x41 && ch <= 0x5A) {
                result[len++] = bytes1(uint8(ch) + 32);
                lastWasSep = false;
            }
            // Digits: pass through
            else if (ch >= 0x30 && ch <= 0x39) {
                result[len++] = ch;
                lastWasSep = false;
            }
            // Common Unicode transliterations (basic Latin supplement, single-byte in UTF-8 won't match,
            // but we handle the common case of spaces/special chars)
            else if (!lastWasSep) {
                // Replace any non-alphanumeric with hyphen
                result[len++] = 0x2D; // '-'
                lastWasSep = true;
            }
        }

        // Remove trailing hyphen
        while (len > 0 && result[len - 1] == 0x2D) {
            len--;
        }

        // Build final result
        bytes memory finalResult = new bytes(len);
        for (uint i = 0; i < len; i++) {
            finalResult[i] = result[i];
        }

        return string(finalResult);
    }

    function inputType() external pure returns (string memory) {
        return "string";
    }

    function outputType() external pure returns (string memory) {
        return "string";
    }
}

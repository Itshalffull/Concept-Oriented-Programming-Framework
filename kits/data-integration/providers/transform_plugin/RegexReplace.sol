// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title RegexReplace Transform Provider
/// @notice Literal pattern-based string replacement (Solidity lacks native regex).
/// See Architecture doc for transform plugin interface contract.
contract RegexReplaceTransformProvider {
    string public constant PROVIDER_ID = "regex_replace";
    string public constant PLUGIN_TYPE = "transform_plugin";

    /// @notice Replace occurrences of a literal pattern in the value.
    /// @param value The input string.
    /// @param config The pattern and replacement separated by "|" (e.g., "pattern|replacement").
    /// @return The string with all pattern occurrences replaced.
    function transform(string calldata value, string calldata config) external pure returns (string memory) {
        bytes memory input = bytes(value);
        if (input.length == 0) return "";

        // Parse config: "pattern|replacement"
        (string memory pattern, string memory replacement) = _parseConfig(config);
        bytes memory patternBytes = bytes(pattern);
        bytes memory replacementBytes = bytes(replacement);

        if (patternBytes.length == 0 || patternBytes.length > input.length) {
            return value;
        }

        // Count occurrences to calculate result size
        uint count = 0;
        for (uint i = 0; i <= input.length - patternBytes.length; i++) {
            if (_matchAt(input, patternBytes, i)) {
                count++;
                i += patternBytes.length - 1;
            }
        }

        if (count == 0) {
            return value;
        }

        // Calculate result length
        uint resultLen = input.length - (count * patternBytes.length) + (count * replacementBytes.length);
        bytes memory result = new bytes(resultLen);

        uint ri = 0;
        uint i = 0;

        while (i < input.length) {
            if (i + patternBytes.length <= input.length && _matchAt(input, patternBytes, i)) {
                // Copy replacement
                for (uint j = 0; j < replacementBytes.length; j++) {
                    result[ri++] = replacementBytes[j];
                }
                i += patternBytes.length;
            } else {
                result[ri++] = input[i];
                i++;
            }
        }

        return string(result);
    }

    function _matchAt(bytes memory haystack, bytes memory needle, uint pos) internal pure returns (bool) {
        if (pos + needle.length > haystack.length) return false;
        for (uint i = 0; i < needle.length; i++) {
            if (haystack[pos + i] != needle[i]) return false;
        }
        return true;
    }

    function _parseConfig(string memory config) internal pure returns (string memory pattern, string memory replacement) {
        bytes memory b = bytes(config);
        uint pipePos = type(uint).max;

        for (uint i = 0; i < b.length; i++) {
            if (b[i] == 0x7C) { // '|'
                pipePos = i;
                break;
            }
        }

        if (pipePos == type(uint).max) {
            // No pipe: entire config is the pattern, replacement is empty
            return (config, "");
        }

        bytes memory p = new bytes(pipePos);
        for (uint i = 0; i < pipePos; i++) {
            p[i] = b[i];
        }

        uint repLen = b.length - pipePos - 1;
        bytes memory r = new bytes(repLen);
        for (uint i = 0; i < repLen; i++) {
            r[i] = b[pipePos + 1 + i];
        }

        return (string(p), string(r));
    }

    function inputType() external pure returns (string memory) {
        return "string";
    }

    function outputType() external pure returns (string memory) {
        return "string";
    }
}

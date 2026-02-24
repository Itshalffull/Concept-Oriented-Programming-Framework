// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Concat Transform Provider
/// @notice Merge multiple values into one string with configurable separator.
/// See Architecture doc for transform plugin interface contract.
contract ConcatTransformProvider {
    string public constant PROVIDER_ID = "concat";
    string public constant PLUGIN_TYPE = "transform_plugin";

    /// @notice Concatenate input value with config using a separator.
    /// @param value The primary input string.
    /// @param config The second string to concatenate (separator is space by default).
    /// @return The concatenated result.
    function transform(string calldata value, string calldata config) external pure returns (string memory) {
        // Config format: "separator|value2|value3|..."
        // If config is empty, just return value
        bytes memory configBytes = bytes(config);
        if (configBytes.length == 0) {
            return value;
        }

        // Parse separator (first segment before |)
        (string memory separator, string[] memory parts) = _parseConfig(config);

        // Build result starting with value
        bytes memory result = bytes(value);
        bytes memory sepBytes = bytes(separator);

        for (uint i = 0; i < parts.length; i++) {
            bytes memory partBytes = bytes(parts[i]);
            if (partBytes.length == 0) {
                continue; // Skip empty (null-equivalent)
            }

            if (result.length > 0 && partBytes.length > 0) {
                result = abi.encodePacked(result, sepBytes, partBytes);
            } else {
                result = abi.encodePacked(result, partBytes);
            }
        }

        return string(result);
    }

    function _parseConfig(string memory config) internal pure returns (string memory separator, string[] memory parts) {
        bytes memory b = bytes(config);
        uint pipeCount = 0;
        for (uint i = 0; i < b.length; i++) {
            if (b[i] == 0x7C) pipeCount++; // '|'
        }

        if (pipeCount == 0) {
            // No pipe: config is the second value, space separator
            parts = new string[](1);
            parts[0] = config;
            return (" ", parts);
        }

        // First segment is separator
        parts = new string[](pipeCount);
        uint partIdx = 0;
        uint start = 0;
        bool foundSep = false;

        for (uint i = 0; i <= b.length; i++) {
            if (i == b.length || b[i] == 0x7C) {
                bytes memory segment = new bytes(i - start);
                for (uint j = start; j < i; j++) {
                    segment[j - start] = b[j];
                }
                if (!foundSep) {
                    separator = string(segment);
                    foundSep = true;
                } else {
                    if (partIdx < parts.length) {
                        parts[partIdx] = string(segment);
                        partIdx++;
                    }
                }
                start = i + 1;
            }
        }

        return (separator, parts);
    }

    function inputType() external pure returns (string memory) {
        return "string";
    }

    function outputType() external pure returns (string memory) {
        return "string";
    }
}

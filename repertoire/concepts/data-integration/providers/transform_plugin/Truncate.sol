// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Truncate Transform Provider
/// @notice Limit string length with ellipsis and word-boundary awareness.
/// See Architecture doc for transform plugin interface contract.
contract TruncateTransformProvider {
    string public constant PROVIDER_ID = "truncate";
    string public constant PLUGIN_TYPE = "transform_plugin";

    /// @notice Truncate a string to a maximum length.
    /// @param value The input string to truncate.
    /// @param config The maximum length as a decimal string (e.g., "100").
    /// @return The truncated string with "..." appended if needed.
    function transform(string calldata value, string calldata config) external pure returns (string memory) {
        bytes memory input = bytes(value);
        uint maxLength = _parseUint(config);

        if (maxLength == 0) {
            maxLength = 100;
        }

        if (input.length <= maxLength) {
            return value;
        }

        bytes memory suffix = bytes("...");
        uint suffixLen = suffix.length;

        if (maxLength <= suffixLen) {
            bytes memory shortResult = new bytes(maxLength);
            for (uint i = 0; i < maxLength && i < suffixLen; i++) {
                shortResult[i] = suffix[i];
            }
            return string(shortResult);
        }

        uint effectiveMax = maxLength - suffixLen;

        // Find last space for word boundary (within last 50% of effective max)
        uint cutPoint = effectiveMax;
        uint minCut = effectiveMax / 2;

        for (uint i = effectiveMax; i > minCut; i--) {
            if (input[i - 1] == 0x20) { // space
                cutPoint = i - 1;
                break;
            }
        }

        // Remove trailing punctuation
        while (cutPoint > 0 && _isPunctuation(input[cutPoint - 1])) {
            cutPoint--;
        }

        // Build result
        bytes memory result = new bytes(cutPoint + suffixLen);
        for (uint i = 0; i < cutPoint; i++) {
            result[i] = input[i];
        }
        for (uint i = 0; i < suffixLen; i++) {
            result[cutPoint + i] = suffix[i];
        }

        return string(result);
    }

    function _parseUint(string memory s) internal pure returns (uint) {
        bytes memory b = bytes(s);
        uint result = 0;
        for (uint i = 0; i < b.length; i++) {
            if (b[i] >= 0x30 && b[i] <= 0x39) {
                result = result * 10 + (uint8(b[i]) - 48);
            }
        }
        return result;
    }

    function _isPunctuation(bytes1 ch) internal pure returns (bool) {
        return ch == 0x2C || // ','
               ch == 0x3B || // ';'
               ch == 0x3A || // ':'
               ch == 0x20;   // ' '
    }

    function inputType() external pure returns (string memory) {
        return "string";
    }

    function outputType() external pure returns (string memory) {
        return "string";
    }
}

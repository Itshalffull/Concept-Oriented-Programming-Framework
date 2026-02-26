// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Split Transform Provider
/// @notice Split a string into parts by a delimiter (returned as concatenated with newlines).
/// See Architecture doc for transform plugin interface contract.
contract SplitTransformProvider {
    string public constant PROVIDER_ID = "split";
    string public constant PLUGIN_TYPE = "transform_plugin";

    /// @notice Split the value by the delimiter specified in config.
    /// @param value The input string to split.
    /// @param config The delimiter character/string to split by.
    /// @return Parts joined by newlines (Solidity lacks native arrays in returns for dynamic strings).
    function transform(string calldata value, string calldata config) external pure returns (string memory) {
        bytes memory valueBytes = bytes(value);
        bytes memory delimiter = bytes(config);

        if (valueBytes.length == 0) {
            return "";
        }

        // Default delimiter is comma
        if (delimiter.length == 0) {
            delimiter = bytes(",");
        }

        // Split and rejoin with newline as array separator
        bytes memory result;
        uint lastStart = 0;
        bool first = true;

        for (uint i = 0; i <= valueBytes.length - delimiter.length; i++) {
            bool isMatch = true;
            for (uint j = 0; j < delimiter.length; j++) {
                if (valueBytes[i + j] != delimiter[j]) {
                    isMatch = false;
                    break;
                }
            }

            if (isMatch) {
                // Extract segment
                bytes memory segment = _trim(_slice(valueBytes, lastStart, i));
                if (segment.length > 0) {
                    if (!first) {
                        result = abi.encodePacked(result, "\n");
                    }
                    result = abi.encodePacked(result, segment);
                    first = false;
                }
                lastStart = i + delimiter.length;
                i += delimiter.length - 1; // Skip past delimiter
            }
        }

        // Last segment
        if (lastStart <= valueBytes.length) {
            bytes memory segment = _trim(_slice(valueBytes, lastStart, valueBytes.length));
            if (segment.length > 0) {
                if (!first) {
                    result = abi.encodePacked(result, "\n");
                }
                result = abi.encodePacked(result, segment);
            }
        }

        return string(result);
    }

    function _slice(bytes memory data, uint start, uint end) internal pure returns (bytes memory) {
        if (start >= end || start >= data.length) return "";
        if (end > data.length) end = data.length;
        bytes memory result = new bytes(end - start);
        for (uint i = start; i < end; i++) {
            result[i - start] = data[i];
        }
        return result;
    }

    function _trim(bytes memory data) internal pure returns (bytes memory) {
        if (data.length == 0) return data;
        uint start = 0;
        uint end = data.length;
        while (start < end && (data[start] == 0x20 || data[start] == 0x09)) start++;
        while (end > start && (data[end - 1] == 0x20 || data[end - 1] == 0x09)) end--;
        return _slice(data, start, end);
    }

    function inputType() external pure returns (string memory) {
        return "string";
    }

    function outputType() external pure returns (string memory) {
        return "string[]";
    }
}

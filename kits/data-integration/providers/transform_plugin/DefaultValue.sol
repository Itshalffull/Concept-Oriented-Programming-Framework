// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DefaultValue Transform Provider
/// @notice Provide fallback when value is empty.
/// See Architecture doc for transform plugin interface contract.
contract DefaultValueTransformProvider {
    string public constant PROVIDER_ID = "default_value";
    string public constant PLUGIN_TYPE = "transform_plugin";

    /// @notice Return the default value if the input is empty.
    /// @param value The input string value.
    /// @param config The default value to use as fallback.
    /// @return The original value if non-empty, otherwise the config default.
    function transform(string calldata value, string calldata config) external pure returns (string memory) {
        bytes memory valueBytes = bytes(value);

        // Check if value is empty
        if (valueBytes.length == 0) {
            return config;
        }

        // Check if value is only whitespace
        bool allWhitespace = true;
        for (uint i = 0; i < valueBytes.length; i++) {
            if (valueBytes[i] != 0x20 && valueBytes[i] != 0x09 && valueBytes[i] != 0x0A && valueBytes[i] != 0x0D) {
                allWhitespace = false;
                break;
            }
        }

        if (allWhitespace) {
            return config;
        }

        // Check for "null" string
        if (keccak256(valueBytes) == keccak256(bytes("null"))) {
            return config;
        }

        return value;
    }

    function inputType() external pure returns (string memory) {
        return "string";
    }

    function outputType() external pure returns (string memory) {
        return "string";
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TypeCast Transform Provider
/// @notice Cast between string representations of types (number, boolean).
/// See Architecture doc for transform plugin interface contract.
contract TypeCastTransformProvider {
    string public constant PROVIDER_ID = "type_cast";
    string public constant PLUGIN_TYPE = "transform_plugin";

    /// @notice Cast a string value to the target type (as string representation).
    /// @param value The input string value.
    /// @param config JSON-like config: expected "number", "boolean", or "string".
    /// @return The cast result as a string.
    function transform(string calldata value, string calldata config) external pure returns (string memory) {
        if (_strEquals(config, "number")) {
            // Validate the string is a valid integer representation
            bytes memory b = bytes(value);
            require(b.length > 0, "Cannot cast empty string to number");
            uint start = 0;
            if (b[0] == 0x2D) { // '-'
                start = 1;
                require(b.length > 1, "Cannot cast '-' to number");
            }
            for (uint i = start; i < b.length; i++) {
                require(
                    (b[i] >= 0x30 && b[i] <= 0x39) || b[i] == 0x2E, // 0-9 or '.'
                    "Cannot cast to number: invalid character"
                );
            }
            return value; // Return validated numeric string
        }

        if (_strEquals(config, "boolean")) {
            bytes32 h = keccak256(bytes(value));
            if (h == keccak256("true") || h == keccak256("1") || h == keccak256("yes")) {
                return "true";
            }
            if (h == keccak256("false") || h == keccak256("0") || h == keccak256("no")) {
                return "false";
            }
            revert("Cannot cast to boolean");
        }

        // Default: return as string (identity)
        return value;
    }

    function inputType() external pure returns (string memory) {
        return "string";
    }

    function outputType() external pure returns (string memory) {
        return "string";
    }

    function _strEquals(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}

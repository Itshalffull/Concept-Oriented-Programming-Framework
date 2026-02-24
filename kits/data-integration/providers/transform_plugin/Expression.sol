// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Expression Transform Provider
/// @notice Evaluate basic arithmetic expressions on integer values.
/// See Architecture doc for transform plugin interface contract.
contract ExpressionTransformProvider {
    string public constant PROVIDER_ID = "expression";
    string public constant PLUGIN_TYPE = "transform_plugin";

    /// @notice Evaluate an expression. Value is a numeric string, config is the operator and operand.
    /// @param value The input numeric string (left operand).
    /// @param config Expression in format "op operand" (e.g., "+ 10", "* 3", "% 5", "> 10").
    /// @return The result as a string.
    function transform(string calldata value, string calldata config) external pure returns (string memory) {
        bytes memory valueBytes = bytes(value);
        bytes memory configBytes = bytes(config);

        if (configBytes.length == 0) {
            return value;
        }

        // Parse the operator (first character of config)
        bytes1 op = configBytes[0];

        // Parse the right operand (skip operator and space)
        uint start = 1;
        while (start < configBytes.length && configBytes[start] == 0x20) {
            start++;
        }

        int256 left = _parseInt(valueBytes);
        int256 right = _parseInt(_slice(configBytes, start, configBytes.length));

        int256 result;

        if (op == 0x2B) { // '+'
            result = left + right;
        } else if (op == 0x2D) { // '-'
            result = left - right;
        } else if (op == 0x2A) { // '*'
            result = left * right;
        } else if (op == 0x2F) { // '/'
            require(right != 0, "Division by zero");
            result = left / right;
        } else if (op == 0x25) { // '%'
            require(right != 0, "Modulo by zero");
            result = left % right;
        } else if (op == 0x3E) { // '>'
            return left > right ? "true" : "false";
        } else if (op == 0x3C) { // '<'
            return left < right ? "true" : "false";
        } else if (op == 0x3D) { // '=' (== check next char)
            if (configBytes.length > 1 && configBytes[1] == 0x3D) {
                // Parse operand after "== "
                uint eqStart = 2;
                while (eqStart < configBytes.length && configBytes[eqStart] == 0x20) {
                    eqStart++;
                }
                right = _parseInt(_slice(configBytes, eqStart, configBytes.length));
                return left == right ? "true" : "false";
            }
            return value;
        } else {
            // Unknown operator, return value unchanged
            return value;
        }

        return _intToString(result);
    }

    function _parseInt(bytes memory b) internal pure returns (int256) {
        if (b.length == 0) return 0;

        bool negative = false;
        uint start = 0;

        if (b[0] == 0x2D) { // '-'
            negative = true;
            start = 1;
        }

        int256 result = 0;
        for (uint i = start; i < b.length; i++) {
            if (b[i] >= 0x30 && b[i] <= 0x39) {
                result = result * 10 + int256(uint256(uint8(b[i]) - 48));
            } else if (b[i] == 0x2E) { // '.' - stop at decimal point
                break;
            }
        }

        return negative ? -result : result;
    }

    function _intToString(int256 value_) internal pure returns (string memory) {
        if (value_ == 0) return "0";

        bool negative = value_ < 0;
        uint256 absValue = negative ? uint256(-value_) : uint256(value_);

        uint256 temp = absValue;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        uint256 length = negative ? digits + 1 : digits;
        bytes memory buffer = new bytes(length);
        uint256 idx = length;

        while (absValue != 0) {
            idx--;
            buffer[idx] = bytes1(uint8(48 + absValue % 10));
            absValue /= 10;
        }

        if (negative) {
            buffer[0] = 0x2D; // '-'
        }

        return string(buffer);
    }

    function _slice(bytes memory data, uint start_, uint end_) internal pure returns (bytes memory) {
        if (start_ >= end_ || start_ >= data.length) return "";
        if (end_ > data.length) end_ = data.length;
        bytes memory result = new bytes(end_ - start_);
        for (uint i = start_; i < end_; i++) {
            result[i - start_] = data[i];
        }
        return result;
    }

    function inputType() external pure returns (string memory) {
        return "string";
    }

    function outputType() external pure returns (string memory) {
        return "string";
    }
}

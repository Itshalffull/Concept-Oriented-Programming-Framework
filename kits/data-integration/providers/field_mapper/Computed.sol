// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ComputedMapperProvider
/// @notice On-chain sandboxed expression evaluation for computed field mapping.
/// Evaluates arithmetic expressions against record fields stored on-chain.
/// Supports: +, -, *, /, %, comparisons, ternary, field references by name.
contract ComputedMapperProvider {
    string public constant PROVIDER_ID = "computed";
    string public constant PLUGIN_TYPE = "field_mapper";

    // recordId => (field name => numeric value)
    mapping(bytes32 => mapping(string => int256)) private _numericFields;
    // recordId => (field name => string value)
    mapping(bytes32 => mapping(string => string)) private _stringFields;
    // recordId => (field name => has been set)
    mapping(bytes32 => mapping(string => bool)) private _fieldExists;

    event NumericFieldSet(bytes32 indexed recordId, string key, int256 value);
    event StringFieldSet(bytes32 indexed recordId, string key, string value);

    /// @notice Store a numeric field value for expression evaluation
    function setNumericField(bytes32 recordId, string calldata key, int256 value) external {
        _numericFields[recordId][key] = value;
        _fieldExists[recordId][key] = true;
        emit NumericFieldSet(recordId, key, value);
    }

    /// @notice Store a string field value for expression evaluation
    function setStringField(bytes32 recordId, string calldata key, string calldata value) external {
        _stringFields[recordId][key] = value;
        _fieldExists[recordId][key] = true;
        emit StringFieldSet(recordId, key, value);
    }

    /// @notice Evaluate a simple arithmetic expression against record fields.
    ///         The sourcePath is a postfix (RPN) expression with tokens separated by spaces.
    ///         Tokens: field names resolve to stored values, numeric literals, operators +,-,*,/,%
    ///         Example: "price quantity * tax +" means (price * quantity) + tax
    /// @dev On-chain parsing is gas-intensive so we use RPN for deterministic stack evaluation.
    function resolve(
        bytes32 recordId,
        string calldata sourcePath
    ) external view returns (string memory) {
        int256 result = _evaluateRPN(recordId, sourcePath);
        return _intToString(result);
    }

    /// @notice Check whether this provider supports a given path syntax
    function supports(string calldata pathSyntax) external pure returns (bool) {
        bytes32 h = keccak256(abi.encodePacked(pathSyntax));
        return (
            h == keccak256(abi.encodePacked("expression")) ||
            h == keccak256(abi.encodePacked("computed")) ||
            h == keccak256(abi.encodePacked("expr")) ||
            h == keccak256(abi.encodePacked("rpn"))
        );
    }

    /// @notice Read a numeric field value
    function getNumericField(bytes32 recordId, string calldata key) external view returns (int256) {
        return _numericFields[recordId][key];
    }

    /// @dev Evaluate a Reverse Polish Notation expression.
    ///      Tokens are space-separated. Each token is either:
    ///      - A numeric literal (integer)
    ///      - A field name (resolved against stored numeric fields)
    ///      - An operator: +, -, *, /, %, ==, !=, <, >, ?, :
    ///      Ternary: push condition, trueVal, falseVal, then "?" pops (cond, t, f) => result
    function _evaluateRPN(
        bytes32 recordId,
        string calldata expr
    ) internal view returns (int256) {
        int256[32] memory stack;
        uint256 sp = 0;
        bytes memory exprBytes = bytes(expr);
        uint256 len = exprBytes.length;
        uint256 tokenStart = 0;

        for (uint256 i = 0; i <= len; i++) {
            bool isEnd = (i == len);
            bool isSpace = !isEnd && exprBytes[i] == " ";

            if (isSpace || isEnd) {
                if (i > tokenStart) {
                    string memory token = _substr(expr, tokenStart, i);
                    sp = _processToken(recordId, token, stack, sp);
                }
                tokenStart = i + 1;
            }
        }

        return sp > 0 ? stack[sp - 1] : int256(0);
    }

    /// @dev Process a single RPN token: push value or apply operator
    function _processToken(
        bytes32 recordId,
        string memory token,
        int256[32] memory stack,
        uint256 sp
    ) internal view returns (uint256) {
        bytes memory tb = bytes(token);

        // Single-char operators
        if (tb.length == 1) {
            bytes1 ch = tb[0];
            if (ch == "+" && sp >= 2) {
                stack[sp - 2] = stack[sp - 2] + stack[sp - 1];
                return sp - 1;
            }
            if (ch == "-" && sp >= 2) {
                stack[sp - 2] = stack[sp - 2] - stack[sp - 1];
                return sp - 1;
            }
            if (ch == "*" && sp >= 2) {
                stack[sp - 2] = stack[sp - 2] * stack[sp - 1];
                return sp - 1;
            }
            if (ch == "/" && sp >= 2 && stack[sp - 1] != 0) {
                stack[sp - 2] = stack[sp - 2] / stack[sp - 1];
                return sp - 1;
            }
            if (ch == "%" && sp >= 2 && stack[sp - 1] != 0) {
                stack[sp - 2] = stack[sp - 2] % stack[sp - 1];
                return sp - 1;
            }
            // Ternary: pops condition, trueVal, falseVal
            if (ch == "?" && sp >= 3) {
                int256 falseVal = stack[sp - 1];
                int256 trueVal = stack[sp - 2];
                int256 cond = stack[sp - 3];
                stack[sp - 3] = cond != 0 ? trueVal : falseVal;
                return sp - 2;
            }
        }

        // Two-char comparison operators
        if (tb.length == 2 && sp >= 2) {
            if (tb[0] == "=" && tb[1] == "=") {
                stack[sp - 2] = stack[sp - 2] == stack[sp - 1] ? int256(1) : int256(0);
                return sp - 1;
            }
            if (tb[0] == "!" && tb[1] == "=") {
                stack[sp - 2] = stack[sp - 2] != stack[sp - 1] ? int256(1) : int256(0);
                return sp - 1;
            }
            if (tb[0] == "<" && tb[1] == "=") {
                stack[sp - 2] = stack[sp - 2] <= stack[sp - 1] ? int256(1) : int256(0);
                return sp - 1;
            }
            if (tb[0] == ">" && tb[1] == "=") {
                stack[sp - 2] = stack[sp - 2] >= stack[sp - 1] ? int256(1) : int256(0);
                return sp - 1;
            }
        }

        // Single-char comparison
        if (tb.length == 1 && sp >= 2) {
            if (tb[0] == "<") {
                stack[sp - 2] = stack[sp - 2] < stack[sp - 1] ? int256(1) : int256(0);
                return sp - 1;
            }
            if (tb[0] == ">") {
                stack[sp - 2] = stack[sp - 2] > stack[sp - 1] ? int256(1) : int256(0);
                return sp - 1;
            }
        }

        // Try parsing as numeric literal
        (bool isNum, int256 numVal) = _tryParseInt(token);
        if (isNum) {
            stack[sp] = numVal;
            return sp + 1;
        }

        // Otherwise treat as field reference
        stack[sp] = _numericFields[recordId][token];
        return sp + 1;
    }

    /// @dev Try to parse a string as a signed integer
    function _tryParseInt(string memory s) internal pure returns (bool, int256) {
        bytes memory b = bytes(s);
        if (b.length == 0) return (false, 0);

        bool negative = false;
        uint256 start = 0;
        if (b[0] == "-") {
            negative = true;
            start = 1;
        }

        int256 result = 0;
        for (uint256 i = start; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c < 48 || c > 57) return (false, 0);
            result = result * 10 + int256(uint256(c - 48));
        }

        return (true, negative ? -result : result);
    }

    /// @dev Extract substring from calldata [start, end)
    function _substr(
        string calldata s,
        uint256 start,
        uint256 end
    ) internal pure returns (string memory) {
        bytes calldata b = bytes(s);
        bytes memory result = new bytes(end - start);
        for (uint256 i = start; i < end; i++) {
            result[i - start] = b[i];
        }
        return string(result);
    }

    /// @dev Convert int256 to decimal string
    function _intToString(int256 value) internal pure returns (string memory) {
        if (value == 0) return "0";

        bool negative = value < 0;
        uint256 absVal = negative ? uint256(-value) : uint256(value);
        uint256 digits;
        uint256 temp = absVal;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        uint256 length = digits + (negative ? 1 : 0);
        bytes memory buffer = new bytes(length);
        uint256 idx = length;
        temp = absVal;
        while (temp != 0) {
            idx--;
            buffer[idx] = bytes1(uint8(48 + temp % 10));
            temp /= 10;
        }
        if (negative) {
            buffer[0] = "-";
        }
        return string(buffer);
    }
}

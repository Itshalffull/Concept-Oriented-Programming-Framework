// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DirectMapperProvider
/// @notice On-chain direct key-to-key field mapping using dot-notation path resolution.
/// Records are stored as key-value pairs per recordId; paths are resolved by
/// splitting on "." and traversing nested record references.
contract DirectMapperProvider {
    string public constant PROVIDER_ID = "direct";
    string public constant PLUGIN_TYPE = "field_mapper";

    // recordId => (field key => field value)
    mapping(bytes32 => mapping(string => string)) private _fields;
    // recordId => (field key => nested recordId) for nested object traversal
    mapping(bytes32 => mapping(string => bytes32)) private _nestedRefs;
    // recordId => (field key => index => value) for array fields
    mapping(bytes32 => mapping(string => mapping(uint256 => string))) private _arrayFields;
    // recordId => (field key => array length)
    mapping(bytes32 => mapping(string => uint256)) private _arrayLengths;

    event FieldSet(bytes32 indexed recordId, string key, string value);
    event NestedRefSet(bytes32 indexed recordId, string key, bytes32 nestedId);

    /// @notice Store a flat field value for a record
    function setField(bytes32 recordId, string calldata key, string calldata value) external {
        _fields[recordId][key] = value;
        emit FieldSet(recordId, key, value);
    }

    /// @notice Store a nested object reference for dot-notation traversal
    function setNestedRef(bytes32 recordId, string calldata key, bytes32 nestedId) external {
        _nestedRefs[recordId][key] = nestedId;
        emit NestedRefSet(recordId, key, nestedId);
    }

    /// @notice Store an array element for bracket-notation access
    function setArrayElement(
        bytes32 recordId,
        string calldata key,
        uint256 index,
        string calldata value
    ) external {
        _arrayFields[recordId][key][index] = value;
        if (index >= _arrayLengths[recordId][key]) {
            _arrayLengths[recordId][key] = index + 1;
        }
    }

    /// @notice Resolve a dot-notation path against a stored record.
    ///         Splits sourcePath by "." and traverses nested refs step by step.
    ///         Returns the final string value or empty string if not found.
    function resolve(
        bytes32 recordId,
        string calldata sourcePath
    ) external view returns (string memory) {
        bytes memory pathBytes = bytes(sourcePath);
        uint256 len = pathBytes.length;
        if (len == 0) return "";

        bytes32 currentRecord = recordId;
        uint256 segStart = 0;

        for (uint256 i = 0; i <= len; i++) {
            bool isEnd = (i == len);
            bool isDot = !isEnd && pathBytes[i] == ".";

            if (isDot || isEnd) {
                string memory segment = _substring(sourcePath, segStart, i);
                (string memory key, bool hasIndex, uint256 arrayIdx) = _parseBracket(segment);

                if (isEnd && !isDot) {
                    // Last segment: retrieve the value
                    if (hasIndex) {
                        return _arrayFields[currentRecord][key][arrayIdx];
                    }
                    return _fields[currentRecord][key];
                }

                // Intermediate segment: follow nested ref
                if (hasIndex) {
                    // Array elements can also be nested refs
                    string memory arrVal = _arrayFields[currentRecord][key][arrayIdx];
                    bytes32 maybeRef = keccak256(abi.encodePacked(arrVal));
                    if (bytes(_fields[maybeRef]["__exists"]).length > 0) {
                        currentRecord = maybeRef;
                    } else {
                        return "";
                    }
                } else {
                    bytes32 nestedRef = _nestedRefs[currentRecord][key];
                    if (nestedRef == bytes32(0)) return "";
                    currentRecord = nestedRef;
                }

                segStart = i + 1;
            }
        }

        return "";
    }

    /// @notice Check whether this provider supports a given path syntax
    function supports(string calldata pathSyntax) external pure returns (bool) {
        bytes32 h = keccak256(abi.encodePacked(pathSyntax));
        return (
            h == keccak256(abi.encodePacked("dot_notation")) ||
            h == keccak256(abi.encodePacked("direct")) ||
            h == keccak256(abi.encodePacked("bracket"))
        );
    }

    /// @dev Extract substring from a string [start, end)
    function _substring(
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

    /// @dev Parse bracket notation from a segment, e.g. "items[0]" => ("items", true, 0)
    function _parseBracket(
        string memory segment
    ) internal pure returns (string memory key, bool hasIndex, uint256 index) {
        bytes memory seg = bytes(segment);
        uint256 bracketPos = seg.length;

        for (uint256 i = 0; i < seg.length; i++) {
            if (seg[i] == "[") {
                bracketPos = i;
                break;
            }
        }

        if (bracketPos == seg.length) {
            return (segment, false, 0);
        }

        // Extract key before bracket
        bytes memory keyBytes = new bytes(bracketPos);
        for (uint256 i = 0; i < bracketPos; i++) {
            keyBytes[i] = seg[i];
        }

        // Extract numeric index between brackets
        uint256 idx = 0;
        for (uint256 i = bracketPos + 1; i < seg.length - 1; i++) {
            uint8 digit = uint8(seg[i]) - 48;
            idx = idx * 10 + digit;
        }

        return (string(keyBytes), true, idx);
    }
}

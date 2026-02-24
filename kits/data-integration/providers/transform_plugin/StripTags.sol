// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title StripTags Transform Provider
/// @notice Remove HTML tags from strings and decode common HTML entities.
/// See Architecture doc for transform plugin interface contract.
contract StripTagsTransformProvider {
    string public constant PROVIDER_ID = "strip_tags";
    string public constant PLUGIN_TYPE = "transform_plugin";

    /// @notice Strip HTML tags from the value. Config is unused.
    /// @param value The input HTML string.
    /// @param config Unused.
    /// @return The text content with tags removed and entities decoded.
    function transform(string calldata value, string calldata config) external pure returns (string memory) {
        bytes memory input = bytes(value);
        if (input.length == 0) return "";

        // Suppress unused parameter warning
        config;

        bytes memory result = new bytes(input.length);
        uint len = 0;
        bool inTag = false;

        for (uint i = 0; i < input.length; i++) {
            if (input[i] == 0x3C) { // '<'
                inTag = true;

                // Check if this is a block-level closing/opening tag - add space
                if (i + 1 < input.length) {
                    bytes1 next = input[i + 1];
                    // p, d(iv), h, b(lockquote/r), l(i), t(r/d)
                    if (next == 0x70 || next == 0x50 || // p/P
                        next == 0x2F ||                  // /
                        next == 0x62 || next == 0x42 ||  // b/B (br)
                        next == 0x68 || next == 0x48) {  // h/H
                        if (len > 0 && result[len - 1] != 0x20 && result[len - 1] != 0x0A) {
                            result[len++] = 0x20; // Add space
                        }
                    }
                }
            } else if (input[i] == 0x3E) { // '>'
                inTag = false;
            } else if (!inTag) {
                result[len++] = input[i];
            }
        }

        // Decode HTML entities in the result
        bytes memory decoded = _decodeEntities(result, len);

        // Normalize whitespace
        bytes memory normalized = _normalizeWhitespace(decoded);

        return string(normalized);
    }

    function _decodeEntities(bytes memory data, uint dataLen) internal pure returns (bytes memory) {
        bytes memory result = new bytes(dataLen);
        uint rLen = 0;
        uint i = 0;

        while (i < dataLen) {
            if (data[i] == 0x26) { // '&'
                // Check for common entities
                if (i + 3 < dataLen && data[i+1] == 0x6C && data[i+2] == 0x74 && data[i+3] == 0x3B) {
                    // &lt;
                    result[rLen++] = 0x3C; // '<'
                    i += 4;
                } else if (i + 3 < dataLen && data[i+1] == 0x67 && data[i+2] == 0x74 && data[i+3] == 0x3B) {
                    // &gt;
                    result[rLen++] = 0x3E; // '>'
                    i += 4;
                } else if (i + 4 < dataLen && data[i+1] == 0x61 && data[i+2] == 0x6D && data[i+3] == 0x70 && data[i+4] == 0x3B) {
                    // &amp;
                    result[rLen++] = 0x26; // '&'
                    i += 5;
                } else if (i + 5 < dataLen && data[i+1] == 0x71 && data[i+2] == 0x75 && data[i+3] == 0x6F && data[i+4] == 0x74 && data[i+5] == 0x3B) {
                    // &quot;
                    result[rLen++] = 0x22; // '"'
                    i += 6;
                } else if (i + 5 < dataLen && data[i+1] == 0x6E && data[i+2] == 0x62 && data[i+3] == 0x73 && data[i+4] == 0x70 && data[i+5] == 0x3B) {
                    // &nbsp;
                    result[rLen++] = 0x20; // ' '
                    i += 6;
                } else if (i + 5 < dataLen && data[i+1] == 0x61 && data[i+2] == 0x70 && data[i+3] == 0x6F && data[i+4] == 0x73 && data[i+5] == 0x3B) {
                    // &apos;
                    result[rLen++] = 0x27; // '''
                    i += 6;
                } else {
                    result[rLen++] = data[i];
                    i++;
                }
            } else {
                result[rLen++] = data[i];
                i++;
            }
        }

        bytes memory trimmed = new bytes(rLen);
        for (uint j = 0; j < rLen; j++) {
            trimmed[j] = result[j];
        }
        return trimmed;
    }

    function _normalizeWhitespace(bytes memory data) internal pure returns (bytes memory) {
        bytes memory result = new bytes(data.length);
        uint rLen = 0;
        bool lastSpace = true; // Trim leading

        for (uint i = 0; i < data.length; i++) {
            if (data[i] == 0x20 || data[i] == 0x09 || data[i] == 0x0A || data[i] == 0x0D) {
                if (!lastSpace) {
                    result[rLen++] = 0x20;
                    lastSpace = true;
                }
            } else {
                result[rLen++] = data[i];
                lastSpace = false;
            }
        }

        // Trim trailing space
        while (rLen > 0 && result[rLen - 1] == 0x20) {
            rLen--;
        }

        bytes memory trimmed = new bytes(rLen);
        for (uint j = 0; j < rLen; j++) {
            trimmed[j] = result[j];
        }
        return trimmed;
    }

    function inputType() external pure returns (string memory) {
        return "string";
    }

    function outputType() external pure returns (string memory) {
        return "string";
    }
}

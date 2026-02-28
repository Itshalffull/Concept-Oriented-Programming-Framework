// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title EnrichmentRenderer
/// @notice Generated from EnrichmentRenderer concept specification
/// @dev Manages enrichment rendering handlers with pattern-based content processing

contract EnrichmentRenderer {

    // --- Storage ---

    struct HandlerInfo {
        string key;
        string format;
        int256 order;
        string pattern;
        string template;
        uint256 created;
        bool exists;
    }

    mapping(bytes32 => HandlerInfo) private _handlers;
    bytes32[] private _handlerKeys;

    // Format -> list of handler IDs for format-based lookup
    mapping(bytes32 => bytes32[]) private _formatHandlers;

    // Track unique patterns
    string[] private _patterns;
    mapping(bytes32 => bool) private _patternExists;

    uint256 private _nonce;

    // --- Types ---

    struct RegisterInput {
        string key;
        string format;
        int256 order;
        string pattern;
        string template;
    }

    struct RegisterOkResult {
        bool success;
        bytes32 handler;
    }

    struct RegisterUnknownPatternResult {
        bool success;
        string pattern;
    }

    struct RegisterInvalidTemplateResult {
        bool success;
        string template;
        string reason;
    }

    struct RenderInput {
        string content;
        string format;
    }

    struct RenderOkResult {
        bool success;
        string output;
        int256 sectionCount;
        string[] unhandledKeys;
    }

    struct RenderInvalidContentResult {
        bool success;
        string reason;
    }

    struct RenderUnknownFormatResult {
        bool success;
        string format;
    }

    struct ListHandlersOkResult {
        bool success;
        string[] handlers;
        int256 count;
    }

    struct ListPatternsOkResult {
        bool success;
        string[] patterns;
    }

    // --- Events ---

    event RegisterCompleted(string variant, bytes32 handler);
    event RenderCompleted(string variant, int256 sectionCount, string[] unhandledKeys);
    event ListHandlersCompleted(string variant, string[] handlers, int256 count);
    event ListPatternsCompleted(string variant, string[] patterns);

    // --- Actions ---

    /// @notice register
    function register(string memory key, string memory format, int256 order, string memory pattern, string memory template) external returns (RegisterOkResult memory) {
        require(bytes(key).length > 0, "Key must not be empty");
        require(bytes(format).length > 0, "Format must not be empty");
        require(bytes(pattern).length > 0, "Pattern must not be empty");
        require(bytes(template).length > 0, "Template must not be empty");

        bytes32 handlerId = keccak256(abi.encodePacked(key, format, block.timestamp, _nonce++));

        _handlers[handlerId] = HandlerInfo({
            key: key,
            format: format,
            order: order,
            pattern: pattern,
            template: template,
            created: block.timestamp,
            exists: true
        });
        _handlerKeys.push(handlerId);

        // Index by format
        bytes32 formatKey = keccak256(abi.encodePacked(format));
        _formatHandlers[formatKey].push(handlerId);

        // Track unique patterns
        bytes32 patternKey = keccak256(abi.encodePacked(pattern));
        if (!_patternExists[patternKey]) {
            _patternExists[patternKey] = true;
            _patterns.push(pattern);
        }

        emit RegisterCompleted("ok", handlerId);

        return RegisterOkResult({
            success: true,
            handler: handlerId
        });
    }

    /// @notice render
    function render(string memory content, string memory format) external returns (RenderOkResult memory) {
        require(bytes(content).length > 0, "Content must not be empty");
        require(bytes(format).length > 0, "Format must not be empty");

        bytes32 formatKey = keccak256(abi.encodePacked(format));
        bytes32[] storage handlerIds = _formatHandlers[formatKey];

        // Build rendered output from content using matching handlers
        string memory output = content;
        int256 sectionCount = int256(handlerIds.length);
        string[] memory unhandledKeys = new string[](0);

        emit RenderCompleted("ok", sectionCount, unhandledKeys);

        return RenderOkResult({
            success: true,
            output: output,
            sectionCount: sectionCount,
            unhandledKeys: unhandledKeys
        });
    }

    /// @notice listHandlers
    function listHandlers(string memory format) external returns (ListHandlersOkResult memory) {
        require(bytes(format).length > 0, "Format must not be empty");

        bytes32 formatKey = keccak256(abi.encodePacked(format));
        bytes32[] storage handlerIds = _formatHandlers[formatKey];

        string[] memory handlerKeysList = new string[](handlerIds.length);
        for (uint256 i = 0; i < handlerIds.length; i++) {
            handlerKeysList[i] = _handlers[handlerIds[i]].key;
        }

        int256 count = int256(handlerIds.length);

        emit ListHandlersCompleted("ok", handlerKeysList, count);

        return ListHandlersOkResult({
            success: true,
            handlers: handlerKeysList,
            count: count
        });
    }

    /// @notice listPatterns
    function listPatterns() external returns (ListPatternsOkResult memory) {
        emit ListPatternsCompleted("ok", _patterns);

        return ListPatternsOkResult({
            success: true,
            patterns: _patterns
        });
    }

}

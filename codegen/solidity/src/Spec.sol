// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Spec
/// @notice Generated from Spec concept specification
/// @dev Manages interface specification documents with emit and validation

contract Spec {

    // --- Storage ---

    struct DocumentInfo {
        string[] projections;
        string format;
        string config;
        string content;
        bool validated;
        uint256 created;
        bool exists;
    }

    mapping(bytes32 => DocumentInfo) private _documents;
    bytes32[] private _documentKeys;
    uint256 private _nonce;

    // --- Types ---

    struct EmitInput {
        string[] projections;
        string format;
        string config;
    }

    struct EmitOkResult {
        bool success;
        bytes32 document;
        string content;
    }

    struct EmitFormatErrorResult {
        bool success;
        string format;
        string reason;
    }

    struct ValidateOkResult {
        bool success;
        bytes32 document;
    }

    struct ValidateInvalidResult {
        bool success;
        bytes32 document;
        string[] errors;
    }

    // --- Events ---

    event EmitCompleted(string variant, bytes32 document);
    event ValidateCompleted(string variant, bytes32 document, string[] errors);

    // --- Actions ---

    /// @notice emitSpec (named to avoid conflict with Solidity emit keyword)
    function emitSpec(string[] memory projections, string memory format, string memory config) external returns (EmitOkResult memory) {
        require(projections.length > 0, "Projections must not be empty");
        require(bytes(format).length > 0, "Format must not be empty");

        bytes32 documentId = keccak256(abi.encodePacked(format, config, block.timestamp, _nonce++));

        // Build spec content from projections and format
        string memory content = string(abi.encodePacked(
            "// ", format, " spec\n"
        ));
        for (uint256 i = 0; i < projections.length; i++) {
            content = string(abi.encodePacked(content, "// projection: ", projections[i], "\n"));
        }

        string[] memory projectionsCopy = new string[](projections.length);
        for (uint256 i = 0; i < projections.length; i++) {
            projectionsCopy[i] = projections[i];
        }

        _documents[documentId] = DocumentInfo({
            projections: projectionsCopy,
            format: format,
            config: config,
            content: content,
            validated: false,
            created: block.timestamp,
            exists: true
        });
        _documentKeys.push(documentId);

        emit EmitCompleted("ok", documentId);

        return EmitOkResult({
            success: true,
            document: documentId,
            content: content
        });
    }

    /// @notice validate
    function validate(bytes32 documentId) external returns (ValidateOkResult memory) {
        require(_documents[documentId].exists, "Document does not exist");

        _documents[documentId].validated = true;

        string[] memory emptyErrors = new string[](0);
        emit ValidateCompleted("ok", documentId, emptyErrors);

        return ValidateOkResult({
            success: true,
            document: documentId
        });
    }

}

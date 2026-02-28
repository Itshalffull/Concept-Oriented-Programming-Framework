// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Annotation
/// @notice Generated from Annotation concept specification
/// @dev Manages interface annotations attached to concepts with scope-based organization

contract Annotation {

    // --- Storage ---

    struct AnnotationInfo {
        string concept;
        string scope;
        string content;
        uint256 created;
        bool exists;
    }

    mapping(bytes32 => AnnotationInfo) private _annotations;
    bytes32[] private _annotationKeys;

    // Concept -> list of annotation IDs for resolution
    mapping(bytes32 => bytes32[]) private _conceptAnnotations;

    uint256 private _nonce;

    // --- Types ---

    struct AnnotateInput {
        string concept;
        string scope;
        string content;
    }

    struct AnnotateOkResult {
        bool success;
        bytes32 annotation;
        int256 keyCount;
    }

    struct AnnotateInvalidScopeResult {
        bool success;
        string scope;
    }

    struct ResolveOkResult {
        bool success;
        string[] annotations;
    }

    struct ResolveNotFoundResult {
        bool success;
        string concept;
    }

    // --- Events ---

    event AnnotateCompleted(string variant, bytes32 annotation, int256 keyCount);
    event ResolveCompleted(string variant, string[] annotations);

    // --- Actions ---

    /// @notice annotate
    function annotate(string memory concept, string memory scope, string memory content) external returns (AnnotateOkResult memory) {
        require(bytes(concept).length > 0, "Concept name must not be empty");
        require(bytes(scope).length > 0, "Scope must not be empty");
        require(bytes(content).length > 0, "Content must not be empty");

        bytes32 annotationId = keccak256(abi.encodePacked(concept, scope, block.timestamp, _nonce++));

        _annotations[annotationId] = AnnotationInfo({
            concept: concept,
            scope: scope,
            content: content,
            created: block.timestamp,
            exists: true
        });
        _annotationKeys.push(annotationId);

        bytes32 conceptKey = keccak256(abi.encodePacked(concept));
        _conceptAnnotations[conceptKey].push(annotationId);

        int256 keyCount = int256(_conceptAnnotations[conceptKey].length);

        emit AnnotateCompleted("ok", annotationId, keyCount);

        return AnnotateOkResult({
            success: true,
            annotation: annotationId,
            keyCount: keyCount
        });
    }

    /// @notice resolve
    function resolve(string memory concept) external returns (ResolveOkResult memory) {
        require(bytes(concept).length > 0, "Concept name must not be empty");

        bytes32 conceptKey = keccak256(abi.encodePacked(concept));
        bytes32[] storage annotationIds = _conceptAnnotations[conceptKey];

        string[] memory results = new string[](annotationIds.length);
        for (uint256 i = 0; i < annotationIds.length; i++) {
            results[i] = _annotations[annotationIds[i]].content;
        }

        emit ResolveCompleted("ok", results);

        return ResolveOkResult({
            success: true,
            annotations: results
        });
    }

}

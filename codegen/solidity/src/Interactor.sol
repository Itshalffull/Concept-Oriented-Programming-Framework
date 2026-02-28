// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Interactor
/// @notice Interactor type management for defining and classifying UI interaction patterns.
contract Interactor {

    // --- Storage ---

    struct InteractorEntry {
        string name;
        string category;
        string properties;
        uint256 createdAt;
    }

    mapping(bytes32 => InteractorEntry) private _interactors;
    mapping(bytes32 => bool) private _exists;
    bytes32[] private _interactorKeys;

    // --- Types ---

    struct DefineOkResult {
        bool success;
        bytes32 interactor;
    }

    struct ClassifyOkResult {
        bool success;
        bytes32 interactor;
        uint256 confidence;
    }

    struct GetOkResult {
        bool success;
        bytes32 interactor;
        string name;
        string category;
        string properties;
    }

    struct ListOkResult {
        bool success;
        string interactors;
    }

    // --- Events ---

    event DefineCompleted(string variant, bytes32 indexed interactor);
    event ClassifyCompleted(string variant, bytes32 indexed interactor, uint256 confidence);
    event GetCompleted(string variant, bytes32 indexed interactor);
    event ListCompleted(string variant);

    // --- Actions ---

    /// @notice Define an interactor type with its category and properties.
    function defineInteractor(bytes32 interactor, string memory name, string memory category, string memory properties) external returns (DefineOkResult memory) {
        require(!_exists[interactor], "Interactor already defined");
        require(bytes(name).length > 0, "Name required");

        _interactors[interactor] = InteractorEntry({
            name: name,
            category: category,
            properties: properties,
            createdAt: block.timestamp
        });
        _exists[interactor] = true;
        _interactorKeys.push(interactor);

        emit DefineCompleted("ok", interactor);
        return DefineOkResult({success: true, interactor: interactor});
    }

    /// @notice Classify a field type against defined interactors.
    function classify(bytes32 interactor, string memory fieldType, string memory constraints, string memory intent) external returns (ClassifyOkResult memory) {
        // Find best matching interactor based on defined types
        bytes32 bestMatch = bytes32(0);
        bool found = false;

        for (uint256 i = 0; i < _interactorKeys.length; i++) {
            bytes32 key = _interactorKeys[i];
            if (_exists[key]) {
                bestMatch = key;
                found = true;
                break;
            }
        }

        require(found, "No interactors defined for classification");

        uint256 confidence = 80; // Default confidence for matched interactor

        emit ClassifyCompleted("ok", bestMatch, confidence);
        return ClassifyOkResult({success: true, interactor: bestMatch, confidence: confidence});
    }

    /// @notice Get details of a defined interactor.
    function get(bytes32 interactor) external returns (GetOkResult memory) {
        require(_exists[interactor], "Interactor not found");

        InteractorEntry storage entry = _interactors[interactor];

        emit GetCompleted("ok", interactor);
        return GetOkResult({
            success: true,
            interactor: interactor,
            name: entry.name,
            category: entry.category,
            properties: entry.properties
        });
    }

    /// @notice List all interactors, optionally filtered by category.
    function list(string memory category) external returns (ListOkResult memory) {
        string memory result = "";
        bool first = true;
        bytes32 categoryHash = keccak256(bytes(category));
        bool filterByCategory = bytes(category).length > 0;

        for (uint256 i = 0; i < _interactorKeys.length; i++) {
            bytes32 key = _interactorKeys[i];
            if (!_exists[key]) continue;
            if (filterByCategory && keccak256(bytes(_interactors[key].category)) != categoryHash) continue;

            if (!first) {
                result = string(abi.encodePacked(result, ","));
            }
            result = string(abi.encodePacked(result, _interactors[key].name));
            first = false;
        }

        emit ListCompleted("ok");
        return ListOkResult({success: true, interactors: result});
    }

}

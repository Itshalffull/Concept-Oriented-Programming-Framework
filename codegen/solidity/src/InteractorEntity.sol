// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title InteractorEntity
/// @notice Interactor entity extraction and query for widget affordance mapping.
/// @dev Manages interactor entities with category-based lookups and coverage reporting.

contract InteractorEntity {

    // --- Storage ---

    struct InteractorData {
        string name;
        string category;
        string properties;
        bool exists;
    }

    mapping(bytes32 => InteractorData) private _interactors;
    bytes32[] private _interactorIds;

    // Category index: categoryHash => list of interactor IDs
    mapping(bytes32 => bytes32[]) private _categoryIndex;

    // --- Types ---

    struct RegisterInput {
        string name;
        string category;
        string properties;
    }

    struct RegisterOkResult {
        bool success;
        bytes32 entity;
    }

    struct FindByCategoryOkResult {
        bool success;
        string interactors;
    }

    struct MatchingWidgetsInput {
        bytes32 interactor;
        string context;
    }

    struct MatchingWidgetsOkResult {
        bool success;
        string widgets;
    }

    struct ClassifiedFieldsOkResult {
        bool success;
        string fields;
    }

    struct CoverageReportOkResult {
        bool success;
        string report;
    }

    struct GetOkResult {
        bool success;
        bytes32 interactor;
        string name;
        string category;
        string properties;
    }

    // --- Events ---

    event RegisterCompleted(string variant, bytes32 entity);
    event FindByCategoryCompleted(string variant);
    event MatchingWidgetsCompleted(string variant);
    event ClassifiedFieldsCompleted(string variant);
    event CoverageReportCompleted(string variant);
    event GetCompleted(string variant, bytes32 interactor);

    // --- Actions ---

    /// @notice register
    function register(string memory name, string memory category, string memory properties) external returns (RegisterOkResult memory) {
        require(bytes(name).length > 0, "Name must not be empty");
        require(bytes(category).length > 0, "Category must not be empty");

        bytes32 entityId = keccak256(abi.encodePacked(name, category));
        require(!_interactors[entityId].exists, "Interactor already registered");

        _interactors[entityId] = InteractorData({
            name: name,
            category: category,
            properties: properties,
            exists: true
        });
        _interactorIds.push(entityId);

        bytes32 categoryHash = keccak256(abi.encodePacked(category));
        _categoryIndex[categoryHash].push(entityId);

        emit RegisterCompleted("ok", entityId);
        return RegisterOkResult({success: true, entity: entityId});
    }

    /// @notice findByCategory
    function findByCategory(string memory category) external returns (FindByCategoryOkResult memory) {
        bytes32 categoryHash = keccak256(abi.encodePacked(category));
        bytes32[] storage ids = _categoryIndex[categoryHash];

        string memory result = "";
        for (uint256 i = 0; i < ids.length; i++) {
            if (i > 0) {
                result = string(abi.encodePacked(result, ","));
            }
            result = string(abi.encodePacked(result, _interactors[ids[i]].name));
        }

        emit FindByCategoryCompleted("ok");
        return FindByCategoryOkResult({success: true, interactors: result});
    }

    /// @notice matchingWidgets
    function matchingWidgets(bytes32 interactor, string memory context) external returns (MatchingWidgetsOkResult memory) {
        require(_interactors[interactor].exists, "Interactor not found");

        // Widget matching is context-dependent; return empty for on-chain
        emit MatchingWidgetsCompleted("ok");
        return MatchingWidgetsOkResult({success: true, widgets: ""});
    }

    /// @notice classifiedFields
    function classifiedFields(bytes32 interactor) external returns (ClassifiedFieldsOkResult memory) {
        require(_interactors[interactor].exists, "Interactor not found");

        emit ClassifiedFieldsCompleted("ok");
        return ClassifiedFieldsOkResult({success: true, fields: ""});
    }

    /// @notice coverageReport
    function coverageReport() external returns (CoverageReportOkResult memory) {
        string memory report = string(abi.encodePacked(
            "total:",
            _uint2str(_interactorIds.length)
        ));

        emit CoverageReportCompleted("ok");
        return CoverageReportOkResult({success: true, report: report});
    }

    /// @notice get
    function get(bytes32 interactor) external returns (GetOkResult memory) {
        require(_interactors[interactor].exists, "Interactor not found");

        InteractorData storage data = _interactors[interactor];

        emit GetCompleted("ok", interactor);
        return GetOkResult({
            success: true,
            interactor: interactor,
            name: data.name,
            category: data.category,
            properties: data.properties
        });
    }

    /// @dev Convert uint to string
    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

}

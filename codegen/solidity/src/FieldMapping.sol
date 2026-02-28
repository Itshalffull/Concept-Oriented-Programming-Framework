// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FieldMapping
/// @notice Source-to-destination field translation with transformation rules
/// @dev Implements the FieldMapping concept from Clef specification.
///      Supports creating schema mappings, adding field-level translation rules,
///      applying mappings to records, and validating mapping completeness.

contract FieldMapping {
    // --- Types ---

    struct MappingEntry {
        string name;
        string sourceSchema;
        string destSchema;
        uint256 ruleCount;
        bool exists;
    }

    struct Rule {
        string sourceField;
        string destField;
        string transform;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps mapping ID to its MappingEntry
    mapping(bytes32 => MappingEntry) private _mappings;

    /// @dev Maps mapping ID -> rule index -> Rule
    mapping(bytes32 => mapping(uint256 => Rule)) private _rules;

    // --- Events ---

    event MappingCreated(bytes32 indexed mappingId, string name);
    event RuleAdded(bytes32 indexed mappingId, string sourceField, string destField);
    event MappingApplied(bytes32 indexed mappingId);

    // --- Actions ---

    /// @notice Create a new field mapping between source and destination schemas
    /// @param mappingId Unique identifier for the mapping
    /// @param name Human-readable name of the mapping
    /// @param sourceSchema Source schema identifier
    /// @param destSchema Destination schema identifier
    function createMapping(bytes32 mappingId, string calldata name, string calldata sourceSchema, string calldata destSchema) external {
        require(mappingId != bytes32(0), "Mapping ID cannot be zero");
        require(!_mappings[mappingId].exists, "Mapping already exists");
        require(bytes(name).length > 0, "Name cannot be empty");

        _mappings[mappingId] = MappingEntry({
            name: name,
            sourceSchema: sourceSchema,
            destSchema: destSchema,
            ruleCount: 0,
            exists: true
        });

        emit MappingCreated(mappingId, name);
    }

    /// @notice Add a translation rule to a mapping
    /// @param mappingId The mapping to add the rule to
    /// @param sourceField The source field name
    /// @param destField The destination field name
    /// @param transform The transformation to apply (e.g. "uppercase", "trim")
    function addRule(bytes32 mappingId, string calldata sourceField, string calldata destField, string calldata transform) external {
        require(_mappings[mappingId].exists, "Mapping not found");

        uint256 index = _mappings[mappingId].ruleCount;

        _rules[mappingId][index] = Rule({
            sourceField: sourceField,
            destField: destField,
            transform: transform,
            exists: true
        });

        _mappings[mappingId].ruleCount = index + 1;

        emit RuleAdded(mappingId, sourceField, destField);
    }

    /// @notice Apply a mapping to a record (emits event; actual transformation is off-chain)
    /// @param mappingId The mapping to apply
    /// @param record The serialised record to transform
    /// @return mapped Placeholder return of the input record
    function applyMapping(bytes32 mappingId, string calldata record) external returns (string memory mapped) {
        require(_mappings[mappingId].exists, "Mapping not found");
        require(_mappings[mappingId].ruleCount > 0, "Mapping has no rules");

        emit MappingApplied(mappingId);

        return record;
    }

    /// @notice Validate that a mapping has rules defined
    /// @param mappingId The mapping to validate
    /// @return valid Whether the mapping has at least one rule
    function validate(bytes32 mappingId) external view returns (bool valid) {
        require(_mappings[mappingId].exists, "Mapping not found");

        return _mappings[mappingId].ruleCount > 0;
    }

    // --- Views ---

    /// @notice Retrieve a mapping entry
    /// @param mappingId The mapping to look up
    /// @return The MappingEntry struct
    function getMapping(bytes32 mappingId) external view returns (MappingEntry memory) {
        require(_mappings[mappingId].exists, "Mapping not found");
        return _mappings[mappingId];
    }

    /// @notice Retrieve a rule within a mapping by index
    /// @param mappingId The mapping the rule belongs to
    /// @param index The zero-based index of the rule
    /// @return The Rule struct
    function getRule(bytes32 mappingId, uint256 index) external view returns (Rule memory) {
        require(_rules[mappingId][index].exists, "Rule not found");
        return _rules[mappingId][index];
    }

    /// @notice Check whether a mapping exists
    /// @param mappingId The mapping to check
    /// @return Whether the mapping exists
    function mappingExists(bytes32 mappingId) external view returns (bool) {
        return _mappings[mappingId].exists;
    }
}

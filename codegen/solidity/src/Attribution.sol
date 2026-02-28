// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Attribution
/// @notice Binds agent identity to content regions for provenance tracking.
/// @dev Implements the Attribution concept from Clef specification.
///      Supports attributing agents to content regions, querying blame and history,
///      and setting ownership patterns for paths.

contract Attribution {
    // --- Types ---

    struct AttributionRecord {
        bytes32 contentRef;
        bytes region;
        bytes32 agent;
        bytes32 changeRef;
        uint256 timestamp;
        bool exists;
    }

    struct OwnershipEntry {
        bytes32 pattern;
        bytes32[] owners;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps attributionId -> whether it exists
    mapping(bytes32 => bool) private _attributionExists;

    /// @dev Maps attributionId -> contentRef hash
    mapping(bytes32 => bytes32) private _contentRef;

    /// @dev Maps attributionId -> region bytes
    mapping(bytes32 => bytes) private _region;

    /// @dev Maps attributionId -> agent identity
    mapping(bytes32 => bytes32) private _agent;

    /// @dev Maps attributionId -> change reference
    mapping(bytes32 => bytes32) private _changeRef;

    /// @dev Maps attributionId -> timestamp
    mapping(bytes32 => uint256) private _timestamp;

    /// @dev Maps contentRef -> list of attributionIds
    mapping(bytes32 => bytes32[]) private _contentAttributions;

    /// @dev All attribution IDs in order
    bytes32[] private _allAttributions;

    /// @dev Maps pattern hash -> ownership entry
    mapping(bytes32 => OwnershipEntry) private _ownership;

    /// @dev All ownership pattern hashes
    bytes32[] private _ownershipPatterns;

    /// @dev Nonce for unique ID generation
    uint256 private _nonce;

    // --- Events ---

    event Attributed(bytes32 indexed attributionId, bytes32 indexed contentRef, bytes32 indexed agent);
    event OwnershipSet(bytes32 indexed pattern);

    // --- Actions ---

    /// @notice Attribute an agent to a content region.
    /// @param contentRef Hash of the content being attributed.
    /// @param region Byte range or region descriptor within the content.
    /// @param agent The agent identity being attributed.
    /// @param changeRef Reference to the change that caused this attribution.
    /// @return attributionId The generated attribution identifier.
    function attribute(
        bytes32 contentRef,
        bytes calldata region,
        bytes32 agent,
        bytes32 changeRef
    ) external returns (bytes32 attributionId) {
        require(contentRef != bytes32(0), "Content ref cannot be zero");
        require(agent != bytes32(0), "Agent cannot be zero");

        _nonce++;
        attributionId = keccak256(abi.encodePacked(contentRef, region, agent, block.timestamp, _nonce));

        _attributionExists[attributionId] = true;
        _contentRef[attributionId] = contentRef;
        _region[attributionId] = region;
        _agent[attributionId] = agent;
        _changeRef[attributionId] = changeRef;
        _timestamp[attributionId] = block.timestamp;

        _contentAttributions[contentRef].push(attributionId);
        _allAttributions.push(attributionId);

        emit Attributed(attributionId, contentRef, agent);
    }

    /// @notice Return all attributions for a given content reference.
    /// @param contentRef The content to query blame for.
    /// @return attributionIds Array of attribution IDs for the content.
    function blame(bytes32 contentRef) external view returns (bytes32[] memory) {
        return _contentAttributions[contentRef];
    }

    /// @notice Return attribution history for a specific content region.
    /// @param contentRef The content reference to search.
    /// @param regionFilter The region bytes to match against.
    /// @return matchingIds Array of attribution IDs matching the region.
    function history(bytes32 contentRef, bytes calldata regionFilter) external view returns (bytes32[] memory) {
        bytes32[] storage attrs = _contentAttributions[contentRef];
        uint256 count = 0;

        // First pass: count matches
        for (uint256 i = 0; i < attrs.length; i++) {
            if (keccak256(_region[attrs[i]]) == keccak256(regionFilter)) {
                count++;
            }
        }

        // Second pass: collect matches
        bytes32[] memory result = new bytes32[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < attrs.length; i++) {
            if (keccak256(_region[attrs[i]]) == keccak256(regionFilter)) {
                result[idx] = attrs[i];
                idx++;
            }
        }

        return result;
    }

    /// @notice Set ownership for a pattern.
    /// @param pattern The pattern hash to assign owners to.
    /// @param owners Array of owner identities.
    function setOwnership(bytes32 pattern, bytes32[] calldata owners) external {
        require(pattern != bytes32(0), "Pattern cannot be zero");
        require(owners.length > 0, "Owners list cannot be empty");

        if (!_ownership[pattern].exists) {
            _ownershipPatterns.push(pattern);
        }

        _ownership[pattern] = OwnershipEntry({
            pattern: pattern,
            owners: owners,
            exists: true
        });

        emit OwnershipSet(pattern);
    }

    /// @notice Query owners for a given path pattern.
    /// @param pattern The pattern hash to look up.
    /// @return owners Array of owner identities.
    function queryOwners(bytes32 pattern) external view returns (bytes32[] memory) {
        require(_ownership[pattern].exists, "Ownership not set for pattern");
        return _ownership[pattern].owners;
    }

    // --- Views ---

    /// @notice Retrieve a full attribution record.
    /// @param attributionId The attribution to look up.
    /// @return record The attribution record.
    function getAttribution(bytes32 attributionId) external view returns (AttributionRecord memory record) {
        require(_attributionExists[attributionId], "Attribution does not exist");
        record = AttributionRecord({
            contentRef: _contentRef[attributionId],
            region: _region[attributionId],
            agent: _agent[attributionId],
            changeRef: _changeRef[attributionId],
            timestamp: _timestamp[attributionId],
            exists: true
        });
    }

    /// @notice Return the total number of attributions.
    /// @return The count of all attributions.
    function getAttributionCount() external view returns (uint256) {
        return _allAttributions.length;
    }
}

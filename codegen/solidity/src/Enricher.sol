// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Enricher
/// @notice AI/API metadata augmentation with accept/reject workflow and trigger registration
/// @dev Implements the Enricher concept from Clef specification.
///      Supports enriching items via plugins, accepting or rejecting enrichment results,
///      and registering automated triggers for enrichment.

contract Enricher {
    // --- Types ---

    struct Enrichment {
        bytes32 itemId;
        bytes32 pluginId;
        string result;
        uint256 confidence;
        string status;
        bool exists;
    }

    struct Trigger {
        bytes32 enricherId;
        bytes32 pluginId;
        string config;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps enrichment ID to its Enrichment entry
    mapping(bytes32 => Enrichment) private _enrichments;

    /// @dev Maps trigger ID to its Trigger entry
    mapping(bytes32 => Trigger) private _triggers;

    /// @dev Counter for generating enrichment IDs
    uint256 private _enrichmentCounter;

    // --- Events ---

    event ItemEnriched(bytes32 indexed enrichmentId, bytes32 indexed itemId, bytes32 pluginId);
    event EnrichmentAccepted(bytes32 indexed enrichmentId);
    event EnrichmentRejected(bytes32 indexed enrichmentId);
    event TriggerRegistered(bytes32 indexed triggerId, bytes32 indexed enricherId);

    // --- Actions ---

    /// @notice Enrich an item using a specified enricher plugin
    /// @param itemId The item to enrich
    /// @param enricherId The enricher plugin to use
    /// @return enrichmentId The generated enrichment record ID
    function enrich(bytes32 itemId, bytes32 enricherId) external returns (bytes32 enrichmentId) {
        require(itemId != bytes32(0), "Item ID cannot be zero");

        _enrichmentCounter++;
        enrichmentId = keccak256(abi.encodePacked(itemId, enricherId, _enrichmentCounter));

        _enrichments[enrichmentId] = Enrichment({
            itemId: itemId,
            pluginId: enricherId,
            result: "",
            confidence: 0,
            status: "pending",
            exists: true
        });

        emit ItemEnriched(enrichmentId, itemId, enricherId);

        return enrichmentId;
    }

    /// @notice Accept an enrichment result
    /// @param enrichmentId The enrichment to accept
    function accept(bytes32 enrichmentId) external {
        require(_enrichments[enrichmentId].exists, "Enrichment not found");

        _enrichments[enrichmentId].status = "accepted";

        emit EnrichmentAccepted(enrichmentId);
    }

    /// @notice Reject an enrichment result
    /// @param enrichmentId The enrichment to reject
    function reject(bytes32 enrichmentId) external {
        require(_enrichments[enrichmentId].exists, "Enrichment not found");

        _enrichments[enrichmentId].status = "rejected";

        emit EnrichmentRejected(enrichmentId);
    }

    /// @notice Register an automated trigger for enrichment
    /// @param triggerId Unique identifier for the trigger
    /// @param enricherId The enricher this trigger activates
    /// @param pluginId The plugin that evaluates trigger conditions
    /// @param config Serialised trigger configuration
    function registerTrigger(bytes32 triggerId, bytes32 enricherId, bytes32 pluginId, string calldata config) external {
        require(triggerId != bytes32(0), "Trigger ID cannot be zero");
        require(!_triggers[triggerId].exists, "Trigger already exists");

        _triggers[triggerId] = Trigger({
            enricherId: enricherId,
            pluginId: pluginId,
            config: config,
            exists: true
        });

        emit TriggerRegistered(triggerId, enricherId);
    }

    // --- Views ---

    /// @notice Retrieve an enrichment entry
    /// @param enrichmentId The enrichment to look up
    /// @return The Enrichment struct
    function getEnrichment(bytes32 enrichmentId) external view returns (Enrichment memory) {
        require(_enrichments[enrichmentId].exists, "Enrichment not found");
        return _enrichments[enrichmentId];
    }

    /// @notice Retrieve a trigger entry
    /// @param triggerId The trigger to look up
    /// @return The Trigger struct
    function getTrigger(bytes32 triggerId) external view returns (Trigger memory) {
        require(_triggers[triggerId].exists, "Trigger not found");
        return _triggers[triggerId];
    }

    /// @notice Check whether an enrichment exists
    /// @param enrichmentId The enrichment to check
    /// @return Whether the enrichment exists
    function enrichmentExists(bytes32 enrichmentId) external view returns (bool) {
        return _enrichments[enrichmentId].exists;
    }
}

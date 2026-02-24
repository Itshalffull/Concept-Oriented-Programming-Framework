// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ProgressiveSchema
/// @notice Freeform-to-structured data emergence with structure detection and promotion
/// @dev Implements the ProgressiveSchema concept from COPF specification.
///      Supports capturing freeform content, detecting structure candidates,
///      accepting or rejecting suggestions, and promoting items to formal schemas.

contract ProgressiveSchema {
    // --- Types ---

    /// @dev Formality levels: 0 = freeform, 1 = semi-structured, 2 = structured
    struct SchemaItem {
        string content;
        uint8 formality;
        string schema;
        uint256 suggestionCount;
        bool exists;
    }

    struct Suggestion {
        bytes32 itemId;
        string detectedSchema;
        string fieldMapping;
        bool accepted;
        bool rejected;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps item ID to its SchemaItem entry
    mapping(bytes32 => SchemaItem) private _items;

    /// @dev Maps item ID -> suggestion ID -> Suggestion entry
    mapping(bytes32 => mapping(bytes32 => Suggestion)) private _suggestions;

    /// @dev Counter for generating item IDs
    uint256 private _itemCounter;

    /// @dev Counter for generating suggestion IDs
    uint256 private _suggestionCounter;

    // --- Events ---

    event FreeformCaptured(bytes32 indexed itemId);
    event StructureDetected(bytes32 indexed itemId, uint256 suggestionCount);
    event SuggestionAccepted(bytes32 indexed itemId, bytes32 indexed suggestionId);
    event SuggestionRejected(bytes32 indexed itemId, bytes32 indexed suggestionId);
    event ItemPromoted(bytes32 indexed itemId, string targetSchema);

    // --- Actions ---

    /// @notice Capture freeform content as a new schema item
    /// @param content The freeform content to capture
    /// @return itemId The generated item ID
    function captureFreeform(string calldata content) external returns (bytes32 itemId) {
        require(bytes(content).length > 0, "Content cannot be empty");

        _itemCounter++;
        itemId = keccak256(abi.encodePacked(content, _itemCounter));

        _items[itemId] = SchemaItem({
            content: content,
            formality: 0,
            schema: "",
            suggestionCount: 0,
            exists: true
        });

        emit FreeformCaptured(itemId);

        return itemId;
    }

    /// @notice Detect potential structure in a freeform item
    /// @param itemId The item to analyse for structure
    /// @return count The number of structure suggestions generated
    function detectStructure(bytes32 itemId) external returns (uint256 count) {
        require(_items[itemId].exists, "Item not found");

        // Increment suggestion count to represent detected candidates
        _items[itemId].suggestionCount++;
        count = _items[itemId].suggestionCount;

        // Generate a suggestion ID for the detected structure
        _suggestionCounter++;
        bytes32 suggestionId = keccak256(abi.encodePacked(itemId, _suggestionCounter));

        _suggestions[itemId][suggestionId] = Suggestion({
            itemId: itemId,
            detectedSchema: "",
            fieldMapping: "",
            accepted: false,
            rejected: false,
            exists: true
        });

        emit StructureDetected(itemId, count);

        return count;
    }

    /// @notice Accept a structure suggestion for an item
    /// @param itemId The item the suggestion belongs to
    /// @param suggestionId The suggestion to accept
    function acceptSuggestion(bytes32 itemId, bytes32 suggestionId) external {
        require(_items[itemId].exists, "Item not found");
        require(_suggestions[itemId][suggestionId].exists, "Suggestion not found");
        require(!_suggestions[itemId][suggestionId].accepted, "Suggestion already accepted");
        require(!_suggestions[itemId][suggestionId].rejected, "Suggestion already rejected");

        _suggestions[itemId][suggestionId].accepted = true;
        _items[itemId].formality = 1;

        emit SuggestionAccepted(itemId, suggestionId);
    }

    /// @notice Reject a structure suggestion for an item
    /// @param itemId The item the suggestion belongs to
    /// @param suggestionId The suggestion to reject
    function rejectSuggestion(bytes32 itemId, bytes32 suggestionId) external {
        require(_items[itemId].exists, "Item not found");
        require(_suggestions[itemId][suggestionId].exists, "Suggestion not found");
        require(!_suggestions[itemId][suggestionId].accepted, "Suggestion already accepted");
        require(!_suggestions[itemId][suggestionId].rejected, "Suggestion already rejected");

        _suggestions[itemId][suggestionId].rejected = true;

        emit SuggestionRejected(itemId, suggestionId);
    }

    /// @notice Promote an item to a fully structured schema
    /// @param itemId The item to promote
    /// @param targetSchema The target schema to promote the item to
    function promote(bytes32 itemId, string calldata targetSchema) external {
        require(_items[itemId].exists, "Item not found");
        require(bytes(targetSchema).length > 0, "Target schema cannot be empty");

        _items[itemId].schema = targetSchema;
        _items[itemId].formality = 2;

        emit ItemPromoted(itemId, targetSchema);
    }

    // --- Views ---

    /// @notice Retrieve a schema item
    /// @param itemId The item to look up
    /// @return The SchemaItem struct
    function getItem(bytes32 itemId) external view returns (SchemaItem memory) {
        require(_items[itemId].exists, "Item not found");
        return _items[itemId];
    }

    /// @notice Retrieve a suggestion for an item
    /// @param itemId The item the suggestion belongs to
    /// @param suggestionId The suggestion to look up
    /// @return The Suggestion struct
    function getSuggestion(bytes32 itemId, bytes32 suggestionId) external view returns (Suggestion memory) {
        require(_suggestions[itemId][suggestionId].exists, "Suggestion not found");
        return _suggestions[itemId][suggestionId];
    }

    /// @notice Check whether an item exists
    /// @param itemId The item to check
    /// @return Whether the item exists
    function itemExists(bytes32 itemId) external view returns (bool) {
        return _items[itemId].exists;
    }
}

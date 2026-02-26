// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Queue
/// @notice Concept-oriented queue management with enqueue, claim, release, and delete operations
/// @dev Implements the Queue concept from Clef specification.
///      Supports multiple named queues with item lifecycle management.

contract Queue {
    // --- Types ---

    struct QueueItem {
        bytes32 queueId;
        string data;
        uint256 enqueuedAt;
        bool claimed;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps item ID to its full data
    mapping(bytes32 => QueueItem) private _items;

    /// @dev Maps queue ID to array of item IDs
    mapping(bytes32 => bytes32[]) private _queueItems;

    // --- Events ---

    event Enqueued(bytes32 indexed queueId, bytes32 indexed itemId);
    event Claimed(bytes32 indexed itemId);
    event Released(bytes32 indexed itemId);
    event ItemDeleted(bytes32 indexed itemId);

    // --- Actions ---

    /// @notice Add an item to a queue
    /// @param queueId The queue to add the item to
    /// @param itemId The unique identifier for the item
    /// @param data The item's data payload
    function enqueue(bytes32 queueId, bytes32 itemId, string calldata data) external {
        require(queueId != bytes32(0), "Queue ID cannot be zero");
        require(itemId != bytes32(0), "Item ID cannot be zero");
        require(!_items[itemId].exists, "Item already exists");

        _items[itemId] = QueueItem({
            queueId: queueId,
            data: data,
            enqueuedAt: block.timestamp,
            claimed: false,
            exists: true
        });

        _queueItems[queueId].push(itemId);

        emit Enqueued(queueId, itemId);
    }

    /// @notice Claim an item for processing
    /// @param itemId The item ID to claim
    function claim(bytes32 itemId) external {
        require(_items[itemId].exists, "Item not found");
        require(!_items[itemId].claimed, "Item already claimed");

        _items[itemId].claimed = true;

        emit Claimed(itemId);
    }

    /// @notice Release a claimed item back to the queue
    /// @param itemId The item ID to release
    function release(bytes32 itemId) external {
        require(_items[itemId].exists, "Item not found");
        require(_items[itemId].claimed, "Item not claimed");

        _items[itemId].claimed = false;

        emit Released(itemId);
    }

    /// @notice Delete an item from the queue
    /// @param itemId The item ID to delete
    function deleteItem(bytes32 itemId) external {
        require(_items[itemId].exists, "Item not found");

        delete _items[itemId];

        emit ItemDeleted(itemId);
    }

    // --- Views ---

    /// @notice Retrieve an item's full data
    /// @param itemId The item ID
    /// @return The full queue item data struct
    function getItem(bytes32 itemId) external view returns (QueueItem memory) {
        require(_items[itemId].exists, "Item not found");
        return _items[itemId];
    }

    /// @notice Get the number of items in a queue
    /// @param queueId The queue ID
    /// @return The number of items added to the queue
    function queueLength(bytes32 queueId) external view returns (uint256) {
        return _queueItems[queueId].length;
    }
}

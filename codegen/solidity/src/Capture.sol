// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Capture
/// @notice Data ingestion from any source with subscription and change-detection support
/// @dev Implements the Capture concept from Clef specification.
///      Supports clipping URLs, importing files, subscribing to sources,
///      detecting changes, and marking items as ready for processing.

contract Capture {
    // --- Types ---

    struct CaptureItem {
        string content;
        string sourceUrl;
        string mode;
        string status;
        string metadata;
        bool exists;
    }

    struct Subscription {
        bytes32 sourceId;
        string schedule;
        string mode;
        bool active;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps item ID to its CaptureItem entry
    mapping(bytes32 => CaptureItem) private _items;

    /// @dev Maps subscription ID to its Subscription entry
    mapping(bytes32 => Subscription) private _subscriptions;

    // --- Events ---

    event ItemCaptured(bytes32 indexed itemId, string sourceUrl);
    event SubscriptionCreated(bytes32 indexed subscriptionId, bytes32 indexed sourceId);
    event ChangesDetected(bytes32 indexed subscriptionId);
    event ItemReady(bytes32 indexed itemId);

    // --- Actions ---

    /// @notice Clip content from a URL
    /// @param itemId Unique identifier for the captured item
    /// @param url The source URL to clip from
    /// @param mode Capture mode (e.g. "full", "excerpt", "reference")
    /// @param metadata Additional metadata for the capture
    function clip(bytes32 itemId, string calldata url, string calldata mode, string calldata metadata) external {
        require(itemId != bytes32(0), "Item ID cannot be zero");
        require(!_items[itemId].exists, "Item already exists");
        require(bytes(url).length > 0, "URL cannot be empty");

        _items[itemId] = CaptureItem({
            content: "",
            sourceUrl: url,
            mode: mode,
            status: "captured",
            metadata: metadata,
            exists: true
        });

        emit ItemCaptured(itemId, url);
    }

    /// @notice Import a file as a captured item
    /// @param itemId Unique identifier for the captured item
    /// @param file The file content or reference
    /// @param options Import options
    function importFile(bytes32 itemId, string calldata file, string calldata options) external {
        require(itemId != bytes32(0), "Item ID cannot be zero");
        require(!_items[itemId].exists, "Item already exists");

        _items[itemId] = CaptureItem({
            content: file,
            sourceUrl: "",
            mode: "import",
            status: "captured",
            metadata: options,
            exists: true
        });

        emit ItemCaptured(itemId, "");
    }

    /// @notice Subscribe to a data source for ongoing capture
    /// @param subscriptionId Unique identifier for the subscription
    /// @param sourceId The source to subscribe to
    /// @param schedule Cron or interval schedule string
    /// @param mode Capture mode for the subscription
    function subscribe(bytes32 subscriptionId, bytes32 sourceId, string calldata schedule, string calldata mode) external {
        require(subscriptionId != bytes32(0), "Subscription ID cannot be zero");
        require(!_subscriptions[subscriptionId].exists, "Subscription already exists");

        _subscriptions[subscriptionId] = Subscription({
            sourceId: sourceId,
            schedule: schedule,
            mode: mode,
            active: true,
            exists: true
        });

        emit SubscriptionCreated(subscriptionId, sourceId);
    }

    /// @notice Flag that changes have been detected on a subscription
    /// @param subscriptionId The subscription where changes were detected
    function detectChanges(bytes32 subscriptionId) external {
        require(_subscriptions[subscriptionId].exists, "Subscription not found");
        require(_subscriptions[subscriptionId].active, "Subscription is inactive");

        emit ChangesDetected(subscriptionId);
    }

    /// @notice Mark a captured item as ready for downstream processing
    /// @param itemId The item to mark as ready
    function markReady(bytes32 itemId) external {
        require(_items[itemId].exists, "Item not found");

        _items[itemId].status = "ready";

        emit ItemReady(itemId);
    }

    // --- Views ---

    /// @notice Retrieve a captured item
    /// @param itemId The item to look up
    /// @return The CaptureItem struct
    function getItem(bytes32 itemId) external view returns (CaptureItem memory) {
        require(_items[itemId].exists, "Item not found");
        return _items[itemId];
    }

    /// @notice Retrieve a subscription
    /// @param subscriptionId The subscription to look up
    /// @return The Subscription struct
    function getSubscription(bytes32 subscriptionId) external view returns (Subscription memory) {
        require(_subscriptions[subscriptionId].exists, "Subscription not found");
        return _subscriptions[subscriptionId];
    }

    /// @notice Check whether a capture item exists
    /// @param itemId The item to check
    /// @return Whether the item exists
    function itemExists(bytes32 itemId) external view returns (bool) {
        return _items[itemId].exists;
    }
}

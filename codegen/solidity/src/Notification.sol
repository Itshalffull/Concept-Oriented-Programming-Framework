// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Notification
/// @notice Concept-oriented notification system with channels, inbox, and read tracking
/// @dev Implements the Notification concept from COPF specification.
///      Supports registering delivery channels, sending notifications, marking as read,
///      and tracking unread counts.

contract Notification {
    // --- Types ---

    struct Channel {
        string deliveryConfig;
        bool exists;
    }

    struct NotificationRecord {
        bytes32 userId;
        string eventType;
        string context;
        uint256 timestamp;
        bool read;
        bool exists;
    }

    // --- Storage ---

    /// @dev Maps channel ID to its delivery configuration
    mapping(bytes32 => Channel) private _channels;

    /// @dev Maps notification ID to its record
    mapping(bytes32 => NotificationRecord) private _notifications;

    /// @dev Maps user ID to array of notification IDs (inbox)
    mapping(bytes32 => bytes32[]) private _inbox;

    /// @dev Maps user ID -> event pattern -> array of channel IDs (subscriptions)
    mapping(bytes32 => mapping(string => bytes32[])) private _subscriptions;

    // --- Events ---

    event ChannelRegistered(bytes32 indexed channelId);
    event Notified(bytes32 indexed notificationId, bytes32 indexed userId);
    event MarkedRead(bytes32 indexed notificationId);

    // --- Actions ---

    /// @notice Register a notification delivery channel
    /// @param channelId The unique identifier for the channel
    /// @param deliveryConfig The channel's delivery configuration
    function registerChannel(bytes32 channelId, string calldata deliveryConfig) external {
        require(channelId != bytes32(0), "Channel ID cannot be zero");
        require(bytes(deliveryConfig).length > 0, "Delivery config cannot be empty");

        _channels[channelId] = Channel({
            deliveryConfig: deliveryConfig,
            exists: true
        });

        emit ChannelRegistered(channelId);
    }

    /// @notice Send a notification to a user
    /// @param notificationId The unique identifier for the notification
    /// @param userId The recipient user ID
    /// @param eventType The type of event that triggered the notification
    /// @param context Additional context for the notification
    function notify(
        bytes32 notificationId,
        bytes32 userId,
        string calldata eventType,
        string calldata context
    ) external {
        require(notificationId != bytes32(0), "Notification ID cannot be zero");
        require(!_notifications[notificationId].exists, "Notification already exists");
        require(userId != bytes32(0), "User ID cannot be zero");

        _notifications[notificationId] = NotificationRecord({
            userId: userId,
            eventType: eventType,
            context: context,
            timestamp: block.timestamp,
            read: false,
            exists: true
        });

        _inbox[userId].push(notificationId);

        emit Notified(notificationId, userId);
    }

    /// @notice Mark a notification as read
    /// @param notificationId The notification ID to mark as read
    function markRead(bytes32 notificationId) external {
        require(_notifications[notificationId].exists, "Notification not found");
        require(!_notifications[notificationId].read, "Notification already read");

        _notifications[notificationId].read = true;

        emit MarkedRead(notificationId);
    }

    // --- Views ---

    /// @notice Retrieve a notification's full data
    /// @param notificationId The notification ID
    /// @return The notification record struct
    function getNotification(bytes32 notificationId) external view returns (NotificationRecord memory) {
        require(_notifications[notificationId].exists, "Notification not found");
        return _notifications[notificationId];
    }

    /// @notice Get the number of unread notifications for a user
    /// @param userId The user ID
    /// @return The count of unread notifications
    function getUnreadCount(bytes32 userId) external view returns (uint256) {
        bytes32[] storage inbox = _inbox[userId];
        uint256 unread = 0;

        for (uint256 i = 0; i < inbox.length; i++) {
            if (_notifications[inbox[i]].exists && !_notifications[inbox[i]].read) {
                unread++;
            }
        }

        return unread;
    }
}

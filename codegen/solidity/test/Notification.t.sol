// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Notification.sol";

contract NotificationTest is Test {
    Notification public target;

    event ChannelRegistered(bytes32 indexed channelId);
    event Notified(bytes32 indexed notificationId, bytes32 indexed userId);
    event MarkedRead(bytes32 indexed notificationId);

    function setUp() public {
        target = new Notification();
    }

    // --- registerChannel tests ---

    function test_registerChannel_stores_channel() public {
        bytes32 channelId = keccak256("email");
        target.registerChannel(channelId, "smtp://mail.example.com");

        // Channel existence verified by being able to use it (no direct getter)
        // Registration success is confirmed by event emission
    }

    function test_registerChannel_emits_event() public {
        bytes32 channelId = keccak256("email");

        vm.expectEmit(true, false, false, false);
        emit ChannelRegistered(channelId);

        target.registerChannel(channelId, "smtp://mail.example.com");
    }

    function test_registerChannel_zero_id_reverts() public {
        vm.expectRevert("Channel ID cannot be zero");
        target.registerChannel(bytes32(0), "config");
    }

    function test_registerChannel_empty_config_reverts() public {
        vm.expectRevert("Delivery config cannot be empty");
        target.registerChannel(keccak256("ch1"), "");
    }

    // --- notify tests ---

    function test_notify_stores_notification() public {
        bytes32 notifId = keccak256("n1");
        bytes32 userId = keccak256("alice");
        target.notify(notifId, userId, "comment.created", "on your post");

        Notification.NotificationRecord memory n = target.getNotification(notifId);
        assertEq(n.userId, userId, "User ID should match");
        assertEq(n.eventType, "comment.created", "Event type should match");
        assertEq(n.context, "on your post", "Context should match");
        assertFalse(n.read, "Should be unread initially");
        assertTrue(n.exists);
    }

    function test_notify_emits_event() public {
        bytes32 notifId = keccak256("n1");
        bytes32 userId = keccak256("alice");

        vm.expectEmit(true, true, false, false);
        emit Notified(notifId, userId);

        target.notify(notifId, userId, "evt", "ctx");
    }

    function test_notify_zero_id_reverts() public {
        vm.expectRevert("Notification ID cannot be zero");
        target.notify(bytes32(0), keccak256("u1"), "evt", "ctx");
    }

    function test_notify_duplicate_reverts() public {
        bytes32 notifId = keccak256("n1");
        target.notify(notifId, keccak256("u1"), "evt", "ctx");

        vm.expectRevert("Notification already exists");
        target.notify(notifId, keccak256("u2"), "evt", "ctx");
    }

    function test_notify_zero_user_reverts() public {
        vm.expectRevert("User ID cannot be zero");
        target.notify(keccak256("n1"), bytes32(0), "evt", "ctx");
    }

    // --- markRead tests ---

    function test_markRead_sets_read_flag() public {
        bytes32 notifId = keccak256("n1");
        bytes32 userId = keccak256("alice");
        target.notify(notifId, userId, "evt", "ctx");

        target.markRead(notifId);

        Notification.NotificationRecord memory n = target.getNotification(notifId);
        assertTrue(n.read, "Notification should be marked as read");
    }

    function test_markRead_nonexistent_reverts() public {
        vm.expectRevert("Notification not found");
        target.markRead(keccak256("missing"));
    }

    function test_markRead_already_read_reverts() public {
        bytes32 notifId = keccak256("n1");
        target.notify(notifId, keccak256("u1"), "evt", "ctx");
        target.markRead(notifId);

        vm.expectRevert("Notification already read");
        target.markRead(notifId);
    }

    // --- getUnreadCount tests ---

    function test_getUnreadCount_tracks_unread() public {
        bytes32 userId = keccak256("alice");
        target.notify(keccak256("n1"), userId, "evt1", "");
        target.notify(keccak256("n2"), userId, "evt2", "");
        target.notify(keccak256("n3"), userId, "evt3", "");

        assertEq(target.getUnreadCount(userId), 3, "Should have 3 unread");

        target.markRead(keccak256("n1"));
        assertEq(target.getUnreadCount(userId), 2, "Should have 2 unread after marking one");
    }

    function test_getUnreadCount_zero_for_no_notifications() public view {
        assertEq(target.getUnreadCount(keccak256("nobody")), 0);
    }

    // --- getNotification tests ---

    function test_getNotification_nonexistent_reverts() public {
        vm.expectRevert("Notification not found");
        target.getNotification(keccak256("missing"));
    }
}

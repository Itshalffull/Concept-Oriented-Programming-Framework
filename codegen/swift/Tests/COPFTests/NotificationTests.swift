// NotificationTests.swift — Tests for Notification concept

import XCTest
@testable import COPF

final class NotificationTests: XCTestCase {

    // MARK: - registerChannel

    func testRegisterChannel() async throws {
        let storage = InMemoryStorage()
        let handler = NotificationHandlerImpl()

        let result = try await handler.registerChannel(
            input: NotificationRegisterChannelInput(channelId: "email", deliveryConfig: "{\"smtp\":\"localhost\"}"),
            storage: storage
        )

        if case .ok(let channelId) = result {
            XCTAssertEqual(channelId, "email")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testRegisterChannelStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = NotificationHandlerImpl()

        _ = try await handler.registerChannel(
            input: NotificationRegisterChannelInput(channelId: "sms", deliveryConfig: "{\"provider\":\"twilio\"}"),
            storage: storage
        )

        let record = try await storage.get(relation: "notification_channel", key: "sms")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?["channelId"] as? String, "sms")
    }

    // MARK: - subscribe

    func testSubscribe() async throws {
        let storage = InMemoryStorage()
        let handler = NotificationHandlerImpl()

        let result = try await handler.subscribe(
            input: NotificationSubscribeInput(userId: "u1", eventPattern: "node.*", channelIds: "email,sms"),
            storage: storage
        )

        if case .ok(let userId, let eventPattern) = result {
            XCTAssertEqual(userId, "u1")
            XCTAssertEqual(eventPattern, "node.*")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testSubscribeMultiplePatterns() async throws {
        let storage = InMemoryStorage()
        let handler = NotificationHandlerImpl()

        _ = try await handler.subscribe(
            input: NotificationSubscribeInput(userId: "u1", eventPattern: "node.*", channelIds: "email"),
            storage: storage
        )
        _ = try await handler.subscribe(
            input: NotificationSubscribeInput(userId: "u1", eventPattern: "user.*", channelIds: "sms"),
            storage: storage
        )

        let subs = try await storage.find(relation: "notification_subscription", criteria: ["userId": "u1"])
        XCTAssertEqual(subs.count, 2)
    }

    // MARK: - notify

    func testNotify() async throws {
        let storage = InMemoryStorage()
        let handler = NotificationHandlerImpl()

        let result = try await handler.notify(
            input: NotificationNotifyInput(userId: "u1", eventType: "node.created", context: "{\"nodeId\":\"n1\"}"),
            storage: storage
        )

        if case .ok(let notificationId) = result {
            XCTAssertFalse(notificationId.isEmpty)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testNotifyStoresInStorage() async throws {
        let storage = InMemoryStorage()
        let handler = NotificationHandlerImpl()

        let result = try await handler.notify(
            input: NotificationNotifyInput(userId: "u1", eventType: "comment.added", context: "{}"),
            storage: storage
        )

        if case .ok(let notificationId) = result {
            let record = try await storage.get(relation: "notification_inbox", key: notificationId)
            XCTAssertNotNil(record)
            XCTAssertEqual(record?["userId"] as? String, "u1")
            XCTAssertEqual(record?["eventType"] as? String, "comment.added")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    // MARK: - markRead

    func testMarkRead() async throws {
        let storage = InMemoryStorage()
        let handler = NotificationHandlerImpl()

        let notifyResult = try await handler.notify(
            input: NotificationNotifyInput(userId: "u1", eventType: "e1", context: "{}"),
            storage: storage
        )
        guard case .ok(let notificationId) = notifyResult else {
            XCTFail("Expected .ok for notify"); return
        }

        let result = try await handler.markRead(
            input: NotificationMarkReadInput(notificationId: notificationId),
            storage: storage
        )

        if case .ok(let nid) = result {
            XCTAssertEqual(nid, notificationId)
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testMarkReadNotFound() async throws {
        let storage = InMemoryStorage()
        let handler = NotificationHandlerImpl()

        let result = try await handler.markRead(
            input: NotificationMarkReadInput(notificationId: "nonexistent"),
            storage: storage
        )

        if case .notfound(let message) = result {
            XCTAssertTrue(message.contains("nonexistent"))
        } else {
            XCTFail("Expected .notfound but got \(result)")
        }
    }

    // MARK: - getUnread

    func testGetUnread() async throws {
        let storage = InMemoryStorage()
        let handler = NotificationHandlerImpl()

        _ = try await handler.notify(
            input: NotificationNotifyInput(userId: "u1", eventType: "e1", context: "{}"),
            storage: storage
        )
        _ = try await handler.notify(
            input: NotificationNotifyInput(userId: "u1", eventType: "e2", context: "{}"),
            storage: storage
        )

        let result = try await handler.getUnread(
            input: NotificationGetUnreadInput(userId: "u1"),
            storage: storage
        )

        if case .ok(let userId, let notifications) = result {
            XCTAssertEqual(userId, "u1")
            XCTAssertTrue(notifications.contains("e1"))
            XCTAssertTrue(notifications.contains("e2"))
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetUnreadAfterMarkRead() async throws {
        let storage = InMemoryStorage()
        let handler = NotificationHandlerImpl()

        let notifyResult = try await handler.notify(
            input: NotificationNotifyInput(userId: "u1", eventType: "e1", context: "{}"),
            storage: storage
        )
        guard case .ok(let notificationId) = notifyResult else {
            XCTFail("Expected .ok for notify"); return
        }

        _ = try await handler.markRead(
            input: NotificationMarkReadInput(notificationId: notificationId),
            storage: storage
        )

        let result = try await handler.getUnread(
            input: NotificationGetUnreadInput(userId: "u1"),
            storage: storage
        )

        if case .ok(_, let notifications) = result {
            XCTAssertEqual(notifications, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }

    func testGetUnreadEmpty() async throws {
        let storage = InMemoryStorage()
        let handler = NotificationHandlerImpl()

        let result = try await handler.getUnread(
            input: NotificationGetUnreadInput(userId: "u1"),
            storage: storage
        )

        if case .ok(_, let notifications) = result {
            XCTAssertEqual(notifications, "[]")
        } else {
            XCTFail("Expected .ok but got \(result)")
        }
    }
}

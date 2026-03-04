// ============================================================
// Clef Surface AppKit Widget — NotificationCenter
//
// Aggregated notification list with categories, mark-all-read,
// and individual notification actions.
// ============================================================

import AppKit

public class ClefNotificationCenterView: NSView {
    public struct Notification {
        public let id: String
        public let title: String
        public let message: String
        public let category: String
        public var isRead: Bool
        public init(id: String, title: String, message: String, category: String = "general", isRead: Bool = false) {
            self.id = id; self.title = title; self.message = message; self.category = category; self.isRead = isRead
        }
    }

    public var notifications: [Notification] = [] { didSet { rebuild() } }
    public var onNotificationClick: ((String) -> Void)?
    public var onMarkAllRead: (() -> Void)?

    private let headerStack = NSStackView()
    private let scrollView = NSScrollView()
    private let stackView = NSStackView()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        let titleLabel = NSTextField(labelWithString: "Notifications")
        titleLabel.font = NSFont.systemFont(ofSize: 14, weight: .semibold)
        let markAllBtn = NSButton(title: "Mark all read", target: self, action: #selector(markAll))
        markAllBtn.bezelStyle = .inline
        headerStack.orientation = .horizontal
        headerStack.addArrangedSubview(titleLabel)
        headerStack.addArrangedSubview(markAllBtn)
        addSubview(headerStack)

        stackView.orientation = .vertical
        stackView.spacing = 4
        scrollView.documentView = stackView
        scrollView.hasVerticalScroller = true
        scrollView.drawsBackground = false
        addSubview(scrollView)
    }

    @objc private func markAll() { onMarkAllRead?() }

    private func rebuild() {
        stackView.arrangedSubviews.forEach { stackView.removeArrangedSubview($0); $0.removeFromSuperview() }
        for (i, notif) in notifications.enumerated() {
            let item = ClefNotificationItemView()
            item.title = notif.title
            item.message = notif.message
            item.isRead = notif.isRead
            item.onClick = { [weak self] in self?.onNotificationClick?(notif.id) }
            item.frame = NSRect(x: 0, y: 0, width: bounds.width, height: 56)
            stackView.addArrangedSubview(item)
        }
    }

    public override func layout() {
        super.layout()
        headerStack.frame = NSRect(x: 8, y: bounds.height - 32, width: bounds.width - 16, height: 28)
        scrollView.frame = NSRect(x: 0, y: 0, width: bounds.width, height: bounds.height - 36)
    }
}

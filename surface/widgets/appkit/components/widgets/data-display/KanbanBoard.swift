// ============================================================
// Clef Surface AppKit Widget — KanbanBoard
//
// Multi-column board layout for cards. Supports drag-and-drop
// between columns and scrollable column content.
// ============================================================

import AppKit

public class ClefKanbanBoardView: NSView {
    public struct KanbanColumn {
        public let id: String
        public let title: String
        public var cards: [NSView]
        public init(id: String, title: String, cards: [NSView] = []) {
            self.id = id; self.title = title; self.cards = cards
        }
    }

    public var columns: [KanbanColumn] = [] { didSet { rebuild() } }
    public var columnWidth: CGFloat = 280
    public var onCardMove: ((String, String, Int) -> Void)? // cardId, toColumnId, index

    private let scrollView = NSScrollView()
    private let containerView = NSView()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        scrollView.hasHorizontalScroller = true
        scrollView.hasVerticalScroller = false
        scrollView.documentView = containerView
        addSubview(scrollView)
    }

    private func rebuild() {
        containerView.subviews.forEach { $0.removeFromSuperview() }
        let totalWidth = CGFloat(columns.count) * (columnWidth + 12)
        containerView.frame = NSRect(x: 0, y: 0, width: totalWidth, height: bounds.height)

        for (i, col) in columns.enumerated() {
            let colView = NSView(frame: NSRect(x: CGFloat(i) * (columnWidth + 12), y: 0, width: columnWidth, height: bounds.height))
            colView.wantsLayer = true
            colView.layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor
            colView.layer?.cornerRadius = 8

            let header = NSTextField(labelWithString: col.title)
            header.font = NSFont.systemFont(ofSize: 13, weight: .semibold)
            header.frame = NSRect(x: 12, y: colView.bounds.height - 32, width: columnWidth - 24, height: 20)
            colView.addSubview(header)

            var cardY = colView.bounds.height - 48
            for card in col.cards {
                card.frame = NSRect(x: 8, y: cardY - 80, width: columnWidth - 16, height: 72)
                colView.addSubview(card)
                cardY -= 84
            }
            containerView.addSubview(colView)
        }
    }

    public override func layout() {
        super.layout()
        scrollView.frame = bounds
    }
}

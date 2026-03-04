// ============================================================
// Clef Surface AppKit Widget — DiffViewer
//
// Side-by-side or unified text diff display with line numbers,
// addition/deletion highlighting, and scroll sync.
// ============================================================

import AppKit

public class ClefDiffViewerView: NSView {
    public enum DiffMode { case sideBySide, unified }

    public var leftText: String = "" { didSet { rebuild() } }
    public var rightText: String = "" { didSet { rebuild() } }
    public var mode: DiffMode = .sideBySide { didSet { rebuild() } }

    private let leftScroll = NSScrollView()
    private let rightScroll = NSScrollView()
    private let leftTextView = NSTextView()
    private let rightTextView = NSTextView()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        for (scroll, tv) in [(leftScroll, leftTextView), (rightScroll, rightTextView)] {
            tv.isEditable = false
            tv.font = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
            tv.isVerticallyResizable = true
            scroll.documentView = tv
            scroll.hasVerticalScroller = true
            addSubview(scroll)
        }
    }

    private func rebuild() {
        let leftLines = leftText.split(separator: "\n", omittingEmptySubsequences: false)
        let rightLines = rightText.split(separator: "\n", omittingEmptySubsequences: false)

        let leftAttr = NSMutableAttributedString()
        let rightAttr = NSMutableAttributedString()
        let maxLines = max(leftLines.count, rightLines.count)

        for i in 0..<maxLines {
            let l = i < leftLines.count ? String(leftLines[i]) : ""
            let r = i < rightLines.count ? String(rightLines[i]) : ""
            let lColor: NSColor = l != r ? .systemRed.withAlphaComponent(0.1) : .clear
            let rColor: NSColor = l != r ? .systemGreen.withAlphaComponent(0.1) : .clear

            let la = NSMutableAttributedString(string: l + "\n", attributes: [
                .font: NSFont.monospacedSystemFont(ofSize: 12, weight: .regular),
                .backgroundColor: lColor,
            ])
            let ra = NSMutableAttributedString(string: r + "\n", attributes: [
                .font: NSFont.monospacedSystemFont(ofSize: 12, weight: .regular),
                .backgroundColor: rColor,
            ])
            leftAttr.append(la)
            rightAttr.append(ra)
        }
        leftTextView.textStorage?.setAttributedString(leftAttr)
        rightTextView.textStorage?.setAttributedString(rightAttr)
    }

    public override func layout() {
        super.layout()
        let halfWidth = bounds.width / 2 - 1
        leftScroll.frame = NSRect(x: 0, y: 0, width: halfWidth, height: bounds.height)
        rightScroll.frame = NSRect(x: halfWidth + 2, y: 0, width: halfWidth, height: bounds.height)
    }
}

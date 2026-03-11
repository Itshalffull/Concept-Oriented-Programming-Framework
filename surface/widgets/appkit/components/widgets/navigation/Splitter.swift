// ============================================================
// Clef Surface AppKit Widget — Splitter
//
// Resizable split view with draggable divider. Supports
// horizontal and vertical orientations with min/max panes.
// ============================================================

import AppKit

public class ClefSplitterView: NSSplitView {
    public var minPaneSize: CGFloat = 100
    public var initialRatio: CGFloat = 0.5

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        dividerStyle = .thin
        isVertical = true
        delegate = self
    }

    public func setPanes(leading: NSView, trailing: NSView) {
        subviews.forEach { $0.removeFromSuperview() }
        addArrangedSubview(leading)
        addArrangedSubview(trailing)
        setPosition(bounds.width * initialRatio, ofDividerAt: 0)
    }
}

extension ClefSplitterView: NSSplitViewDelegate {
    public func splitView(_ splitView: NSSplitView, constrainMinCoordinate proposedMinimumPosition: CGFloat, ofSubviewAt dividerIndex: Int) -> CGFloat {
        return minPaneSize
    }

    public func splitView(_ splitView: NSSplitView, constrainMaxCoordinate proposedMaximumPosition: CGFloat, ofSubviewAt dividerIndex: Int) -> CGFloat {
        return (isVertical ? bounds.width : bounds.height) - minPaneSize
    }
}

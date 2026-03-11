// ============================================================
// Clef Surface AppKit Widget — ConstraintAnchorIndicator
//
// Visual overlay for ConstraintAnchor constraints on the canvas.
// Shows pin icons for pinned items, alignment lines for aligned
// groups, and separation arrows for gap constraints.
// ============================================================

import AppKit

public enum ClefConstraintAnchorType: String {
    case pin = "pin"
    case alignH = "align_h"
    case alignV = "align_v"
    case separate = "separate"
    case groupBounds = "group_bounds"
    case flowDirection = "flow_direction"
}

public class ClefConstraintAnchorIndicatorView: NSView {
    public var anchorId: String = ""
    public var anchorType: ClefConstraintAnchorType = .pin { didSet { needsDisplay = true } }
    public var targetItems: [String] = []
    public var targetCount: Int = 0 { didSet { updateAccessibilityLabel() } }
    public var parameterX: CGFloat? = nil
    public var parameterY: CGFloat? = nil
    public var parameterGap: CGFloat? = nil
    public var parameterAxis: String? = nil
    public var parameterDirection: String? = nil
    public var onSelect: (() -> Void)?
    public var onDelete: (() -> Void)?

    private var isHovered = false { didSet { needsDisplay = true } }
    private var isSelected = false { didSet { needsDisplay = true } }
    private var trackingArea: NSTrackingArea?

    private static let highlightColor = NSColor.controlAccentColor.withAlphaComponent(0.6)
    private static let selectedColor = NSColor.controlAccentColor

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        wantsLayer = true
        setAccessibilityRole(.image)
        updateAccessibilityLabel()
    }

    public override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let existing = trackingArea { removeTrackingArea(existing) }
        trackingArea = NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .activeInActiveApp], owner: self, userInfo: nil)
        addTrackingArea(trackingArea!)
    }

    public override func mouseEntered(with event: NSEvent) { isHovered = true }
    public override func mouseExited(with event: NSEvent) { isHovered = false }

    public override func mouseDown(with event: NSEvent) {
        isSelected = !isSelected
        onSelect?()
    }

    public override func keyDown(with event: NSEvent) {
        if event.keyCode == 51 || event.charactersIgnoringModifiers == "\u{7F}" { // Delete
            onDelete?()
        } else if event.keyCode == 53 { // Escape
            isSelected = false
        } else {
            super.keyDown(with: event)
        }
    }

    public override var acceptsFirstResponder: Bool { true }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard let ctx = NSGraphicsContext.current?.cgContext else { return }

        let strokeColor = isSelected ? Self.selectedColor : (isHovered ? Self.highlightColor : NSColor.secondaryLabelColor)

        switch anchorType {
        case .pin:
            drawPinIcon(ctx: ctx, color: strokeColor)
        case .alignH:
            drawAlignmentLine(ctx: ctx, color: strokeColor, horizontal: true)
        case .alignV:
            drawAlignmentLine(ctx: ctx, color: strokeColor, horizontal: false)
        case .separate:
            drawSeparationArrows(ctx: ctx, color: strokeColor)
        case .groupBounds:
            drawGroupBounds(ctx: ctx, color: strokeColor)
        case .flowDirection:
            drawFlowDirection(ctx: ctx, color: strokeColor)
        }
    }

    // MARK: — Drawing helpers

    private func drawPinIcon(ctx: CGContext, color: NSColor) {
        let center = NSPoint(x: bounds.midX, y: bounds.midY)
        let pinSize: CGFloat = 12
        ctx.setFillColor(color.cgColor)
        ctx.fillEllipse(in: CGRect(x: center.x - pinSize / 2, y: center.y, width: pinSize, height: pinSize))
        ctx.setStrokeColor(color.cgColor)
        ctx.setLineWidth(2)
        ctx.move(to: CGPoint(x: center.x, y: center.y))
        ctx.addLine(to: CGPoint(x: center.x, y: center.y - 8))
        ctx.strokePath()
    }

    private func drawAlignmentLine(ctx: CGContext, color: NSColor, horizontal: Bool) {
        ctx.setStrokeColor(color.cgColor)
        ctx.setLineWidth(1.5)
        ctx.setLineDash(phase: 0, lengths: [6, 3])
        if horizontal {
            let y = bounds.midY
            ctx.move(to: CGPoint(x: 0, y: y))
            ctx.addLine(to: CGPoint(x: bounds.width, y: y))
        } else {
            let x = bounds.midX
            ctx.move(to: CGPoint(x: x, y: 0))
            ctx.addLine(to: CGPoint(x: x, y: bounds.height))
        }
        ctx.strokePath()
        ctx.setLineDash(phase: 0, lengths: [])
    }

    private func drawSeparationArrows(ctx: CGContext, color: NSColor) {
        let midY = bounds.midY
        let arrowLen: CGFloat = 6
        ctx.setStrokeColor(color.cgColor)
        ctx.setLineWidth(1.5)

        // Horizontal double-headed arrow
        ctx.move(to: CGPoint(x: 8, y: midY))
        ctx.addLine(to: CGPoint(x: bounds.width - 8, y: midY))
        ctx.strokePath()

        // Left arrowhead
        ctx.move(to: CGPoint(x: 8 + arrowLen, y: midY - arrowLen))
        ctx.addLine(to: CGPoint(x: 8, y: midY))
        ctx.addLine(to: CGPoint(x: 8 + arrowLen, y: midY + arrowLen))
        ctx.strokePath()

        // Right arrowhead
        ctx.move(to: CGPoint(x: bounds.width - 8 - arrowLen, y: midY - arrowLen))
        ctx.addLine(to: CGPoint(x: bounds.width - 8, y: midY))
        ctx.addLine(to: CGPoint(x: bounds.width - 8 - arrowLen, y: midY + arrowLen))
        ctx.strokePath()

        // Gap label
        if let gap = parameterGap {
            let label = "\(Int(gap))pt" as NSString
            let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 9), .foregroundColor: color]
            let size = label.size(withAttributes: attrs)
            label.draw(at: NSPoint(x: bounds.midX - size.width / 2, y: midY + 4), withAttributes: attrs)
        }
    }

    private func drawGroupBounds(ctx: CGContext, color: NSColor) {
        ctx.setStrokeColor(color.cgColor)
        ctx.setLineWidth(1)
        ctx.setLineDash(phase: 0, lengths: [4, 4])
        let inset = bounds.insetBy(dx: 4, dy: 4)
        ctx.stroke(inset)
        ctx.setLineDash(phase: 0, lengths: [])
    }

    private func drawFlowDirection(ctx: CGContext, color: NSColor) {
        let arrowLen: CGFloat = 8
        ctx.setStrokeColor(color.cgColor)
        ctx.setLineWidth(2)
        ctx.move(to: CGPoint(x: bounds.midX, y: bounds.height - 8))
        ctx.addLine(to: CGPoint(x: bounds.midX, y: 8))
        ctx.strokePath()
        // Arrowhead
        ctx.move(to: CGPoint(x: bounds.midX - arrowLen, y: 8 + arrowLen))
        ctx.addLine(to: CGPoint(x: bounds.midX, y: 8))
        ctx.addLine(to: CGPoint(x: bounds.midX + arrowLen, y: 8 + arrowLen))
        ctx.strokePath()
    }

    private func updateAccessibilityLabel() {
        setAccessibilityLabel("\(anchorType.rawValue) constraint on \(targetCount) items")
    }
}

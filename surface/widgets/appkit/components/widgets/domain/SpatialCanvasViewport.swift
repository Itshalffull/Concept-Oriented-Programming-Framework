// ============================================================
// Clef Surface AppKit Widget — SpatialCanvasViewport
//
// Primary spatial editing surface using NSView + Core Graphics.
// Implements the spatial-canvas-viewport.widget spec: camera
// transforms (pan/zoom-at-point), layered rendering (grid, items,
// connectors, selection marquee), viewport culling, and the full
// state machine (idle, panning, selecting, contextMenu).
// ============================================================

import AppKit
import CoreGraphics

// MARK: - Data Types

public struct SpatialCanvasItem {
    public let id: String
    public var x: CGFloat
    public var y: CGFloat
    public var width: CGFloat
    public var height: CGFloat
    public var type: String

    public init(id: String, x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat, type: String) {
        self.id = id; self.x = x; self.y = y; self.width = width; self.height = height; self.type = type
    }

    public var frame: NSRect { NSRect(x: x, y: y, width: width, height: height) }
}

public struct SpatialCanvasConnector {
    public let id: String
    public let sourceId: String
    public let targetId: String
    public var lineStyle: String // "solid" | "dashed"

    public init(id: String, sourceId: String, targetId: String, lineStyle: String = "solid") {
        self.id = id; self.sourceId = sourceId; self.targetId = targetId; self.lineStyle = lineStyle
    }
}

public struct SpatialCamera: Equatable {
    public var x: CGFloat
    public var y: CGFloat
    public var zoom: CGFloat

    public init(x: CGFloat = 0, y: CGFloat = 0, zoom: CGFloat = 1) {
        self.x = x; self.y = y; self.zoom = zoom
    }
}

// MARK: - State Machine

public enum SpatialViewportInteraction: String {
    case idle
    case panning
    case selecting
    case contextMenu
}

// MARK: - Delegate

public protocol SpatialCanvasViewportDelegate: AnyObject {
    func viewportDidChangeCamera(_ camera: SpatialCamera)
    func viewportDidChangeSelection(_ itemIds: [String])
    func viewportDidRequestContextMenu(at point: NSPoint, worldPoint: NSPoint)
    func viewportDidPressItem(_ itemId: String, at point: NSPoint)
    func viewportDidDeleteSelected()
}

// MARK: - SpatialCanvasViewportView

public class SpatialCanvasViewportView: NSView {

    // --- Public properties (matching widget spec props) ---
    public var canvasId: String = ""
    public var canvasName: String = "" { didSet { updateAccessibility() } }
    public var camera: SpatialCamera = SpatialCamera() { didSet { needsDisplay = true } }
    public var zoomMin: CGFloat = 0.1
    public var zoomMax: CGFloat = 5.0
    public var gridVisible: Bool = true { didSet { needsDisplay = true } }
    public var gridSize: CGFloat = 20 { didSet { needsDisplay = true } }
    public var gridStyle: String = "dots" { didSet { needsDisplay = true } } // "dots" | "lines" | "none"
    public var snapToGrid: Bool = true
    public var selectedItemIds: Set<String> = [] { didSet { needsDisplay = true } }
    public var items: [SpatialCanvasItem] = [] { didSet { needsDisplay = true } }
    public var connectors: [SpatialCanvasConnector] = [] { didSet { needsDisplay = true } }
    public var backgroundFill: NSColor = NSColor(red: 0.98, green: 0.98, blue: 0.98, alpha: 1)

    public weak var delegate: SpatialCanvasViewportDelegate?

    // --- Internal state ---
    private var interaction: SpatialViewportInteraction = .idle
    private var panAnchor: NSPoint = .zero
    private var panCameraAnchor: NSPoint = .zero
    private var marqueeStart: NSPoint = .zero
    private var marqueeEnd: NSPoint = .zero
    private var marqueeSelectedIds: [String] = []

    // MARK: - Init

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        wantsLayer = true
        layer?.backgroundColor = backgroundFill.cgColor
        updateAccessibility()
    }

    private func updateAccessibility() {
        setAccessibilityRole(.group)
        setAccessibilityLabel("Canvas: \(canvasName)")
        setAccessibilityRoleDescription("spatial canvas")
    }

    // MARK: - Coordinate transforms

    private func screenToWorld(_ point: NSPoint) -> NSPoint {
        let local = convert(point, from: nil)
        return NSPoint(
            x: local.x / camera.zoom - camera.x,
            y: local.y / camera.zoom - camera.y
        )
    }

    private func worldToScreen(_ point: NSPoint) -> NSPoint {
        return NSPoint(
            x: (point.x + camera.x) * camera.zoom,
            y: (point.y + camera.y) * camera.zoom
        )
    }

    // MARK: - Viewport culling

    private func visibleItems() -> [SpatialCanvasItem] {
        let left = -camera.x
        let bottom = -camera.y
        let right = left + bounds.width / camera.zoom
        let top = bottom + bounds.height / camera.zoom
        return items.filter { item in
            item.x + item.width >= left && item.x <= right &&
            item.y + item.height >= bottom && item.y <= top
        }
    }

    // MARK: - Hit testing

    private func hitItem(at worldPoint: NSPoint) -> SpatialCanvasItem? {
        return items.first { item in
            item.frame.contains(worldPoint)
        }
    }

    // MARK: - Marquee selection

    private func computeMarqueeSelection() {
        let left = min(marqueeStart.x, marqueeEnd.x)
        let right = max(marqueeStart.x, marqueeEnd.x)
        let bottom = min(marqueeStart.y, marqueeEnd.y)
        let top = max(marqueeStart.y, marqueeEnd.y)
        let rect = NSRect(x: left, y: bottom, width: right - left, height: top - bottom)

        marqueeSelectedIds = items
            .filter { rect.intersects($0.frame) }
            .map { $0.id }
    }

    // MARK: - Zoom at point

    private func zoomAtPoint(delta: CGFloat, location: NSPoint) {
        let factor: CGFloat = delta > 0 ? 1.05 : 0.95
        let nextZoom = max(zoomMin, min(zoomMax, camera.zoom * factor))

        let worldX = location.x / camera.zoom - camera.x
        let worldY = location.y / camera.zoom - camera.y
        let newX = location.x / nextZoom - worldX
        let newY = location.y / nextZoom - worldY

        camera = SpatialCamera(x: newX, y: newY, zoom: nextZoom)
        delegate?.viewportDidChangeCamera(camera)
    }

    // MARK: - Mouse / Trackpad Events

    public override func mouseDown(with event: NSEvent) {
        window?.makeFirstResponder(self)
        let local = convert(event.locationInWindow, from: nil)
        let worldPt = screenToWorld(event.locationInWindow)

        // Check if clicking on an item
        if let hitItem = hitItem(at: worldPt) {
            delegate?.viewportDidPressItem(hitItem.id, at: local)
            return
        }

        // Start panning (middle button or option-click) or marquee selection
        if event.modifierFlags.contains(.option) || event.buttonNumber == 2 {
            interaction = .panning
            panAnchor = event.locationInWindow
            panCameraAnchor = NSPoint(x: camera.x, y: camera.y)
            NSCursor.closedHand.set()
        } else {
            // Start marquee selection
            interaction = .selecting
            marqueeStart = worldPt
            marqueeEnd = worldPt
            marqueeSelectedIds = []
        }
    }

    public override func mouseDragged(with event: NSEvent) {
        switch interaction {
        case .panning:
            let dx = (event.locationInWindow.x - panAnchor.x) / camera.zoom
            let dy = (event.locationInWindow.y - panAnchor.y) / camera.zoom
            camera = SpatialCamera(
                x: panCameraAnchor.x + dx,
                y: panCameraAnchor.y + dy,
                zoom: camera.zoom
            )
            delegate?.viewportDidChangeCamera(camera)

        case .selecting:
            marqueeEnd = screenToWorld(event.locationInWindow)
            computeMarqueeSelection()
            needsDisplay = true

        default:
            break
        }
    }

    public override func mouseUp(with event: NSEvent) {
        switch interaction {
        case .panning:
            NSCursor.arrow.set()
            interaction = .idle

        case .selecting:
            computeMarqueeSelection()
            selectedItemIds = Set(marqueeSelectedIds)
            delegate?.viewportDidChangeSelection(marqueeSelectedIds)
            interaction = .idle
            needsDisplay = true

        default:
            break
        }
    }

    public override func rightMouseDown(with event: NSEvent) {
        let local = convert(event.locationInWindow, from: nil)
        let worldPt = screenToWorld(event.locationInWindow)
        interaction = .contextMenu
        delegate?.viewportDidRequestContextMenu(at: local, worldPoint: worldPt)
    }

    public override func scrollWheel(with event: NSEvent) {
        if event.modifierFlags.contains(.command) || event.phase == .changed {
            // Zoom-at-point
            let local = convert(event.locationInWindow, from: nil)
            zoomAtPoint(delta: -event.scrollingDeltaY, location: local)
        } else {
            // Pan
            camera.x += event.scrollingDeltaX / camera.zoom
            camera.y += event.scrollingDeltaY / camera.zoom
            delegate?.viewportDidChangeCamera(camera)
        }
    }

    public override func magnify(with event: NSEvent) {
        let local = convert(event.locationInWindow, from: nil)
        let nextZoom = max(zoomMin, min(zoomMax, camera.zoom * (1 + event.magnification)))
        let worldX = local.x / camera.zoom - camera.x
        let worldY = local.y / camera.zoom - camera.y
        camera = SpatialCamera(
            x: local.x / nextZoom - worldX,
            y: local.y / nextZoom - worldY,
            zoom: nextZoom
        )
        delegate?.viewportDidChangeCamera(camera)
    }

    // MARK: - Keyboard

    public override var acceptsFirstResponder: Bool { true }

    public override func keyDown(with event: NSEvent) {
        switch event.charactersIgnoringModifiers {
        case "\u{1b}": // Escape
            if interaction == .contextMenu {
                interaction = .idle
                needsDisplay = true
            }
        case "\u{7f}": // Delete
            delegate?.viewportDidDeleteSelected()
        case "=", "+":
            if event.modifierFlags.contains(.command) {
                zoomAtPoint(delta: -100, location: NSPoint(x: bounds.midX, y: bounds.midY))
            }
        case "-":
            if event.modifierFlags.contains(.command) {
                zoomAtPoint(delta: 100, location: NSPoint(x: bounds.midX, y: bounds.midY))
            }
        case "0":
            if event.modifierFlags.contains(.command) {
                camera.zoom = 1
                delegate?.viewportDidChangeCamera(camera)
            }
        case "a":
            if event.modifierFlags.contains(.command) {
                selectedItemIds = Set(items.map { $0.id })
                delegate?.viewportDidChangeSelection(Array(selectedItemIds))
                needsDisplay = true
            }
        default:
            // Arrow key nudge
            switch event.keyCode {
            case 126: // Up
                camera.y += 10 / camera.zoom
                delegate?.viewportDidChangeCamera(camera)
            case 125: // Down
                camera.y -= 10 / camera.zoom
                delegate?.viewportDidChangeCamera(camera)
            case 123: // Left
                camera.x += 10 / camera.zoom
                delegate?.viewportDidChangeCamera(camera)
            case 124: // Right
                camera.x -= 10 / camera.zoom
                delegate?.viewportDidChangeCamera(camera)
            default:
                super.keyDown(with: event)
            }
        }
    }

    // MARK: - Drawing

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard let ctx = NSGraphicsContext.current?.cgContext else { return }

        // Background fill
        ctx.setFillColor(backgroundFill.cgColor)
        ctx.fill(bounds)

        // Apply camera transform
        ctx.saveGState()
        ctx.scaleBy(x: camera.zoom, y: camera.zoom)
        ctx.translateBy(x: camera.x, y: camera.y)

        // --- Grid layer ---
        if gridVisible && gridStyle != "none" {
            let visLeft = -camera.x
            let visBottom = -camera.y
            let visWidth = bounds.width / camera.zoom
            let visHeight = bounds.height / camera.zoom

            if gridStyle == "dots" {
                ctx.setFillColor(NSColor.separatorColor.withAlphaComponent(0.4).cgColor)
                var gx = floor(visLeft / gridSize) * gridSize
                while gx <= visLeft + visWidth {
                    var gy = floor(visBottom / gridSize) * gridSize
                    while gy <= visBottom + visHeight {
                        ctx.fillEllipse(in: CGRect(x: gx - 0.8, y: gy - 0.8, width: 1.6, height: 1.6))
                        gy += gridSize
                    }
                    gx += gridSize
                }
            } else if gridStyle == "lines" {
                ctx.setStrokeColor(NSColor.separatorColor.withAlphaComponent(0.25).cgColor)
                ctx.setLineWidth(0.5 / camera.zoom)
                var gx = floor(visLeft / gridSize) * gridSize
                while gx <= visLeft + visWidth {
                    ctx.move(to: CGPoint(x: gx, y: visBottom))
                    ctx.addLine(to: CGPoint(x: gx, y: visBottom + visHeight))
                    gx += gridSize
                }
                var gy = floor(visBottom / gridSize) * gridSize
                while gy <= visBottom + visHeight {
                    ctx.move(to: CGPoint(x: visLeft, y: gy))
                    ctx.addLine(to: CGPoint(x: visLeft + visWidth, y: gy))
                    gy += gridSize
                }
                ctx.strokePath()
            }
        }

        // --- Connector layer ---
        let itemMap = Dictionary(uniqueKeysWithValues: items.map { ($0.id, $0) })
        for conn in connectors {
            guard let source = itemMap[conn.sourceId], let target = itemMap[conn.targetId] else { continue }
            let sx = source.x + source.width / 2
            let sy = source.y + source.height / 2
            let tx = target.x + target.width / 2
            let ty = target.y + target.height / 2
            let mx = (sx + tx) / 2

            ctx.setStrokeColor(NSColor.systemGray.withAlphaComponent(0.6).cgColor)
            ctx.setLineWidth(2.0 / camera.zoom)

            if conn.lineStyle == "dashed" {
                ctx.setLineDash(phase: 0, lengths: [6 / camera.zoom, 4 / camera.zoom])
            } else {
                ctx.setLineDash(phase: 0, lengths: [])
            }

            ctx.move(to: CGPoint(x: sx, y: sy))
            ctx.addCurve(
                to: CGPoint(x: tx, y: ty),
                control1: CGPoint(x: mx, y: sy),
                control2: CGPoint(x: mx, y: ty)
            )
            ctx.strokePath()
        }

        // --- Item layer ---
        let culled = visibleItems()
        for item in culled {
            let isSelected = selectedItemIds.contains(item.id)
            let rect = item.frame

            // Item background
            ctx.setFillColor(NSColor.controlBackgroundColor.cgColor)
            let rp = CGPath(roundedRect: rect, cornerWidth: 4, cornerHeight: 4, transform: nil)
            ctx.addPath(rp)
            ctx.fillPath()

            // Item border
            ctx.setStrokeColor(
                isSelected
                    ? NSColor.controlAccentColor.cgColor
                    : NSColor.separatorColor.cgColor
            )
            ctx.setLineWidth((isSelected ? 2.0 : 1.0) / camera.zoom)
            ctx.setLineDash(phase: 0, lengths: [])
            ctx.addPath(rp)
            ctx.strokePath()

            // Item type label
            let attrs: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: 10 / camera.zoom),
                .foregroundColor: NSColor.secondaryLabelColor,
            ]
            let label = NSAttributedString(string: item.type, attributes: attrs)
            let labelSize = label.size()
            let labelOrigin = NSPoint(
                x: rect.midX - labelSize.width / 2,
                y: rect.midY - labelSize.height / 2
            )
            label.draw(at: labelOrigin)
        }

        ctx.restoreGState()

        // --- Selection marquee (drawn in screen coords) ---
        if interaction == .selecting {
            let s = worldToScreen(marqueeStart)
            let e = worldToScreen(marqueeEnd)
            let marqueeRect = NSRect(
                x: min(s.x, e.x), y: min(s.y, e.y),
                width: abs(e.x - s.x), height: abs(e.y - s.y)
            )
            ctx.setFillColor(NSColor.controlAccentColor.withAlphaComponent(0.08).cgColor)
            ctx.fill(marqueeRect)
            ctx.setStrokeColor(NSColor.controlAccentColor.cgColor)
            ctx.setLineWidth(1)
            ctx.setLineDash(phase: 0, lengths: [])
            ctx.stroke(marqueeRect)
        }
    }

    // MARK: - Public API

    /// Dismiss context menu and return to idle.
    public func closeContextMenu() {
        interaction = .idle
        needsDisplay = true
    }

    /// Fit all items into the viewport.
    public func zoomToFit() {
        guard !items.isEmpty else { return }
        let allRect = items.reduce(into: items[0].frame) { result, item in
            result = result.union(item.frame)
        }
        let padded = allRect.insetBy(dx: -40, dy: -40)
        let scaleX = bounds.width / padded.width
        let scaleY = bounds.height / padded.height
        let fitZoom = max(zoomMin, min(zoomMax, min(scaleX, scaleY)))
        camera = SpatialCamera(
            x: -padded.origin.x + (bounds.width / fitZoom - padded.width) / 2,
            y: -padded.origin.y + (bounds.height / fitZoom - padded.height) / 2,
            zoom: fitZoom
        )
        delegate?.viewportDidChangeCamera(camera)
    }
}

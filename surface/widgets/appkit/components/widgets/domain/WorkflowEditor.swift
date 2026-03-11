// ============================================================
// Clef Surface AppKit Widget — WorkflowEditor
//
// Visual workflow builder with draggable nodes, connectors,
// and a sidebar of available step types.
// ============================================================

import AppKit

public class ClefWorkflowEditorView: NSView {
    public var nodes: [ClefCanvasNodeView] = [] { didSet { rebuild() } }
    public var onWorkflowChange: (() -> Void)?

    private let canvas = ClefCanvasView()
    private let sidebar = NSView()
    private let toolbox = NSStackView()

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        sidebar.wantsLayer = true; sidebar.layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor
        toolbox.orientation = .vertical; toolbox.spacing = 8; toolbox.alignment = .leading
        sidebar.addSubview(toolbox)
        addSubview(sidebar); addSubview(canvas)
    }

    public func addToolboxItem(label: String, onAdd: @escaping () -> Void) {
        let btn = NSButton(title: label, target: nil, action: nil)
        btn.bezelStyle = .rounded
        toolbox.addArrangedSubview(btn)
    }

    private func rebuild() {
        canvas.subviews.forEach { $0.removeFromSuperview() }
        for node in nodes { canvas.addSubview(node) }
    }

    public override func layout() {
        super.layout()
        let sidebarWidth: CGFloat = 200
        sidebar.frame = NSRect(x: 0, y: 0, width: sidebarWidth, height: bounds.height)
        toolbox.frame = sidebar.bounds.insetBy(dx: 8, dy: 8)
        canvas.frame = NSRect(x: sidebarWidth, y: 0, width: bounds.width - sidebarWidth, height: bounds.height)
    }
}

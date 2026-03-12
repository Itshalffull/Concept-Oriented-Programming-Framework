// ============================================================
// Clef Surface AppKit Widget — CanvasPanel
//
// Generic collapsible panel that docks to the left or right
// side of a canvas. Provides a header with title and collapse
// toggle, and a scrollable body area for arbitrary content.
// ============================================================

import AppKit

public enum ClefPanelDock: String {
    case left = "left"
    case right = "right"
}

public enum ClefPanelState: String {
    case expanded = "expanded"
    case collapsed = "collapsed"
    case minimized = "minimized"
}

public class ClefCanvasPanelView: NSView {
    public var canvasId: String = ""
    public var panelTitle: String = "Panel" { didSet { titleLabel.stringValue = panelTitle } }
    public var dock: ClefPanelDock = .right
    public var defaultWidth: CGFloat = 320 { didSet { widthConstraint?.constant = defaultWidth } }
    public var isCollapsible: Bool = true { didSet { collapseButton.isHidden = !isCollapsible } }
    public var panelState: ClefPanelState = .expanded { didSet { updatePanelState() } }
    public var onCollapse: (() -> Void)?
    public var onExpand: (() -> Void)?

    private let headerView = NSView()
    private let titleLabel = NSTextField(labelWithString: "Panel")
    private let collapseButton = NSButton()
    private let bodyScrollView = NSScrollView()
    private let bodyContentView = NSView()
    private var widthConstraint: NSLayoutConstraint?
    private var bodyHeightConstraint: NSLayoutConstraint?

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        wantsLayer = true
        layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor
        layer?.borderWidth = 1
        layer?.borderColor = NSColor.separatorColor.cgColor
        translatesAutoresizingMaskIntoConstraints = false

        // Width constraint
        let wc = widthAnchor.constraint(equalToConstant: defaultWidth)
        wc.isActive = true
        widthConstraint = wc

        // Header
        headerView.wantsLayer = true
        headerView.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
        headerView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(headerView)

        titleLabel.font = NSFont.systemFont(ofSize: 13, weight: .semibold)
        titleLabel.textColor = .labelColor
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(titleLabel)

        collapseButton.bezelStyle = .inline
        collapseButton.isBordered = false
        collapseButton.image = NSImage(systemSymbolName: "sidebar.right", accessibilityDescription: "Toggle panel")
        collapseButton.imagePosition = .imageOnly
        collapseButton.target = self
        collapseButton.action = #selector(toggleCollapse(_:))
        collapseButton.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(collapseButton)

        // Body scroll view
        bodyScrollView.hasVerticalScroller = true
        bodyScrollView.hasHorizontalScroller = false
        bodyScrollView.autohidesScrollers = true
        bodyScrollView.borderType = .noBorder
        bodyScrollView.drawsBackground = false
        bodyScrollView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(bodyScrollView)

        bodyContentView.translatesAutoresizingMaskIntoConstraints = false
        bodyScrollView.documentView = bodyContentView

        NSLayoutConstraint.activate([
            // Header
            headerView.topAnchor.constraint(equalTo: topAnchor),
            headerView.leadingAnchor.constraint(equalTo: leadingAnchor),
            headerView.trailingAnchor.constraint(equalTo: trailingAnchor),
            headerView.heightAnchor.constraint(equalToConstant: 36),

            titleLabel.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),
            titleLabel.leadingAnchor.constraint(equalTo: headerView.leadingAnchor, constant: 12),

            collapseButton.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),
            collapseButton.trailingAnchor.constraint(equalTo: headerView.trailingAnchor, constant: -8),
            collapseButton.widthAnchor.constraint(equalToConstant: 24),
            collapseButton.heightAnchor.constraint(equalToConstant: 24),

            // Body
            bodyScrollView.topAnchor.constraint(equalTo: headerView.bottomAnchor),
            bodyScrollView.leadingAnchor.constraint(equalTo: leadingAnchor),
            bodyScrollView.trailingAnchor.constraint(equalTo: trailingAnchor),
            bodyScrollView.bottomAnchor.constraint(equalTo: bottomAnchor),

            bodyContentView.topAnchor.constraint(equalTo: bodyScrollView.contentView.topAnchor),
            bodyContentView.leadingAnchor.constraint(equalTo: bodyScrollView.contentView.leadingAnchor),
            bodyContentView.trailingAnchor.constraint(equalTo: bodyScrollView.contentView.trailingAnchor),
        ])

        setAccessibilityRole(.group)
        setAccessibilityLabel("Canvas panel")
        updatePanelState()
    }

    /// The content view inside the scroll body. Add subviews here.
    public var contentView: NSView { return bodyContentView }

    private func updatePanelState() {
        switch panelState {
        case .expanded:
            bodyScrollView.isHidden = false
            widthConstraint?.constant = defaultWidth
            collapseButton.image = NSImage(systemSymbolName: "sidebar.right", accessibilityDescription: "Collapse panel")
            isHidden = false
        case .collapsed:
            bodyScrollView.isHidden = true
            widthConstraint?.constant = 36
            collapseButton.image = NSImage(systemSymbolName: "sidebar.left", accessibilityDescription: "Expand panel")
            isHidden = false
        case .minimized:
            isHidden = true
        }
    }

    @objc private func toggleCollapse(_ sender: Any) {
        if panelState == .expanded {
            panelState = .collapsed
            onCollapse?()
        } else {
            panelState = .expanded
            onExpand?()
        }
    }
}

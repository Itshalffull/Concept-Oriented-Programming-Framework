// ============================================================
// Clef Surface AppKit Widget — Disclosure
//
// Simple show/hide toggle with a disclosure triangle and
// label. Content is revealed or hidden on click.
// ============================================================

import AppKit

public class ClefDisclosureView: NSView {
    public var label: String = "" { didSet { button.title = label } }
    public var isExpanded: Bool = false { didSet { updateState() } }
    public var onToggle: ((Bool) -> Void)?

    private let button = NSButton()
    private var contentView: NSView?

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        button.setButtonType(.pushOnPushOff)
        button.bezelStyle = .disclosure
        button.target = self
        button.action = #selector(handleToggle)
        addSubview(button)
    }

    public func setContent(_ view: NSView) {
        contentView?.removeFromSuperview()
        contentView = view
        addSubview(view)
        updateState()
    }

    @objc private func handleToggle() {
        isExpanded.toggle()
        onToggle?(isExpanded)
    }

    private func updateState() {
        button.state = isExpanded ? .on : .off
        contentView?.isHidden = !isExpanded
    }

    public override func layout() {
        super.layout()
        button.frame = NSRect(x: 0, y: bounds.height - 24, width: bounds.width, height: 24)
        contentView?.frame = NSRect(x: 16, y: 0, width: bounds.width - 16, height: bounds.height - 28)
    }
}

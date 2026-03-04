// ============================================================
// Clef Surface AppKit Widget — Button
//
// Generic action trigger rendered using NSButton. Supports
// filled, outline, text, and danger variants with disabled
// and loading states.
//
// Adapts the button.widget spec: anatomy (root, label, icon,
// spinner), states (idle, hovered, focused, pressed, disabled,
// loading), and connect attributes to AppKit rendering.
// ============================================================

import AppKit

/// Button that renders an action trigger with multiple visual variants
/// and a loading state using NSButton and NSProgressIndicator.
public class ClefButton: NSButton {
    public var variant: String = "filled" { didSet { updateAppearance() } }
    public var size: String = "md" { didSet { updateAppearance() } }
    public var loading: Bool = false { didSet { updateAppearance() } }
    public var onClick: (() -> Void)?

    private let spinner = NSProgressIndicator()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        target = self
        action = #selector(handleClick)
        bezelStyle = .rounded
        spinner.style = .spinning
        spinner.isIndeterminate = true
        spinner.controlSize = .small
        spinner.isHidden = true
        addSubview(spinner)
        updateAppearance()
    }

    @objc private func handleClick() {
        guard !loading else { return }
        onClick?()
    }

    private func updateAppearance() {
        switch variant {
        case "outline":
            bezelStyle = .rounded
            isBordered = true
        case "text":
            bezelStyle = .inline
            isBordered = false
        case "danger":
            bezelStyle = .rounded
            contentTintColor = .systemRed
        default:
            bezelStyle = .rounded
            isBordered = true
        }

        controlSize = size == "sm" ? .small : size == "lg" ? .large : .regular
        isEnabled = !loading && isEnabled

        if loading {
            spinner.isHidden = false
            spinner.startAnimation(nil)
        } else {
            spinner.isHidden = true
            spinner.stopAnimation(nil)
        }
    }
}

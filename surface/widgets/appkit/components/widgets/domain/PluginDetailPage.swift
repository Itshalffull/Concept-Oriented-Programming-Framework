// ============================================================
// Clef Surface AppKit Widget — PluginDetailPage
//
// Full detail page for a plugin/extension with header, readme,
// screenshots, configuration, and install/uninstall actions.
// ============================================================

import AppKit

public class ClefPluginDetailPageView: NSView {
    public var name: String = "" { didSet { needsDisplay = true } }
    public var pluginDescription: String = "" { didSet { needsDisplay = true } }
    public var version: String = "" { didSet { needsDisplay = true } }
    public var author: String = "" { didSet { needsDisplay = true } }
    public var installed: Bool = false { didSet { installButton.title = installed ? "Uninstall" : "Install" } }
    public var onInstallToggle: ((Bool) -> Void)?

    private let installButton = NSButton(title: "Install", target: nil, action: nil)
    private let scrollView = NSScrollView()
    private let contentStack = NSStackView()

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        installButton.target = self; installButton.action = #selector(handleInstall)
        installButton.bezelStyle = .rounded
        contentStack.orientation = .vertical; contentStack.spacing = 12; contentStack.alignment = .leading
        scrollView.documentView = contentStack; scrollView.hasVerticalScroller = true
        addSubview(scrollView); addSubview(installButton)
    }

    @objc private func handleInstall() { installed.toggle(); onInstallToggle?(installed) }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let titleAttrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 20, weight: .bold)]
        (name as NSString).draw(at: NSPoint(x: 16, y: bounds.height - 36), withAttributes: titleAttrs)
        let metaAttrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 12), .foregroundColor: NSColor.secondaryLabelColor]
        ("v\(version) by \(author)" as NSString).draw(at: NSPoint(x: 16, y: bounds.height - 56), withAttributes: metaAttrs)
        let descAttrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 13)]
        (pluginDescription as NSString).draw(at: NSPoint(x: 16, y: bounds.height - 80), withAttributes: descAttrs)
    }

    public override func layout() {
        super.layout()
        installButton.frame = NSRect(x: bounds.width - 100, y: bounds.height - 40, width: 84, height: 28)
        scrollView.frame = NSRect(x: 0, y: 0, width: bounds.width, height: bounds.height - 90)
    }
}

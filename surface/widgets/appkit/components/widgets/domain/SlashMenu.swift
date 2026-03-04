// ============================================================
// Clef Surface AppKit Widget — SlashMenu
//
// Inline command menu triggered by typing "/". Filters
// commands as user types and inserts selected command.
// ============================================================

import AppKit

public class ClefSlashMenuView: NSView {
    public struct Command {
        public let id: String
        public let label: String
        public let icon: String?
        public let action: () -> Void
        public init(id: String, label: String, icon: String? = nil, action: @escaping () -> Void) {
            self.id = id; self.label = label; self.icon = icon; self.action = action
        }
    }

    public var commands: [Command] = []
    public var onDismiss: (() -> Void)?

    private let stackView = NSStackView()
    private var filteredCommands: [Command] = []

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        wantsLayer = true; layer?.cornerRadius = 8; layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
        layer?.shadowColor = NSColor.black.cgColor; layer?.shadowOpacity = 0.15; layer?.shadowRadius = 8
        stackView.orientation = .vertical; stackView.spacing = 2; stackView.alignment = .leading
        addSubview(stackView); isHidden = true
    }

    public func show(filter: String = "") {
        let query = filter.lowercased()
        filteredCommands = query.isEmpty ? commands : commands.filter { $0.label.lowercased().contains(query) }
        stackView.arrangedSubviews.forEach { stackView.removeArrangedSubview($0); $0.removeFromSuperview() }
        for (i, cmd) in filteredCommands.prefix(8).enumerated() {
            let btn = NSButton(title: cmd.label, target: self, action: #selector(selectCommand(_:)))
            btn.tag = i; btn.bezelStyle = .inline; btn.isBordered = false; btn.alignment = .left
            btn.font = NSFont.systemFont(ofSize: 13)
            if let iconName = cmd.icon { btn.image = NSImage(systemSymbolName: iconName, accessibilityDescription: nil) }
            stackView.addArrangedSubview(btn)
        }
        isHidden = filteredCommands.isEmpty
    }

    public func dismiss() { isHidden = true; onDismiss?() }

    @objc private func selectCommand(_ sender: NSButton) {
        guard sender.tag < filteredCommands.count else { return }
        filteredCommands[sender.tag].action(); dismiss()
    }

    public override func layout() { super.layout(); stackView.frame = bounds.insetBy(dx: 8, dy: 8) }
}

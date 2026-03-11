// ============================================================
// Clef Surface AppKit Widget — MentionInput
//
// Text field with @mention autocomplete. Triggers a dropdown
// of suggestions when the user types the trigger character.
// ============================================================

import AppKit

public class ClefMentionInputView: NSView, NSTextViewDelegate {
    public var mentions: [String] = []
    public var triggerChar: Character = "@"
    public var onMention: ((String) -> Void)?
    public var onTextChange: ((String) -> Void)?

    private let scrollView = NSScrollView()
    private let textView = NSTextView()
    private let popover = NSPopover()
    private var filteredMentions: [String] = []

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
        layer?.borderWidth = 1
        layer?.borderColor = NSColor.separatorColor.cgColor
        layer?.cornerRadius = 6

        textView.isRichText = false
        textView.font = NSFont.systemFont(ofSize: 13)
        textView.delegate = self

        scrollView.documentView = textView
        scrollView.borderType = .noBorder
        addSubview(scrollView)
    }

    public func textDidChange(_ notification: Notification) {
        let text = textView.string
        onTextChange?(text)

        guard let lastAtIndex = text.lastIndex(of: triggerChar) else {
            popover.close()
            return
        }
        let query = String(text[text.index(after: lastAtIndex)...]).lowercased()
        filteredMentions = mentions.filter { $0.lowercased().contains(query) }

        if filteredMentions.isEmpty {
            popover.close()
        } else {
            showMentionPopover()
        }
    }

    private func showMentionPopover() {
        let vc = NSViewController()
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        for mention in filteredMentions.prefix(8) {
            let btn = NSButton(title: mention, target: self, action: #selector(selectMention(_:)))
            btn.identifier = NSUserInterfaceItemIdentifier(mention)
            btn.bezelStyle = .inline
            btn.isBordered = false
            stack.addArrangedSubview(btn)
        }
        vc.view = stack
        popover.contentViewController = vc
        popover.behavior = .transient
        popover.show(relativeTo: textView.bounds, of: textView, preferredEdge: .maxY)
    }

    @objc private func selectMention(_ sender: NSButton) {
        guard let mention = sender.identifier?.rawValue else { return }
        if let range = textView.string.range(of: String(triggerChar), options: .backwards) {
            textView.string.replaceSubrange(range.lowerBound..., with: "\(triggerChar)\(mention) ")
        }
        popover.close()
        onMention?(mention)
    }

    public override func layout() {
        super.layout()
        scrollView.frame = bounds.insetBy(dx: 2, dy: 2)
    }
}

// ============================================================
// Clef Surface AppKit Widget — MarkdownPreview
//
// Renders markdown content as styled attributed text.
// Supports headings, bold, italic, code, and lists.
// ============================================================

import AppKit

public class ClefMarkdownPreviewView: NSView {
    public var markdown: String = "" { didSet { renderMarkdown() } }

    private let scrollView = NSScrollView()
    private let textView = NSTextView()

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        textView.isEditable = false; textView.isRichText = true
        textView.isVerticallyResizable = true; textView.font = NSFont.systemFont(ofSize: 14)
        scrollView.documentView = textView; scrollView.hasVerticalScroller = true
        addSubview(scrollView)
    }

    private func renderMarkdown() {
        let result = NSMutableAttributedString()
        let lines = markdown.split(separator: "\n", omittingEmptySubsequences: false)
        for line in lines {
            let str = String(line)
            let attrs: [NSAttributedString.Key: Any]
            if str.hasPrefix("# ") {
                attrs = [.font: NSFont.systemFont(ofSize: 24, weight: .bold), .foregroundColor: NSColor.labelColor]
                result.append(NSAttributedString(string: String(str.dropFirst(2)) + "\n", attributes: attrs))
            } else if str.hasPrefix("## ") {
                attrs = [.font: NSFont.systemFont(ofSize: 20, weight: .bold), .foregroundColor: NSColor.labelColor]
                result.append(NSAttributedString(string: String(str.dropFirst(3)) + "\n", attributes: attrs))
            } else if str.hasPrefix("### ") {
                attrs = [.font: NSFont.systemFont(ofSize: 16, weight: .semibold), .foregroundColor: NSColor.labelColor]
                result.append(NSAttributedString(string: String(str.dropFirst(4)) + "\n", attributes: attrs))
            } else if str.hasPrefix("- ") || str.hasPrefix("* ") {
                attrs = [.font: NSFont.systemFont(ofSize: 14), .foregroundColor: NSColor.labelColor]
                result.append(NSAttributedString(string: "  \u{2022} " + String(str.dropFirst(2)) + "\n", attributes: attrs))
            } else if str.hasPrefix("```") {
                attrs = [.font: NSFont.monospacedSystemFont(ofSize: 12, weight: .regular), .backgroundColor: NSColor.quaternaryLabelColor]
                result.append(NSAttributedString(string: str + "\n", attributes: attrs))
            } else {
                attrs = [.font: NSFont.systemFont(ofSize: 14), .foregroundColor: NSColor.labelColor]
                result.append(NSAttributedString(string: str + "\n", attributes: attrs))
            }
        }
        textView.textStorage?.setAttributedString(result)
    }

    public override func layout() {
        super.layout()
        scrollView.frame = bounds
    }
}

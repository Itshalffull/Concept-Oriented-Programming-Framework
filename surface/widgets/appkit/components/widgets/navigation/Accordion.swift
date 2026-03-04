// ============================================================
// Clef Surface AppKit Widget — Accordion
//
// Collapsible content sections with headers. Supports single
// or multiple expansion modes using disclosure triangles.
// ============================================================

import AppKit

public class ClefAccordionView: NSView {
    public struct Section {
        public let title: String
        public let content: NSView
        public var isExpanded: Bool = false

        public init(title: String, content: NSView, isExpanded: Bool = false) {
            self.title = title
            self.content = content
            self.isExpanded = isExpanded
        }
    }

    public var sections: [Section] = [] { didSet { rebuild() } }
    public var allowMultiple: Bool = false

    private let stackView = NSStackView()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        stackView.orientation = .vertical
        stackView.spacing = 1
        stackView.alignment = .leading
        addSubview(stackView)
    }

    private func rebuild() {
        stackView.arrangedSubviews.forEach { stackView.removeArrangedSubview($0); $0.removeFromSuperview() }
        for (i, section) in sections.enumerated() {
            let header = NSButton(title: section.title, target: self, action: #selector(toggleSection(_:)))
            header.tag = i
            header.bezelStyle = .disclosure
            header.state = section.isExpanded ? .on : .off
            stackView.addArrangedSubview(header)

            section.content.isHidden = !section.isExpanded
            stackView.addArrangedSubview(section.content)
        }
    }

    @objc private func toggleSection(_ sender: NSButton) {
        let index = sender.tag
        guard index < sections.count else { return }

        if !allowMultiple {
            for i in 0..<sections.count where i != index {
                sections[i].isExpanded = false
            }
        }
        sections[index].isExpanded.toggle()
        rebuild()
    }

    public override func layout() {
        super.layout()
        stackView.frame = bounds
    }
}

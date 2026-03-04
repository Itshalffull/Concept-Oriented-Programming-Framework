// ============================================================
// Clef Surface AppKit Widget — FacetedSearch
//
// Search interface with filter facets sidebar. Combines a
// search field, facet checkboxes, and results list.
// ============================================================

import AppKit

public class ClefFacetedSearchView: NSView, NSTextFieldDelegate {
    public struct Facet {
        public let name: String
        public var options: [(label: String, count: Int, selected: Bool)]
        public init(name: String, options: [(label: String, count: Int, selected: Bool)]) {
            self.name = name; self.options = options
        }
    }

    public var facets: [Facet] = [] { didSet { rebuildFacets() } }
    public var onSearch: ((String) -> Void)?
    public var onFacetChange: ((String, String, Bool) -> Void)?

    private let searchField = NSSearchField()
    private let facetStack = NSStackView()
    private let resultsView = NSView()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        searchField.placeholderString = "Search..."
        searchField.delegate = self
        addSubview(searchField)

        facetStack.orientation = .vertical
        facetStack.spacing = 12
        facetStack.alignment = .leading
        addSubview(facetStack)
        addSubview(resultsView)
    }

    private func rebuildFacets() {
        facetStack.arrangedSubviews.forEach { facetStack.removeArrangedSubview($0); $0.removeFromSuperview() }
        for facet in facets {
            let header = NSTextField(labelWithString: facet.name)
            header.font = NSFont.systemFont(ofSize: 12, weight: .semibold)
            facetStack.addArrangedSubview(header)
            for opt in facet.options {
                let cb = NSButton(checkboxWithTitle: "\(opt.label) (\(opt.count))", target: self, action: #selector(facetToggled(_:)))
                cb.state = opt.selected ? .on : .off
                cb.identifier = NSUserInterfaceItemIdentifier("\(facet.name)::\(opt.label)")
                facetStack.addArrangedSubview(cb)
            }
        }
    }

    @objc private func facetToggled(_ sender: NSButton) {
        guard let id = sender.identifier?.rawValue else { return }
        let parts = id.split(separator: "::")
        guard parts.count == 2 else { return }
        onFacetChange?(String(parts[0]), String(parts[1]), sender.state == .on)
    }

    public func controlTextDidChange(_ obj: Notification) { onSearch?(searchField.stringValue) }

    public func setResults(_ view: NSView) {
        resultsView.subviews.forEach { $0.removeFromSuperview() }
        resultsView.addSubview(view)
        view.frame = resultsView.bounds
    }

    public override func layout() {
        super.layout()
        searchField.frame = NSRect(x: 0, y: bounds.height - 32, width: bounds.width, height: 28)
        facetStack.frame = NSRect(x: 0, y: 0, width: 200, height: bounds.height - 40)
        resultsView.frame = NSRect(x: 210, y: 0, width: bounds.width - 210, height: bounds.height - 40)
    }
}

// ============================================================
// Clef Surface AppKit Widget — ComboboxMulti
//
// Multi-selection combobox that displays selected items as
// chips and filters the dropdown as the user types.
// ============================================================

import AppKit

public class ClefComboboxMultiView: NSView, NSTextFieldDelegate {
    public var options: [String] = []
    public var selectedValues: [String] = [] { didSet { rebuild() } }
    public var placeholder: String = "Search..." { didSet { searchField.placeholderString = placeholder } }
    public var onSelectionChange: (([String]) -> Void)?

    private let stackView = NSStackView()
    private let searchField = NSTextField()
    private let popover = NSPopover()

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

        stackView.orientation = .horizontal
        stackView.spacing = 4
        addSubview(stackView)

        searchField.isBezeled = false
        searchField.drawsBackground = false
        searchField.placeholderString = placeholder
        searchField.delegate = self
        stackView.addArrangedSubview(searchField)
    }

    private func rebuild() {
        stackView.arrangedSubviews.filter { $0 !== searchField }.forEach {
            stackView.removeArrangedSubview($0)
            $0.removeFromSuperview()
        }
        for val in selectedValues {
            let chip = NSButton(title: "\(val) x", target: self, action: #selector(removeValue(_:)))
            chip.identifier = NSUserInterfaceItemIdentifier(val)
            chip.bezelStyle = .inline
            chip.font = NSFont.systemFont(ofSize: 11)
            stackView.insertArrangedSubview(chip, at: stackView.arrangedSubviews.count - 1)
        }
    }

    @objc private func removeValue(_ sender: NSButton) {
        guard let val = sender.identifier?.rawValue else { return }
        selectedValues.removeAll { $0 == val }
        onSelectionChange?(selectedValues)
    }

    public func controlTextDidChange(_ obj: Notification) {
        // Filter and show dropdown popover with matching options
        let query = searchField.stringValue.lowercased()
        let filtered = options.filter { !selectedValues.contains($0) && $0.lowercased().contains(query) }
        showDropdown(filtered)
    }

    private func showDropdown(_ items: [String]) {
        guard !items.isEmpty else { popover.close(); return }
        let vc = NSViewController()
        let list = NSStackView()
        list.orientation = .vertical
        list.alignment = .leading
        for item in items.prefix(10) {
            let btn = NSButton(title: item, target: self, action: #selector(selectItem(_:)))
            btn.identifier = NSUserInterfaceItemIdentifier(item)
            btn.bezelStyle = .inline
            btn.isBordered = false
            list.addArrangedSubview(btn)
        }
        vc.view = list
        popover.contentViewController = vc
        popover.behavior = .transient
        popover.show(relativeTo: searchField.bounds, of: searchField, preferredEdge: .maxY)
    }

    @objc private func selectItem(_ sender: NSButton) {
        guard let val = sender.identifier?.rawValue else { return }
        selectedValues.append(val)
        searchField.stringValue = ""
        popover.close()
        onSelectionChange?(selectedValues)
    }

    public override func layout() {
        super.layout()
        stackView.frame = bounds.insetBy(dx: 4, dy: 4)
    }
}

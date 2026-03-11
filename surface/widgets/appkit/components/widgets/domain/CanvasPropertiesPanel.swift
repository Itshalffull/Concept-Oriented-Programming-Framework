// ============================================================
// Clef Surface AppKit Widget — CanvasPropertiesPanel
//
// Right sidebar panel showing properties of the selected canvas
// element. Switches between item properties, connector properties,
// and canvas-level properties based on selection type.
// ============================================================

import AppKit

public enum ClefSelectionType: String {
    case none = "none"
    case item = "item"
    case connector = "connector"
    case canvas = "canvas"
}

public class ClefCanvasPropertiesPanelView: NSView {
    public var canvasId: String = ""
    public var selectedItemId: String? = nil
    public var selectedConnectorId: String? = nil
    public var selectionType: ClefSelectionType = .none { didSet { updateVisibility() } }
    public var onPropertyChange: ((String, Any) -> Void)?

    private let tabView = NSTabView()
    private let emptyStateLabel = NSTextField(labelWithString: "Nothing selected")

    // Item properties
    private let itemXField = NSTextField()
    private let itemYField = NSTextField()
    private let itemWidthField = NSTextField()
    private let itemHeightField = NSTextField()
    private let itemTypeField = NSTextField()

    // Connector properties
    private let connectorStylePopUp = NSPopUpButton(frame: .zero, pullsDown: false)
    private let connectorLabelField = NSTextField()
    private let connectorKindField = NSTextField()

    // Canvas properties
    private let canvasNameField = NSTextField()
    private let canvasBackgroundWell = NSColorWell()
    private let gridSwitch = NSSwitch()

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        wantsLayer = true
        layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor

        // Empty state
        emptyStateLabel.alignment = .center
        emptyStateLabel.textColor = .secondaryLabelColor
        emptyStateLabel.font = NSFont.systemFont(ofSize: 13)
        emptyStateLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(emptyStateLabel)

        // Tab view with three tabs
        tabView.tabViewType = .topTabsBezelBorder
        tabView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(tabView)

        let itemTab = NSTabViewItem(identifier: "item")
        itemTab.label = "Item"
        itemTab.view = buildItemPropertiesForm()
        tabView.addTabViewItem(itemTab)

        let connectorTab = NSTabViewItem(identifier: "connector")
        connectorTab.label = "Connector"
        connectorTab.view = buildConnectorPropertiesForm()
        tabView.addTabViewItem(connectorTab)

        let canvasTab = NSTabViewItem(identifier: "canvas")
        canvasTab.label = "Canvas"
        canvasTab.view = buildCanvasPropertiesForm()
        tabView.addTabViewItem(canvasTab)

        NSLayoutConstraint.activate([
            emptyStateLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            emptyStateLabel.centerYAnchor.constraint(equalTo: centerYAnchor),

            tabView.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            tabView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            tabView.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            tabView.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
        ])

        setAccessibilityRole(.group)
        setAccessibilityLabel("Properties panel")
        updateVisibility()
    }

    private func updateVisibility() {
        switch selectionType {
        case .none:
            tabView.isHidden = true
            emptyStateLabel.isHidden = false
        case .item:
            tabView.isHidden = false
            emptyStateLabel.isHidden = true
            tabView.selectTabViewItem(at: 0)
        case .connector:
            tabView.isHidden = false
            emptyStateLabel.isHidden = true
            tabView.selectTabViewItem(at: 1)
        case .canvas:
            tabView.isHidden = false
            emptyStateLabel.isHidden = true
            tabView.selectTabViewItem(at: 2)
        }
    }

    // MARK: — Item Properties Form

    private func buildItemPropertiesForm() -> NSView {
        let container = NSView()
        container.setAccessibilityRole(.group)
        container.setAccessibilityLabel("Item properties")

        var yOffset: CGFloat = 160
        func addRow(label: String, field: NSTextField) {
            let lbl = NSTextField(labelWithString: label)
            lbl.font = NSFont.systemFont(ofSize: 11, weight: .medium)
            lbl.frame = NSRect(x: 8, y: yOffset, width: 60, height: 18)
            container.addSubview(lbl)
            field.frame = NSRect(x: 72, y: yOffset - 2, width: 140, height: 22)
            field.isEditable = true
            field.isBordered = true
            field.bezelStyle = .roundedBezel
            field.font = NSFont.systemFont(ofSize: 11)
            field.target = self
            field.action = #selector(itemFieldChanged(_:))
            container.addSubview(field)
            yOffset -= 30
        }

        addRow(label: "X:", field: itemXField)
        addRow(label: "Y:", field: itemYField)
        addRow(label: "Width:", field: itemWidthField)
        addRow(label: "Height:", field: itemHeightField)

        let typeLbl = NSTextField(labelWithString: "Type:")
        typeLbl.font = NSFont.systemFont(ofSize: 11, weight: .medium)
        typeLbl.frame = NSRect(x: 8, y: yOffset, width: 60, height: 18)
        container.addSubview(typeLbl)
        itemTypeField.frame = NSRect(x: 72, y: yOffset - 2, width: 140, height: 22)
        itemTypeField.isEditable = false
        itemTypeField.isBordered = false
        itemTypeField.drawsBackground = false
        itemTypeField.font = NSFont.systemFont(ofSize: 11)
        container.addSubview(itemTypeField)

        return container
    }

    // MARK: — Connector Properties Form

    private func buildConnectorPropertiesForm() -> NSView {
        let container = NSView()
        container.setAccessibilityRole(.group)
        container.setAccessibilityLabel("Connector properties")

        let styleLbl = NSTextField(labelWithString: "Style:")
        styleLbl.font = NSFont.systemFont(ofSize: 11, weight: .medium)
        styleLbl.frame = NSRect(x: 8, y: 160, width: 60, height: 18)
        container.addSubview(styleLbl)

        connectorStylePopUp.frame = NSRect(x: 72, y: 156, width: 140, height: 26)
        connectorStylePopUp.addItems(withTitles: ["Bezier", "Straight", "Orthogonal", "Step"])
        connectorStylePopUp.target = self
        connectorStylePopUp.action = #selector(connectorFieldChanged(_:))
        container.addSubview(connectorStylePopUp)

        let labelLbl = NSTextField(labelWithString: "Label:")
        labelLbl.font = NSFont.systemFont(ofSize: 11, weight: .medium)
        labelLbl.frame = NSRect(x: 8, y: 126, width: 60, height: 18)
        container.addSubview(labelLbl)

        connectorLabelField.frame = NSRect(x: 72, y: 122, width: 140, height: 22)
        connectorLabelField.isEditable = true
        connectorLabelField.isBordered = true
        connectorLabelField.bezelStyle = .roundedBezel
        connectorLabelField.font = NSFont.systemFont(ofSize: 11)
        connectorLabelField.target = self
        connectorLabelField.action = #selector(connectorFieldChanged(_:))
        container.addSubview(connectorLabelField)

        let kindLbl = NSTextField(labelWithString: "Kind:")
        kindLbl.font = NSFont.systemFont(ofSize: 11, weight: .medium)
        kindLbl.frame = NSRect(x: 8, y: 92, width: 60, height: 18)
        container.addSubview(kindLbl)

        connectorKindField.frame = NSRect(x: 72, y: 88, width: 140, height: 22)
        connectorKindField.isEditable = false
        connectorKindField.isBordered = false
        connectorKindField.drawsBackground = false
        connectorKindField.font = NSFont.systemFont(ofSize: 11)
        container.addSubview(connectorKindField)

        return container
    }

    // MARK: — Canvas Properties Form

    private func buildCanvasPropertiesForm() -> NSView {
        let container = NSView()
        container.setAccessibilityRole(.group)
        container.setAccessibilityLabel("Canvas properties")

        let nameLbl = NSTextField(labelWithString: "Name:")
        nameLbl.font = NSFont.systemFont(ofSize: 11, weight: .medium)
        nameLbl.frame = NSRect(x: 8, y: 160, width: 70, height: 18)
        container.addSubview(nameLbl)

        canvasNameField.frame = NSRect(x: 82, y: 156, width: 140, height: 22)
        canvasNameField.isEditable = true
        canvasNameField.isBordered = true
        canvasNameField.bezelStyle = .roundedBezel
        canvasNameField.font = NSFont.systemFont(ofSize: 11)
        canvasNameField.target = self
        canvasNameField.action = #selector(canvasFieldChanged(_:))
        container.addSubview(canvasNameField)

        let bgLbl = NSTextField(labelWithString: "Background:")
        bgLbl.font = NSFont.systemFont(ofSize: 11, weight: .medium)
        bgLbl.frame = NSRect(x: 8, y: 126, width: 70, height: 18)
        container.addSubview(bgLbl)

        canvasBackgroundWell.frame = NSRect(x: 82, y: 122, width: 44, height: 24)
        canvasBackgroundWell.color = .white
        canvasBackgroundWell.target = self
        canvasBackgroundWell.action = #selector(canvasFieldChanged(_:))
        container.addSubview(canvasBackgroundWell)

        let gridLbl = NSTextField(labelWithString: "Show Grid:")
        gridLbl.font = NSFont.systemFont(ofSize: 11, weight: .medium)
        gridLbl.frame = NSRect(x: 8, y: 92, width: 70, height: 18)
        container.addSubview(gridLbl)

        gridSwitch.frame = NSRect(x: 82, y: 88, width: 40, height: 24)
        gridSwitch.state = .on
        gridSwitch.target = self
        gridSwitch.action = #selector(canvasFieldChanged(_:))
        container.addSubview(gridSwitch)

        return container
    }

    // MARK: — Property change handlers

    public func loadItemProperties(x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat, type: String) {
        itemXField.doubleValue = Double(x)
        itemYField.doubleValue = Double(y)
        itemWidthField.doubleValue = Double(width)
        itemHeightField.doubleValue = Double(height)
        itemTypeField.stringValue = type
    }

    public func loadConnectorProperties(style: String, label: String, kind: String) {
        if let idx = connectorStylePopUp.itemTitles.firstIndex(of: style) {
            connectorStylePopUp.selectItem(at: idx)
        }
        connectorLabelField.stringValue = label
        connectorKindField.stringValue = kind
    }

    public func loadCanvasProperties(name: String, background: NSColor, showGrid: Bool) {
        canvasNameField.stringValue = name
        canvasBackgroundWell.color = background
        gridSwitch.state = showGrid ? .on : .off
    }

    @objc private func itemFieldChanged(_ sender: Any) {
        onPropertyChange?("x", itemXField.doubleValue)
        onPropertyChange?("y", itemYField.doubleValue)
        onPropertyChange?("width", itemWidthField.doubleValue)
        onPropertyChange?("height", itemHeightField.doubleValue)
    }

    @objc private func connectorFieldChanged(_ sender: Any) {
        onPropertyChange?("style", connectorStylePopUp.titleOfSelectedItem ?? "")
        onPropertyChange?("label", connectorLabelField.stringValue)
    }

    @objc private func canvasFieldChanged(_ sender: Any) {
        onPropertyChange?("name", canvasNameField.stringValue)
        onPropertyChange?("background", canvasBackgroundWell.color)
        onPropertyChange?("showGrid", gridSwitch.state == .on)
    }
}

// ============================================================
// Clef Surface AppKit Widget — LayoutControlPanel
//
// Control panel for selecting and applying layout algorithms
// to a canvas. Provides algorithm selector, direction options,
// spacing controls, and apply button.
// ============================================================

import AppKit

public struct ClefLayoutAlgorithm {
    public let name: String
    public let label: String

    public init(name: String, label: String) {
        self.name = name; self.label = label
    }
}

public class ClefLayoutControlPanelView: NSView {
    public var algorithms: [ClefLayoutAlgorithm] = [] { didSet { rebuildAlgorithmMenu() } }
    public var selectedAlgorithm: String? { didSet { updateApplyState() } }
    public var direction: String = "top-to-bottom" { didSet { syncDirectionControl() } }
    public var spacingX: CGFloat = 80 { didSet { spacingSlider.doubleValue = Double(spacingX) } }
    public var spacingY: CGFloat = 100
    public var canvasId: String = ""
    public var onApply: ((String, String, CGFloat, CGFloat) -> Void)?

    private let algorithmPopUp = NSPopUpButton(frame: .zero, pullsDown: false)
    private let directionControl = NSSegmentedControl()
    private let spacingSlider = NSSlider()
    private let spacingLabel = NSTextField(labelWithString: "Spacing: 80")
    private let applyButton = NSButton(title: "Apply Layout", target: nil, action: nil)

    private static let directions = ["top-to-bottom", "left-to-right", "bottom-to-top", "right-to-left"]
    private static let directionLabels = ["TB", "LR", "BT", "RL"]

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        wantsLayer = true
        layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor

        // Algorithm selector
        let algoLabel = NSTextField(labelWithString: "Algorithm:")
        algoLabel.font = NSFont.systemFont(ofSize: 11, weight: .medium)
        algoLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(algoLabel)

        algorithmPopUp.target = self
        algorithmPopUp.action = #selector(algorithmChanged(_:))
        algorithmPopUp.translatesAutoresizingMaskIntoConstraints = false
        addSubview(algorithmPopUp)

        // Direction selector
        let dirLabel = NSTextField(labelWithString: "Direction:")
        dirLabel.font = NSFont.systemFont(ofSize: 11, weight: .medium)
        dirLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(dirLabel)

        directionControl.segmentCount = Self.directionLabels.count
        for (i, label) in Self.directionLabels.enumerated() {
            directionControl.setLabel(label, forSegment: i)
            directionControl.setWidth(36, forSegment: i)
        }
        directionControl.selectedSegment = 0
        directionControl.target = self
        directionControl.action = #selector(directionChanged(_:))
        directionControl.translatesAutoresizingMaskIntoConstraints = false
        addSubview(directionControl)

        // Spacing slider
        spacingLabel.font = NSFont.systemFont(ofSize: 11)
        spacingLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(spacingLabel)

        spacingSlider.minValue = 20
        spacingSlider.maxValue = 200
        spacingSlider.doubleValue = Double(spacingX)
        spacingSlider.isContinuous = true
        spacingSlider.target = self
        spacingSlider.action = #selector(spacingChanged(_:))
        spacingSlider.translatesAutoresizingMaskIntoConstraints = false
        addSubview(spacingSlider)

        // Apply button
        applyButton.bezelStyle = .rounded
        applyButton.target = self
        applyButton.action = #selector(applyTapped(_:))
        applyButton.isEnabled = false
        applyButton.translatesAutoresizingMaskIntoConstraints = false
        addSubview(applyButton)

        NSLayoutConstraint.activate([
            algoLabel.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            algoLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),

            algorithmPopUp.topAnchor.constraint(equalTo: algoLabel.bottomAnchor, constant: 4),
            algorithmPopUp.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            algorithmPopUp.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),

            dirLabel.topAnchor.constraint(equalTo: algorithmPopUp.bottomAnchor, constant: 12),
            dirLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),

            directionControl.topAnchor.constraint(equalTo: dirLabel.bottomAnchor, constant: 4),
            directionControl.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),

            spacingLabel.topAnchor.constraint(equalTo: directionControl.bottomAnchor, constant: 12),
            spacingLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),

            spacingSlider.topAnchor.constraint(equalTo: spacingLabel.bottomAnchor, constant: 4),
            spacingSlider.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            spacingSlider.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),

            applyButton.topAnchor.constraint(equalTo: spacingSlider.bottomAnchor, constant: 16),
            applyButton.centerXAnchor.constraint(equalTo: centerXAnchor),
        ])

        setAccessibilityRole(.group)
        setAccessibilityLabel("Layout controls")
    }

    private func rebuildAlgorithmMenu() {
        algorithmPopUp.removeAllItems()
        for algo in algorithms { algorithmPopUp.addItem(withTitle: algo.label) }
        if let sel = selectedAlgorithm, let idx = algorithms.firstIndex(where: { $0.name == sel }) {
            algorithmPopUp.selectItem(at: idx)
        }
    }

    private func syncDirectionControl() {
        if let idx = Self.directions.firstIndex(of: direction) {
            directionControl.selectedSegment = idx
        }
    }

    private func updateApplyState() {
        applyButton.isEnabled = selectedAlgorithm != nil
    }

    @objc private func algorithmChanged(_ sender: NSPopUpButton) {
        let idx = sender.indexOfSelectedItem
        guard idx >= 0, idx < algorithms.count else { return }
        selectedAlgorithm = algorithms[idx].name
    }

    @objc private func directionChanged(_ sender: NSSegmentedControl) {
        let idx = sender.selectedSegment
        guard idx >= 0, idx < Self.directions.count else { return }
        direction = Self.directions[idx]
    }

    @objc private func spacingChanged(_ sender: NSSlider) {
        spacingX = CGFloat(sender.doubleValue)
        spacingLabel.stringValue = "Spacing: \(Int(spacingX))"
    }

    @objc private func applyTapped(_ sender: NSButton) {
        guard let algo = selectedAlgorithm else { return }
        applyButton.isEnabled = false
        onApply?(algo, direction, spacingX, spacingY)
    }
}

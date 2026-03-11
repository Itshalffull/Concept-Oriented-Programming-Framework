// ============================================================
// Clef Surface AppKit Widget — ViewToggle
//
// Toggle between different view modes (grid, list, table).
// Renders as a segmented control with icon options.
// ============================================================

import AppKit

public class ClefViewToggleView: NSView {
    public var modes: [String] = ["list", "grid"] { didSet { rebuild() } }
    public var selectedMode: String = "list" { didSet { syncSelection() } }
    public var onModeChange: ((String) -> Void)?

    private let segmented = NSSegmentedControl()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        segmented.segmentStyle = .separated
        segmented.target = self
        segmented.action = #selector(handleChange)
        addSubview(segmented)
        rebuild()
    }

    private func rebuild() {
        segmented.segmentCount = modes.count
        let iconMap = ["list": "list.bullet", "grid": "square.grid.2x2", "table": "tablecells"]
        for (i, mode) in modes.enumerated() {
            let iconName = iconMap[mode] ?? "square"
            segmented.setImage(NSImage(systemSymbolName: iconName, accessibilityDescription: mode), forSegment: i)
            segmented.setWidth(32, forSegment: i)
        }
        syncSelection()
    }

    private func syncSelection() {
        if let idx = modes.firstIndex(of: selectedMode) {
            segmented.selectedSegment = idx
        }
    }

    @objc private func handleChange() {
        let idx = segmented.selectedSegment
        guard idx >= 0 && idx < modes.count else { return }
        selectedMode = modes[idx]
        onModeChange?(selectedMode)
    }

    public override func layout() {
        super.layout()
        segmented.frame = bounds
    }
}

// ============================================================
// Clef Surface AppKit Widget — CronEditor
//
// Visual cron expression editor with dropdowns for minute,
// hour, day, month, and weekday fields.
// ============================================================

import AppKit

public class ClefCronEditorView: NSView {
    public var expression: String = "* * * * *" { didSet { parseCron() } }
    public var onExpressionChange: ((String) -> Void)?

    private let minutePop = NSPopUpButton()
    private let hourPop = NSPopUpButton()
    private let dayPop = NSPopUpButton()
    private let monthPop = NSPopUpButton()
    private let weekdayPop = NSPopUpButton()
    private let previewLabel = NSTextField(labelWithString: "")

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        let pops = [("Minute", minutePop), ("Hour", hourPop), ("Day", dayPop), ("Month", monthPop), ("Weekday", weekdayPop)]
        var x: CGFloat = 0
        for (label, pop) in pops {
            let lbl = NSTextField(labelWithString: label)
            lbl.font = NSFont.systemFont(ofSize: 10); lbl.frame = NSRect(x: x, y: 28, width: 60, height: 14)
            addSubview(lbl)
            pop.addItem(withTitle: "*")
            for i in 0..<60 { pop.addItem(withTitle: "\(i)") }
            pop.frame = NSRect(x: x, y: 0, width: 70, height: 24)
            pop.target = self; pop.action = #selector(handleChange)
            addSubview(pop)
            x += 76
        }
        previewLabel.font = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
        previewLabel.frame = NSRect(x: 0, y: 48, width: 300, height: 20)
        addSubview(previewLabel)
        parseCron()
    }

    private func parseCron() {
        previewLabel.stringValue = expression
    }

    @objc private func handleChange() {
        let parts = [minutePop, hourPop, dayPop, monthPop, weekdayPop].map { $0.titleOfSelectedItem ?? "*" }
        expression = parts.joined(separator: " ")
        onExpressionChange?(expression)
    }
}

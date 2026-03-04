// ============================================================
// Clef Surface AppKit Widget — PreferenceMatrix
//
// Grid of preference options organized by category and type.
// Each cell contains a control appropriate to the setting.
// ============================================================

import AppKit

public class ClefPreferenceMatrixView: NSView {
    public struct Preference {
        public let category: String
        public let label: String
        public let type: String // "toggle", "select", "text"
        public var value: Any
        public init(category: String, label: String, type: String, value: Any) {
            self.category = category; self.label = label; self.type = type; self.value = value
        }
    }

    public var preferences: [Preference] = [] { didSet { rebuild() } }
    public var onPreferenceChange: ((String, Any) -> Void)?

    private let scrollView = NSScrollView()
    private let stackView = NSStackView()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        stackView.orientation = .vertical
        stackView.spacing = 16
        stackView.alignment = .leading
        scrollView.documentView = stackView
        scrollView.hasVerticalScroller = true
        scrollView.drawsBackground = false
        addSubview(scrollView)
    }

    private func rebuild() {
        stackView.arrangedSubviews.forEach { stackView.removeArrangedSubview($0); $0.removeFromSuperview() }
        var grouped: [String: [Preference]] = [:]
        for pref in preferences { grouped[pref.category, default: []].append(pref) }

        for (category, prefs) in grouped.sorted(by: { $0.key < $1.key }) {
            let header = NSTextField(labelWithString: category)
            header.font = NSFont.systemFont(ofSize: 13, weight: .semibold)
            stackView.addArrangedSubview(header)

            for pref in prefs {
                let row = NSStackView()
                row.orientation = .horizontal
                row.spacing = 8
                let lbl = NSTextField(labelWithString: pref.label)
                lbl.font = NSFont.systemFont(ofSize: 12)
                lbl.setContentHuggingPriority(.defaultHigh, for: .horizontal)
                row.addArrangedSubview(lbl)

                switch pref.type {
                case "toggle":
                    let sw = NSSwitch()
                    sw.state = (pref.value as? Bool) == true ? .on : .off
                    row.addArrangedSubview(sw)
                case "select":
                    let pop = NSPopUpButton()
                    if let opts = pref.value as? [String] { pop.addItems(withTitles: opts) }
                    row.addArrangedSubview(pop)
                default:
                    let tf = NSTextField()
                    tf.stringValue = "\(pref.value)"
                    row.addArrangedSubview(tf)
                }
                stackView.addArrangedSubview(row)
            }
        }
    }

    public override func layout() {
        super.layout()
        scrollView.frame = bounds
    }
}

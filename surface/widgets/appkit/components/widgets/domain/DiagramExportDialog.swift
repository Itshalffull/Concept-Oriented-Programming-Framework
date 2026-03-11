// ============================================================
// Clef Surface AppKit Widget — DiagramExportDialog
//
// Modal dialog for exporting a canvas diagram. Provides format
// selection, size options, background toggle, data embedding
// toggle, and export/cancel actions.
// ============================================================

import AppKit

public struct ClefExportFormat {
    public let name: String
    public let label: String
    public let mimeType: String

    public init(name: String, label: String, mimeType: String) {
        self.name = name; self.label = label; self.mimeType = mimeType
    }
}

public class ClefDiagramExportDialog: NSPanel {
    public var canvasId: String = ""
    public var formats: [ClefExportFormat] = [] { didSet { rebuildFormatMenu() } }
    public var selectedFormat: String? { didSet { updateExportState() } }
    public var exportWidth: Int = 1920 { didSet { widthField.integerValue = exportWidth } }
    public var exportHeight: Int = 1080 { didSet { heightField.integerValue = exportHeight } }
    public var includeBackground: Bool = true { didSet { backgroundSwitch.state = includeBackground ? .on : .off } }
    public var embedData: Bool = false { didSet { embedSwitch.state = embedData ? .on : .off } }
    public var onExport: ((String, Int, Int, Bool, Bool) -> Void)?
    public var onCancel: (() -> Void)?

    private let formatPopUp = NSPopUpButton(frame: .zero, pullsDown: false)
    private let widthField = NSTextField()
    private let heightField = NSTextField()
    private let backgroundSwitch = NSSwitch()
    private let embedSwitch = NSSwitch()
    private let exportButton = NSButton(title: "Export", target: nil, action: nil)
    private let cancelButton = NSButton(title: "Cancel", target: nil, action: nil)

    public init() {
        super.init(contentRect: NSRect(x: 0, y: 0, width: 340, height: 320),
                   styleMask: [.titled, .closable], backing: .buffered, defer: true)
        title = "Export Diagram"
        isFloatingPanel = true
        becomesKeyOnlyIfNeeded = false
        setupContent()
    }

    private func setupContent() {
        let contentView = NSView(frame: NSRect(x: 0, y: 0, width: 340, height: 320))
        self.contentView = contentView

        // Format selector
        let formatLabel = NSTextField(labelWithString: "Format:")
        formatLabel.font = NSFont.systemFont(ofSize: 11, weight: .medium)
        formatLabel.frame = NSRect(x: 20, y: 274, width: 80, height: 18)
        contentView.addSubview(formatLabel)

        formatPopUp.frame = NSRect(x: 100, y: 270, width: 220, height: 26)
        formatPopUp.target = self
        formatPopUp.action = #selector(formatChanged(_:))
        contentView.addSubview(formatPopUp)

        // Width
        let widthLabel = NSTextField(labelWithString: "Width:")
        widthLabel.font = NSFont.systemFont(ofSize: 11, weight: .medium)
        widthLabel.frame = NSRect(x: 20, y: 238, width: 80, height: 18)
        contentView.addSubview(widthLabel)

        widthField.frame = NSRect(x: 100, y: 234, width: 100, height: 24)
        widthField.integerValue = exportWidth
        widthField.formatter = NumberFormatter()
        contentView.addSubview(widthField)

        // Height
        let heightLabel = NSTextField(labelWithString: "Height:")
        heightLabel.font = NSFont.systemFont(ofSize: 11, weight: .medium)
        heightLabel.frame = NSRect(x: 20, y: 202, width: 80, height: 18)
        contentView.addSubview(heightLabel)

        heightField.frame = NSRect(x: 100, y: 198, width: 100, height: 24)
        heightField.integerValue = exportHeight
        heightField.formatter = NumberFormatter()
        contentView.addSubview(heightField)

        // Include background toggle
        let bgLabel = NSTextField(labelWithString: "Background:")
        bgLabel.font = NSFont.systemFont(ofSize: 11, weight: .medium)
        bgLabel.frame = NSRect(x: 20, y: 166, width: 80, height: 18)
        contentView.addSubview(bgLabel)

        backgroundSwitch.frame = NSRect(x: 100, y: 162, width: 40, height: 24)
        backgroundSwitch.state = includeBackground ? .on : .off
        backgroundSwitch.target = self
        backgroundSwitch.action = #selector(backgroundToggled(_:))
        contentView.addSubview(backgroundSwitch)

        // Embed data toggle
        let embedLabel = NSTextField(labelWithString: "Embed data:")
        embedLabel.font = NSFont.systemFont(ofSize: 11, weight: .medium)
        embedLabel.frame = NSRect(x: 20, y: 130, width: 80, height: 18)
        contentView.addSubview(embedLabel)

        embedSwitch.frame = NSRect(x: 100, y: 126, width: 40, height: 24)
        embedSwitch.state = embedData ? .on : .off
        embedSwitch.target = self
        embedSwitch.action = #selector(embedToggled(_:))
        contentView.addSubview(embedSwitch)

        // Buttons
        exportButton.bezelStyle = .rounded
        exportButton.keyEquivalent = "\r"
        exportButton.frame = NSRect(x: 220, y: 20, width: 100, height: 32)
        exportButton.target = self
        exportButton.action = #selector(exportTapped(_:))
        exportButton.isEnabled = false
        contentView.addSubview(exportButton)

        cancelButton.bezelStyle = .rounded
        cancelButton.keyEquivalent = "\u{1b}"
        cancelButton.frame = NSRect(x: 110, y: 20, width: 100, height: 32)
        cancelButton.target = self
        cancelButton.action = #selector(cancelTapped(_:))
        contentView.addSubview(cancelButton)

        setAccessibilityLabel("Export diagram")
        setAccessibilityRole(.dialog)
    }

    private func rebuildFormatMenu() {
        formatPopUp.removeAllItems()
        for fmt in formats { formatPopUp.addItem(withTitle: fmt.label) }
        if let sel = selectedFormat, let idx = formats.firstIndex(where: { $0.name == sel }) {
            formatPopUp.selectItem(at: idx)
        }
        updateExportState()
    }

    private func updateExportState() {
        exportButton.isEnabled = selectedFormat != nil
    }

    @objc private func formatChanged(_ sender: NSPopUpButton) {
        let idx = sender.indexOfSelectedItem
        guard idx >= 0, idx < formats.count else { return }
        selectedFormat = formats[idx].name
    }

    @objc private func backgroundToggled(_ sender: NSSwitch) {
        includeBackground = sender.state == .on
    }

    @objc private func embedToggled(_ sender: NSSwitch) {
        embedData = sender.state == .on
    }

    @objc private func exportTapped(_ sender: NSButton) {
        guard let fmt = selectedFormat else { return }
        exportButton.isEnabled = false
        exportWidth = widthField.integerValue
        exportHeight = heightField.integerValue
        onExport?(fmt, exportWidth, exportHeight, includeBackground, embedData)
    }

    @objc private func cancelTapped(_ sender: NSButton) {
        onCancel?()
        close()
    }

    public func showModal(relativeTo window: NSWindow) {
        center()
        window.beginSheet(self, completionHandler: nil)
    }
}

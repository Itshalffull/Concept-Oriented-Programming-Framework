// ============================================================
// Clef Surface AppKit Widget — FileUpload
//
// File selection area with drag-and-drop support and
// NSOpenPanel integration. Shows selected file names.
// ============================================================

import AppKit

public class ClefFileUploadView: NSView {
    public var allowedTypes: [String] = []
    public var multiple: Bool = false
    public var selectedFiles: [URL] = [] { didSet { needsDisplay = true } }
    public var onFilesSelected: (([URL]) -> Void)?

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
        layer?.cornerRadius = 8
        layer?.borderWidth = 2
        layer?.borderColor = NSColor.separatorColor.cgColor
        layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor

        registerForDraggedTypes([.fileURL])

        let click = NSClickGestureRecognizer(target: self, action: #selector(openPanel))
        addGestureRecognizer(click)
    }

    @objc private func openPanel() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = multiple
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        if !allowedTypes.isEmpty { panel.allowedContentTypes = [] }
        panel.begin { [weak self] response in
            if response == .OK {
                self?.selectedFiles = panel.urls
                self?.onFilesSelected?(panel.urls)
            }
        }
    }

    public override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        layer?.borderColor = NSColor.controlAccentColor.cgColor
        return .copy
    }

    public override func draggingExited(_ sender: NSDraggingInfo?) {
        layer?.borderColor = NSColor.separatorColor.cgColor
    }

    public override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        guard let urls = sender.draggingPasteboard.readObjects(forClasses: [NSURL.self]) as? [URL] else { return false }
        selectedFiles = multiple ? urls : Array(urls.prefix(1))
        onFilesSelected?(selectedFiles)
        layer?.borderColor = NSColor.separatorColor.cgColor
        return true
    }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let text = selectedFiles.isEmpty ? "Drop files here or click to browse" : selectedFiles.map { $0.lastPathComponent }.joined(separator: ", ")
        let attrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 13),
            .foregroundColor: NSColor.secondaryLabelColor,
        ]
        let size = (text as NSString).size(withAttributes: attrs)
        (text as NSString).draw(at: NSPoint(x: (bounds.width - size.width) / 2, y: (bounds.height - size.height) / 2), withAttributes: attrs)
    }
}

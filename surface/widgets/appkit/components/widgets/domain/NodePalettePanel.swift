// ============================================================
// Clef Surface AppKit Widget — NodePalettePanel
//
// Draggable palette of node types from a DiagramNotation. Users
// drag items from the palette onto the canvas to create new
// nodes with the appropriate Schema and type key.
// ============================================================

import AppKit

public struct ClefNodeType {
    public let typeKey: String
    public let label: String
    public let shape: String
    public let defaultFill: NSColor?
    public let icon: NSImage?

    public init(typeKey: String, label: String, shape: String, defaultFill: NSColor? = nil, icon: NSImage? = nil) {
        self.typeKey = typeKey; self.label = label; self.shape = shape
        self.defaultFill = defaultFill; self.icon = icon
    }
}

public class ClefNodePalettePanelView: NSView, NSCollectionViewDataSource, NSCollectionViewDelegate, NSDraggingSource {
    public var notationId: String = "" { didSet { needsDisplay = true } }
    public var notationName: String = "" { didSet { headerLabel.stringValue = notationName } }
    public var types: [ClefNodeType] = [] { didSet { filteredTypes = applyFilter(); collectionView.reloadData() } }
    public var orientation: String = "vertical"
    public var onDragType: ((String) -> Void)?

    private var filteredTypes: [ClefNodeType] = []
    private let headerLabel = NSTextField(labelWithString: "")
    private let searchField = NSSearchField()
    private let scrollView = NSScrollView()
    private let collectionView = NSCollectionView()

    private static let itemIdentifier = NSUserInterfaceItemIdentifier("NodeTypeItem")

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        wantsLayer = true
        layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor

        // Header
        headerLabel.font = NSFont.systemFont(ofSize: 13, weight: .semibold)
        headerLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(headerLabel)

        // Search
        searchField.placeholderString = "Filter node types..."
        searchField.translatesAutoresizingMaskIntoConstraints = false
        searchField.target = self
        searchField.action = #selector(searchChanged(_:))
        addSubview(searchField)

        // Collection view
        let layout = NSCollectionViewFlowLayout()
        layout.itemSize = NSSize(width: 72, height: 72)
        layout.minimumInteritemSpacing = 8
        layout.minimumLineSpacing = 8
        layout.sectionInset = NSEdgeInsets(top: 8, left: 8, bottom: 8, right: 8)
        collectionView.collectionViewLayout = layout
        collectionView.dataSource = self
        collectionView.delegate = self
        collectionView.register(ClefNodeTypeCell.self, forItemWithIdentifier: Self.itemIdentifier)
        collectionView.backgroundColors = [.clear]

        scrollView.documentView = collectionView
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(scrollView)

        NSLayoutConstraint.activate([
            headerLabel.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            headerLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            headerLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),

            searchField.topAnchor.constraint(equalTo: headerLabel.bottomAnchor, constant: 8),
            searchField.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            searchField.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),

            scrollView.topAnchor.constraint(equalTo: searchField.bottomAnchor, constant: 8),
            scrollView.leadingAnchor.constraint(equalTo: leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        setAccessibility(headerLabel.stringValue.isEmpty ? "Node palette" : headerLabel.stringValue)
        setAccessibilityRole(.toolbar)
    }

    @objc private func searchChanged(_ sender: NSSearchField) {
        filteredTypes = applyFilter()
        collectionView.reloadData()
    }

    private func applyFilter() -> [ClefNodeType] {
        let query = searchField.stringValue.lowercased()
        guard !query.isEmpty else { return types }
        return types.filter { $0.label.lowercased().contains(query) }
    }

    // MARK: — NSCollectionViewDataSource

    public func collectionView(_ collectionView: NSCollectionView, numberOfItemsInSection section: Int) -> Int {
        filteredTypes.count
    }

    public func collectionView(_ collectionView: NSCollectionView, itemForRepresentedObjectAt indexPath: IndexPath) -> NSCollectionViewItem {
        let item = collectionView.makeItem(withIdentifier: Self.itemIdentifier, for: indexPath) as! ClefNodeTypeCell
        let nodeType = filteredTypes[indexPath.item]
        item.configure(nodeType: nodeType)
        return item
    }

    // MARK: — NSDraggingSource

    public func draggingSession(_ session: NSDraggingSession, sourceOperationMaskFor context: NSDraggingContext) -> NSDragOperation {
        context == .outsideApplication ? [] : .copy
    }

    // MARK: — NSCollectionViewDelegate

    public func collectionView(_ collectionView: NSCollectionView, canDragItemsAt indexPaths: Set<IndexPath>, with event: NSEvent) -> Bool {
        true
    }

    public func collectionView(_ collectionView: NSCollectionView, pasteboardWriterForItemAt indexPath: IndexPath) -> NSPasteboardWriting? {
        let nodeType = filteredTypes[indexPath.item]
        let item = NSPasteboardItem()
        item.setString(nodeType.typeKey, forType: .string)
        onDragType?(nodeType.typeKey)
        return item
    }
}

// MARK: — Collection View Cell

private class ClefNodeTypeCell: NSCollectionViewItem {
    private let shapeView = NSView()
    private let nameLabel = NSTextField(labelWithString: "")

    override func loadView() {
        view = NSView()
        view.wantsLayer = true
        view.layer?.cornerRadius = 6
        view.layer?.borderWidth = 1
        view.layer?.borderColor = NSColor.separatorColor.cgColor

        shapeView.wantsLayer = true
        shapeView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(shapeView)

        nameLabel.font = NSFont.systemFont(ofSize: 10)
        nameLabel.alignment = .center
        nameLabel.lineBreakMode = .byTruncatingTail
        nameLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(nameLabel)

        NSLayoutConstraint.activate([
            shapeView.topAnchor.constraint(equalTo: view.topAnchor, constant: 8),
            shapeView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            shapeView.widthAnchor.constraint(equalToConstant: 32),
            shapeView.heightAnchor.constraint(equalToConstant: 32),

            nameLabel.topAnchor.constraint(equalTo: shapeView.bottomAnchor, constant: 4),
            nameLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 2),
            nameLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -2),
        ])
    }

    func configure(nodeType: ClefNodeType) {
        nameLabel.stringValue = nodeType.label
        shapeView.layer?.backgroundColor = (nodeType.defaultFill ?? NSColor.controlAccentColor).cgColor
        shapeView.layer?.cornerRadius = nodeType.shape == "circle" ? 16 : 4
        view.setAccessibilityLabel("Add \(nodeType.label) node")
        view.setAccessibilityRole(.button)
    }
}

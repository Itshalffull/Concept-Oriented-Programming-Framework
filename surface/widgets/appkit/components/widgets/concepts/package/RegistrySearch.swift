import AppKit

class RegistrySearchView: NSView {
    enum State: String { case idle; case searching }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Search interface for the package registr")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, searchInput, suggestions, filterBar, resultList, resultCard, cardName, cardVersion, cardDesc, cardKeywords, cardDownloads, cardDate, pagination, emptyState
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}

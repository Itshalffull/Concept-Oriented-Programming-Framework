// ============================================================
// Clef Surface AppKit Widget — Pagination
//
// Page navigation control with previous/next buttons and
// numbered page indicators. Supports total count display.
// ============================================================

import AppKit

public class ClefPaginationView: NSView {
    public var currentPage: Int = 1 { didSet { rebuild() } }
    public var totalPages: Int = 1 { didSet { rebuild() } }
    public var onPageChange: ((Int) -> Void)?

    private let stackView = NSStackView()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        stackView.orientation = .horizontal
        stackView.spacing = 4
        addSubview(stackView)
        rebuild()
    }

    private func rebuild() {
        stackView.arrangedSubviews.forEach { stackView.removeArrangedSubview($0); $0.removeFromSuperview() }

        let prevBtn = NSButton(title: "<", target: self, action: #selector(prevPage))
        prevBtn.isEnabled = currentPage > 1
        prevBtn.bezelStyle = .rounded
        stackView.addArrangedSubview(prevBtn)

        let start = max(1, currentPage - 2)
        let end = min(totalPages, currentPage + 2)
        for page in start...end {
            let btn = NSButton(title: "\(page)", target: self, action: #selector(goToPage(_:)))
            btn.tag = page
            btn.bezelStyle = .rounded
            if page == currentPage { btn.state = .on }
            stackView.addArrangedSubview(btn)
        }

        let nextBtn = NSButton(title: ">", target: self, action: #selector(nextPage))
        nextBtn.isEnabled = currentPage < totalPages
        nextBtn.bezelStyle = .rounded
        stackView.addArrangedSubview(nextBtn)
    }

    @objc private func prevPage() { if currentPage > 1 { currentPage -= 1; onPageChange?(currentPage) } }
    @objc private func nextPage() { if currentPage < totalPages { currentPage += 1; onPageChange?(currentPage) } }
    @objc private func goToPage(_ sender: NSButton) { currentPage = sender.tag; onPageChange?(currentPage) }

    public override func layout() {
        super.layout()
        stackView.frame = bounds
    }
}

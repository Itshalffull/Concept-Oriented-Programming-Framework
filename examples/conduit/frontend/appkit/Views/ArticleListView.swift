// Conduit Example App -- AppKit Article List View Controller
// NSTableView-based sidebar showing the global article feed.

import AppKit

class ArticleListViewController: NSViewController, NSTableViewDataSource, NSTableViewDelegate {
    var onArticleSelected: ((Article) -> Void)?
    var onLoginRequested: (() -> Void)?

    private var articles: [Article] = []
    private let tableView = NSTableView()
    private let scrollView = NSScrollView()
    private let statusLabel = NSTextField(labelWithString: "Loading...")
    private let refreshButton = NSButton(title: "Refresh", target: nil, action: nil)
    private let loginButton = NSButton(title: "Sign In", target: nil, action: nil)

    override func loadView() {
        view = NSView(frame: NSRect(x: 0, y: 0, width: 320, height: 600))

        // Toolbar
        let toolbar = NSStackView()
        toolbar.orientation = .horizontal
        toolbar.spacing = 8
        toolbar.translatesAutoresizingMaskIntoConstraints = false

        refreshButton.target = self
        refreshButton.action = #selector(handleRefresh)
        refreshButton.bezelStyle = .rounded

        loginButton.target = self
        loginButton.action = #selector(handleLogin)
        loginButton.bezelStyle = .rounded

        toolbar.addArrangedSubview(refreshButton)
        toolbar.addArrangedSubview(NSView()) // spacer
        toolbar.addArrangedSubview(loginButton)

        // Table
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("ArticleColumn"))
        column.title = "Articles"
        column.width = 300
        tableView.addTableColumn(column)
        tableView.dataSource = self
        tableView.delegate = self
        tableView.headerView = nil
        tableView.rowHeight = 72

        scrollView.documentView = tableView
        scrollView.hasVerticalScroller = true
        scrollView.translatesAutoresizingMaskIntoConstraints = false

        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.alignment = .center
        statusLabel.textColor = .secondaryLabelColor

        view.addSubview(toolbar)
        view.addSubview(scrollView)
        view.addSubview(statusLabel)

        NSLayoutConstraint.activate([
            toolbar.topAnchor.constraint(equalTo: view.topAnchor, constant: 8),
            toolbar.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 8),
            toolbar.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -8),

            scrollView.topAnchor.constraint(equalTo: toolbar.bottomAnchor, constant: 8),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            statusLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            statusLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        refreshArticles()
    }

    func refreshArticles() {
        statusLabel.isHidden = false
        statusLabel.stringValue = "Loading..."
        loginButton.title = APIClient.shared.isAuthenticated
            ? (APIClient.shared.currentUser?.username ?? "Account")
            : "Sign In"

        Task { @MainActor in
            do {
                articles = try await APIClient.shared.getArticles()
                tableView.reloadData()
                statusLabel.isHidden = !articles.isEmpty
                if articles.isEmpty {
                    statusLabel.stringValue = "No articles yet."
                }
            } catch {
                statusLabel.stringValue = "Error: \(error.localizedDescription)"
                statusLabel.isHidden = false
            }
        }
    }

    // MARK: - Actions

    @objc private func handleRefresh() {
        refreshArticles()
    }

    @objc private func handleLogin() {
        if APIClient.shared.isAuthenticated {
            APIClient.shared.logout()
            loginButton.title = "Sign In"
        } else {
            onLoginRequested?()
        }
    }

    // MARK: - NSTableViewDataSource

    func numberOfRows(in tableView: NSTableView) -> Int {
        return articles.count
    }

    // MARK: - NSTableViewDelegate

    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        let article = articles[row]

        let cell = NSTableCellView()
        cell.identifier = NSUserInterfaceItemIdentifier("ArticleCell")

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 2
        stack.translatesAutoresizingMaskIntoConstraints = false

        let titleLabel = NSTextField(labelWithString: article.title)
        titleLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        titleLabel.lineBreakMode = .byTruncatingTail
        titleLabel.maximumNumberOfLines = 1

        let descLabel = NSTextField(labelWithString: article.description)
        descLabel.font = .systemFont(ofSize: 11)
        descLabel.textColor = .secondaryLabelColor
        descLabel.lineBreakMode = .byTruncatingTail
        descLabel.maximumNumberOfLines = 2

        let metaLabel = NSTextField(labelWithString: "\(article.author.username) \u{00B7} \u{2665} \(article.favoritesCount)")
        metaLabel.font = .systemFont(ofSize: 10)
        metaLabel.textColor = .tertiaryLabelColor

        stack.addArrangedSubview(titleLabel)
        stack.addArrangedSubview(descLabel)
        stack.addArrangedSubview(metaLabel)

        cell.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: cell.leadingAnchor, constant: 8),
            stack.trailingAnchor.constraint(equalTo: cell.trailingAnchor, constant: -8),
            stack.centerYAnchor.constraint(equalTo: cell.centerYAnchor),
        ])

        return cell
    }

    func tableViewSelectionDidChange(_ notification: Notification) {
        let row = tableView.selectedRow
        guard row >= 0, row < articles.count else { return }
        onArticleSelected?(articles[row])
    }
}

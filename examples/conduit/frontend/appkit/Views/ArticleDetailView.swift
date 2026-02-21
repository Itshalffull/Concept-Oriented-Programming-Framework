// Conduit Example App -- AppKit Article Detail View Controller
// Displays full article content in the right pane of the split view.

import AppKit

class ArticleDetailViewController: NSViewController {
    private let scrollView = NSScrollView()
    private let contentStack = NSStackView()
    private let titleLabel = NSTextField(labelWithString: "")
    private let authorLabel = NSTextField(labelWithString: "")
    private let dateLabel = NSTextField(labelWithString: "")
    private let bodyLabel = NSTextField(wrappingLabelWithString: "")
    private let tagsLabel = NSTextField(labelWithString: "")
    private let placeholderLabel = NSTextField(labelWithString: "Select an article to view it here.")
    private let favoriteButton = NSButton(title: "\u{2661} Favorite", target: nil, action: nil)

    private var currentArticle: Article?

    override func loadView() {
        view = NSView(frame: NSRect(x: 0, y: 0, width: 600, height: 600))

        // Placeholder
        placeholderLabel.translatesAutoresizingMaskIntoConstraints = false
        placeholderLabel.alignment = .center
        placeholderLabel.textColor = .secondaryLabelColor
        placeholderLabel.font = .systemFont(ofSize: 16)
        view.addSubview(placeholderLabel)

        // Content
        contentStack.orientation = .vertical
        contentStack.alignment = .leading
        contentStack.spacing = 12
        contentStack.translatesAutoresizingMaskIntoConstraints = false

        titleLabel.font = .systemFont(ofSize: 24, weight: .bold)
        titleLabel.maximumNumberOfLines = 0
        titleLabel.lineBreakMode = .byWordWrapping

        authorLabel.font = .systemFont(ofSize: 13, weight: .medium)
        authorLabel.textColor = NSColor(red: 0.36, green: 0.72, blue: 0.36, alpha: 1.0)

        dateLabel.font = .systemFont(ofSize: 11)
        dateLabel.textColor = .secondaryLabelColor

        bodyLabel.font = .systemFont(ofSize: 14)
        bodyLabel.maximumNumberOfLines = 0
        bodyLabel.lineBreakMode = .byWordWrapping

        tagsLabel.font = .systemFont(ofSize: 11)
        tagsLabel.textColor = .tertiaryLabelColor

        favoriteButton.target = self
        favoriteButton.action = #selector(handleFavorite)
        favoriteButton.bezelStyle = .rounded

        let metaRow = NSStackView(views: [authorLabel, dateLabel, NSView(), favoriteButton])
        metaRow.orientation = .horizontal
        metaRow.spacing = 8

        contentStack.addArrangedSubview(titleLabel)
        contentStack.addArrangedSubview(metaRow)
        contentStack.addArrangedSubview(NSBox.separator())
        contentStack.addArrangedSubview(bodyLabel)
        contentStack.addArrangedSubview(tagsLabel)

        let clipView = NSClipView()
        clipView.documentView = contentStack

        scrollView.contentView = clipView
        scrollView.hasVerticalScroller = true
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.isHidden = true
        view.addSubview(scrollView)

        NSLayoutConstraint.activate([
            placeholderLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            placeholderLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor),

            scrollView.topAnchor.constraint(equalTo: view.topAnchor, constant: 16),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -16),

            contentStack.widthAnchor.constraint(equalTo: scrollView.widthAnchor),
            metaRow.widthAnchor.constraint(equalTo: contentStack.widthAnchor),
        ])
    }

    func displayArticle(_ article: Article) {
        currentArticle = article
        placeholderLabel.isHidden = true
        scrollView.isHidden = false

        titleLabel.stringValue = article.title
        authorLabel.stringValue = article.author.username
        dateLabel.stringValue = String(article.createdAt.prefix(10))
        bodyLabel.stringValue = article.body
        tagsLabel.stringValue = article.tagList.isEmpty ? "" : "Tags: \(article.tagList.joined(separator: ", "))"
        favoriteButton.title = (article.favorited ? "\u{2665}" : "\u{2661}") + " \(article.favoritesCount)"
    }

    @objc private func handleFavorite() {
        guard let article = currentArticle else { return }
        Task { @MainActor in
            do {
                let updated = article.favorited
                    ? try await APIClient.shared.unfavorite(slug: article.slug)
                    : try await APIClient.shared.favorite(slug: article.slug)
                displayArticle(updated)
            } catch {
                let alert = NSAlert()
                alert.messageText = "Error"
                alert.informativeText = error.localizedDescription
                alert.runModal()
            }
        }
    }
}

private extension NSBox {
    static func separator() -> NSBox {
        let box = NSBox()
        box.boxType = .separator
        return box
    }
}

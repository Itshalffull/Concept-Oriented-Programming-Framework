// Conduit Example App -- AppKit Main Window Controller
// NSWindow with split view: article list on the left, detail on the right.

import AppKit

class MainWindowController: NSWindowController {
    private let splitViewController = NSSplitViewController()
    private let articleListView = ArticleListViewController()
    private let articleDetailView = ArticleDetailViewController()

    init() {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1024, height: 640),
            styleMask: [.titled, .closable, .resizable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Conduit"
        window.center()
        window.minSize = NSSize(width: 700, height: 400)

        super.init(window: window)

        let listItem = NSSplitViewItem(sidebarWithViewController: articleListView)
        listItem.minimumThickness = 280
        listItem.maximumThickness = 400

        let detailItem = NSSplitViewItem(viewController: articleDetailView)
        detailItem.minimumThickness = 400

        splitViewController.addSplitViewItem(listItem)
        splitViewController.addSplitViewItem(detailItem)

        window.contentViewController = splitViewController

        articleListView.onArticleSelected = { [weak self] article in
            self?.articleDetailView.displayArticle(article)
        }

        articleListView.onLoginRequested = { [weak self] in
            self?.showLoginSheet()
        }
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func showLoginSheet() {
        let loginVC = LoginViewController()
        loginVC.onLoginComplete = { [weak self] in
            self?.articleListView.refreshArticles()
        }
        window?.contentViewController?.presentAsSheet(loginVC)
    }
}

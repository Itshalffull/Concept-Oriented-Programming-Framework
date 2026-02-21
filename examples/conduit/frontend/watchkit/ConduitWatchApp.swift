// Conduit Example App -- WatchKit App Entry Point
// watchOS SwiftUI app root with navigation to the article list.

import SwiftUI

@main
struct ConduitWatchApp: App {
    @StateObject private var api = WatchAPIClient.shared

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                ArticleListView()
            }
            .environmentObject(api)
        }
    }
}

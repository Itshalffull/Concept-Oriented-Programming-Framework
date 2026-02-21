// Conduit Example App -- SwiftUI App Entry Point
// Root application with NavigationStack and tab-based navigation.

import SwiftUI

@main
struct ConduitApp: App {
    @StateObject private var api = APIService.shared

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                HomeView()
            }
            .environmentObject(api)
            .tint(Color(red: 0.36, green: 0.72, blue: 0.36))
        }
    }
}

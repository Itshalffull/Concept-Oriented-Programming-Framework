// ============================================================
// Clef Surface SwiftUI Widget — PluginDetailPage
//
// Plugin marketplace detail page with plugin info sections:
// header with name/version/author, description, scrollable
// readme content, and action buttons for install/uninstall
// and enable/disable.
// ============================================================

import SwiftUI

struct PluginDetailPageView: View {
    var name: String
    var version: String
    var author: String
    var description: String
    var readme: String? = nil
    var installed: Bool = false
    var enabled: Bool = false
    var onInstall: () -> Void = {}
    var onToggle: () -> Void = {}

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Header
                Text(name)
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.accentColor)

                HStack {
                    Text("@\(version)")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Text("by \(author)")
                        .font(.caption)
                }

                if installed {
                    Text(enabled ? "\u{2713} Enabled" : "\u{25CB} Disabled")
                        .font(.caption)
                        .foregroundColor(enabled ? .accentColor : .orange)
                        .padding(.top, 4)
                }

                // Description
                Text(description)
                    .font(.body)
                    .padding(.top, 16)

                // Readme
                if let readme = readme {
                    Divider()
                        .padding(.top, 16)

                    Text("README")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.secondary)
                        .padding(.top, 8)

                    Text(readme)
                        .font(.caption)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color(.systemGray6))
                        )
                        .padding(.top, 8)
                }

                // Action buttons
                HStack(spacing: 8) {
                    SwiftUI.Button(action: onInstall) {
                        Text(installed ? "Uninstall" : "Install")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(installed ? .red : .accentColor)

                    if installed {
                        SwiftUI.Button(action: onToggle) {
                            Text(enabled ? "Disable" : "Enable")
                        }
                        .buttonStyle(.bordered)
                    }
                }
                .padding(.top, 16)
            }
            .padding(16)
        }
    }
}

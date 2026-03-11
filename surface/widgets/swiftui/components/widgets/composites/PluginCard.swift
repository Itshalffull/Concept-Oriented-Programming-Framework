// ============================================================
// Clef Surface SwiftUI Widget — PluginCard
//
// Card displaying plugin/extension information with install,
// enable, and disable actions.
// ============================================================

import SwiftUI

enum PluginStatus { case installed, notInstalled, updateAvailable }

struct PluginCardView: View {
    var name: String
    var description: String? = nil
    var version: String? = nil
    var author: String? = nil
    var status: PluginStatus = .notInstalled
    var enabled: Bool = false
    var onInstall: (() -> Void)? = nil
    var onToggle: ((Bool) -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(name).font(.headline).fontWeight(.bold)
                Spacer()
                if let version = version { Text("v\(version)").font(.caption).foregroundColor(.secondary) }
            }
            if let description = description { Text(description).font(.body).foregroundColor(.secondary) }
            if let author = author { Text("by \(author)").font(.caption).foregroundColor(.secondary) }
            HStack {
                switch status {
                case .notInstalled:
                    if let onInstall = onInstall {
                        SwiftUI.Button("Install", action: onInstall).buttonStyle(.borderedProminent)
                    }
                case .installed:
                    if let onToggle = onToggle {
                        Toggle(enabled ? "Enabled" : "Disabled", isOn: Binding(get: { enabled }, set: { onToggle($0) })).toggleStyle(.switch)
                    }
                case .updateAvailable:
                    if let onInstall = onInstall {
                        SwiftUI.Button("Update", action: onInstall).buttonStyle(.bordered)
                    }
                }
            }
        }
        .padding(16)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(.systemGray4), lineWidth: 1))
    }
}

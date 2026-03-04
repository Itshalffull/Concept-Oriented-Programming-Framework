// ============================================================
// Clef Surface SwiftUI Widget — CacheDashboard
//
// Dashboard displaying cache statistics, hit/miss rates, and
// cache management actions (clear, refresh).
// ============================================================

import SwiftUI

struct CacheEntry: Identifiable {
    let id: String
    let key: String
    let size: String
    var hitCount: Int = 0
    var age: String = ""
}

struct CacheDashboardView: View {
    var entries: [CacheEntry]
    var totalSize: String = "0 KB"
    var hitRate: Double = 0
    var onClear: (() -> Void)? = nil
    var onRefresh: (() -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Cache Dashboard").font(.headline).fontWeight(.bold)
                Spacer()
                if let onRefresh = onRefresh {
                    SwiftUI.Button(action: onRefresh) { Image(systemName: "arrow.clockwise") }.buttonStyle(.plain)
                }
                if let onClear = onClear {
                    SwiftUI.Button("Clear", role: .destructive, action: onClear)
                }
            }
            HStack(spacing: 16) {
                VStack { Text("Total Size").font(.caption).foregroundColor(.secondary); Text(totalSize).font(.headline) }
                VStack { Text("Hit Rate").font(.caption).foregroundColor(.secondary); Text("\(Int(hitRate * 100))%").font(.headline) }
                VStack { Text("Entries").font(.caption).foregroundColor(.secondary); Text("\(entries.count)").font(.headline) }
            }
            Divider()
            ForEach(entries) { entry in
                HStack {
                    VStack(alignment: .leading) {
                        Text(entry.key).font(.subheadline).fontWeight(.medium)
                        Text("\(entry.size) | \(entry.hitCount) hits | \(entry.age)").font(.caption).foregroundColor(.secondary)
                    }
                    Spacer()
                }
                .padding(.vertical, 4)
            }
            if entries.isEmpty { Text("Cache is empty").font(.body).foregroundColor(.secondary) }
        }.padding(12)
    }
}

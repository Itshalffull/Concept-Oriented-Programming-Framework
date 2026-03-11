// ============================================================
// Clef Surface WatchKit Widget - QueueDashboard
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct QueueDashboardView: View {
    var pending: Int = 0; var active: Int = 0; var failed: Int = 0; var jobs: [(name: String, status: String)] = []
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                VStack { Text("\(pending)").font(.caption.bold()); Text("Pending").font(.system(size: 8)) }
                VStack { Text("\(active)").font(.caption.bold()).foregroundColor(.blue); Text("Active").font(.system(size: 8)) }
                VStack { Text("\(failed)").font(.caption.bold()).foregroundColor(.red); Text("Failed").font(.system(size: 8)) }
            }
            Divider()
            ForEach(0..<jobs.count, id: \.self) { i in HStack { Text(jobs[i].name).font(.caption2); Spacer(); Text(jobs[i].status).font(.caption2).foregroundColor(.secondary) } }
        } }
    }
}

// ============================================================
// Clef Surface SwiftUI Widget — QueueDashboard
//
// Dashboard for monitoring job/task queues with status counts,
// active jobs, and management actions.
// ============================================================

import SwiftUI

struct QueueJob: Identifiable {
    let id: String
    let name: String
    var status: String = "pending"
    var progress: Double? = nil
}

struct QueueDashboardView: View {
    var jobs: [QueueJob]
    var title: String = "Queue"
    var onPause: (() -> Void)? = nil
    var onResume: (() -> Void)? = nil
    var onClear: (() -> Void)? = nil

    private var pending: Int { jobs.filter { $0.status == "pending" }.count }
    private var active: Int { jobs.filter { $0.status == "active" }.count }
    private var completed: Int { jobs.filter { $0.status == "completed" }.count }
    private var failed: Int { jobs.filter { $0.status == "failed" }.count }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title).font(.headline).fontWeight(.bold)
                Spacer()
                if let onPause = onPause { SwiftUI.Button("Pause", action: onPause) }
                if let onResume = onResume { SwiftUI.Button("Resume", action: onResume) }
                if let onClear = onClear { SwiftUI.Button("Clear", role: .destructive, action: onClear) }
            }
            HStack(spacing: 16) {
                VStack { Text("Pending").font(.caption).foregroundColor(.secondary); Text("\(pending)").font(.headline) }
                VStack { Text("Active").font(.caption).foregroundColor(.secondary); Text("\(active)").font(.headline).foregroundColor(.accentColor) }
                VStack { Text("Done").font(.caption).foregroundColor(.secondary); Text("\(completed)").font(.headline).foregroundColor(.green) }
                VStack { Text("Failed").font(.caption).foregroundColor(.secondary); Text("\(failed)").font(.headline).foregroundColor(.red) }
            }
            Divider()
            ForEach(jobs) { job in
                HStack {
                    Circle().fill(statusColor(job.status)).frame(width: 8, height: 8)
                    Text(job.name).font(.subheadline)
                    Spacer()
                    Text(job.status).font(.caption).foregroundColor(.secondary)
                    if let progress = job.progress {
                        ProgressView(value: progress).frame(width: 60)
                    }
                }.padding(.vertical, 2)
            }
            if jobs.isEmpty { Text("Queue is empty").font(.body).foregroundColor(.secondary) }
        }.padding(12)
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "active": return .accentColor
        case "completed": return .green
        case "failed": return .red
        default: return .gray
        }
    }
}

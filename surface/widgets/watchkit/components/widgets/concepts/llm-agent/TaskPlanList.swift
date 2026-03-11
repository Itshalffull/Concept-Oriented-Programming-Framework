import SwiftUI

// State machine: idle | taskSelected
enum TaskPlanListWatchState {
    case idle
    case taskSelected
}

enum TaskPlanListWatchEvent {
    case selectTask(String)
    case deselect
}

func taskPlanListWatchReduce(_ state: TaskPlanListWatchState, _ event: TaskPlanListWatchEvent) -> TaskPlanListWatchState {
    switch state {
    case .idle:
        if case .selectTask = event { return .taskSelected }
        return state
    case .taskSelected:
        switch event {
        case .deselect: return .idle
        case .selectTask: return .taskSelected
        default: return state
        }
    }
}

struct TaskData: Identifiable {
    let id: String
    let label: String
    let status: String // "pending", "active", "complete", "failed", "skipped"
    var description: String? = nil
    var children: [TaskData] = []
}

struct TaskPlanListWatchView: View {
    let tasks: [TaskData]
    var onSelectTask: ((String) -> Void)? = nil

    @State private var state: TaskPlanListWatchState = .idle
    @State private var selectedTaskId: String? = nil

    private func statusIcon(_ status: String) -> String {
        switch status {
        case "complete": return "checkmark.circle.fill"
        case "active": return "play.circle.fill"
        case "failed": return "xmark.circle.fill"
        case "skipped": return "forward.circle"
        default: return "circle"
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "complete": return .green
        case "active": return .blue
        case "failed": return .red
        case "skipped": return .secondary
        default: return .gray
        }
    }

    private var completedCount: Int { countStatus(tasks, "complete") }
    private var totalCount: Int { countAll(tasks) }

    private func countStatus(_ items: [TaskData], _ status: String) -> Int {
        items.reduce(0) { $0 + ($1.status == status ? 1 : 0) + countStatus($1.children, status) }
    }

    private func countAll(_ items: [TaskData]) -> Int {
        items.reduce(0) { $0 + 1 + countAll($1.children) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Tasks").font(.caption2).fontWeight(.bold)
                    Spacer()
                    Text("\(completedCount)/\(totalCount)")
                        .font(.system(size: 9)).foregroundColor(.secondary)
                }

                ProgressView(value: totalCount > 0 ? Double(completedCount) / Double(totalCount) : 0)
                    .tint(.green)

                ForEach(tasks) { task in
                    taskRow(task, depth: 0)
                }

                if let selId = selectedTaskId, let task = findTask(in: tasks, id: selId) {
                    Divider()
                    VStack(alignment: .leading, spacing: 2) {
                        Text(task.label).font(.caption2).fontWeight(.bold)
                        Text(task.status.capitalized).font(.system(size: 9)).foregroundColor(statusColor(task.status))
                        if let desc = task.description {
                            Text(desc).font(.system(size: 8)).foregroundColor(.secondary)
                        }
                    }
                }
            }
            .padding(.horizontal, 4)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Task plan: \(completedCount) of \(totalCount) complete")
    }

    @ViewBuilder
    private func taskRow(_ task: TaskData, depth: Int) -> some View {
        Button {
            if selectedTaskId == task.id {
                selectedTaskId = nil
                state = taskPlanListWatchReduce(state, .deselect)
            } else {
                selectedTaskId = task.id
                state = taskPlanListWatchReduce(state, .selectTask(task.id))
                onSelectTask?(task.id)
            }
        } label: {
            HStack(spacing: 3) {
                Image(systemName: statusIcon(task.status))
                    .font(.system(size: 9))
                    .foregroundColor(statusColor(task.status))
                Text(task.label)
                    .font(.caption2)
                    .lineLimit(1)
                    .strikethrough(task.status == "complete")
            }
            .padding(.leading, CGFloat(depth * 10))
            .padding(.vertical, 1)
            .background(selectedTaskId == task.id ? Color.blue.opacity(0.1) : Color.clear)
            .cornerRadius(2)
        }
        .buttonStyle(.plain)

        ForEach(task.children) { child in
            taskRow(child, depth: depth + 1)
        }
    }

    private func findTask(in tasks: [TaskData], id: String) -> TaskData? {
        for t in tasks {
            if t.id == id { return t }
            if let found = findTask(in: t.children, id: id) { return found }
        }
        return nil
    }
}

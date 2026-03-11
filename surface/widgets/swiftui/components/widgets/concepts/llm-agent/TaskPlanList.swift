import SwiftUI

// MARK: - Types

enum TaskStatus: String, CaseIterable { case pending, active, complete, failed, skipped }

struct PlanTask: Identifiable {
    let id: String
    let label: String
    let status: TaskStatus
    var result: String?
    var subtasks: [PlanTask]?
}

// MARK: - State Machine

enum TaskPlanListState { case idle, taskSelected, reordering }
enum TaskPlanListEvent {
    case expandTask(id: String), collapseTask(id: String), selectTask(id: String)
    case dragStart, deselect, drop, cancelDrag
}

func taskPlanListReduce(state: TaskPlanListState, event: TaskPlanListEvent) -> TaskPlanListState {
    switch state {
    case .idle:
        switch event {
        case .expandTask, .collapseTask: return .idle
        case .selectTask: return .taskSelected
        case .dragStart: return .reordering
        default: return state
        }
    case .taskSelected:
        switch event {
        case .deselect: return .idle
        case .selectTask: return .taskSelected
        default: return state
        }
    case .reordering:
        switch event {
        case .drop, .cancelDrag: return .idle
        default: return state
        }
    }
}

private let statusIcons: [TaskStatus: String] = [
    .pending: "\u{25CB}", .active: "\u{25CF}", .complete: "\u{2713}", .failed: "\u{2717}", .skipped: "\u{2298}"
]

private func countTasks(_ tasks: [PlanTask]) -> (complete: Int, total: Int) {
    var c = 0, t = 0
    for task in tasks {
        t += 1; if task.status == .complete { c += 1 }
        if let subs = task.subtasks { let s = countTasks(subs); c += s.complete; t += s.total }
    }
    return (c, t)
}

// MARK: - View

struct TaskPlanListView: View {
    let tasks: [PlanTask]
    let goalLabel: String
    let progress: Double
    var showProgress: Bool = true
    var allowReorder: Bool = true
    var onReorder: (([PlanTask]) -> Void)?

    @State private var widgetState: TaskPlanListState = .idle
    @State private var expandedSet: Set<String> = []
    @State private var selectedId: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(goalLabel).font(.headline).padding(.horizontal, 12).padding(.vertical, 8)

            if showProgress {
                let counts = countTasks(tasks)
                VStack(spacing: 2) {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 3).fill(Color.gray.opacity(0.2))
                            RoundedRectangle(cornerRadius: 3).fill(Color.blue)
                                .frame(width: geo.size.width * CGFloat(min(max(progress, 0), 100) / 100))
                        }
                    }.frame(height: 6)
                    Text("\(counts.complete) of \(counts.total) tasks complete")
                        .font(.caption2).foregroundColor(.secondary)
                }
                .padding(.horizontal, 12).padding(.bottom, 8)
                .accessibilityLabel("\(counts.complete) of \(counts.total) tasks complete")
            }

            Divider()

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(tasks) { task in
                        taskRow(task, depth: 0)
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Task plan: \(goalLabel)")
    }

    @ViewBuilder
    private func taskRow(_ task: PlanTask, depth: Int) -> some View {
        let isExpanded = expandedSet.contains(task.id)
        let isSelected = selectedId == task.id
        let hasSubtasks = !(task.subtasks ?? []).isEmpty

        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Text(statusIcons[task.status] ?? "\u{25CB}").font(.system(size: 14))
                    .foregroundColor(task.status == .active ? .blue : (task.status == .failed ? .red : .primary))
                Text(task.label).lineLimit(1)
                Spacer()
                if hasSubtasks {
                    Button(action: { toggleExpand(task.id) }) {
                        Text(isExpanded ? "\u{25BC}" : "\u{25B6}").font(.system(size: 10))
                    }.buttonStyle(.plain)
                }
            }
            .padding(.leading, CGFloat(depth * 20))
            .padding(.horizontal, 12).padding(.vertical, 6)
            .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
            .contentShape(Rectangle())
            .onTapGesture {
                if selectedId == task.id {
                    selectedId = nil
                    widgetState = taskPlanListReduce(state: widgetState, event: .deselect)
                } else {
                    selectedId = task.id
                    widgetState = taskPlanListReduce(state: widgetState, event: .selectTask(id: task.id))
                }
            }
            .accessibilityLabel("\(task.label) \u{2014} \(task.status.rawValue.capitalized)")

            if isExpanded, let result = task.result {
                Text(result).font(.system(size: 13)).foregroundColor(.secondary)
                    .padding(.leading, CGFloat((depth + 1) * 20)).padding(.horizontal, 12).padding(.vertical, 4)
            }

            if isExpanded, let subs = task.subtasks {
                ForEach(subs) { sub in taskRow(sub, depth: depth + 1) }
            }
        }
    }

    private func toggleExpand(_ id: String) {
        if expandedSet.contains(id) { expandedSet.remove(id) } else { expandedSet.insert(id) }
    }
}

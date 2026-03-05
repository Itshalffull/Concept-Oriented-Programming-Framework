import AppKit

class TaskPlanListView: NSView {
    enum State: String { case idle; case taskSelected; case reordering }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Goal decomposition display showing a hie")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, goalHeader, progressBar, taskList, taskItem, taskStatus, taskLabel, taskResult, subtasks, dragHandle
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}

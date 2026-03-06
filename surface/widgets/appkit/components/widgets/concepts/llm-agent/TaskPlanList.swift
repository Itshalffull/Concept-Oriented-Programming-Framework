import AppKit

class TaskPlanListView: NSView {

    enum State: String { case idle; case taskSelected; case reordering }
    enum TaskStatus: String { case pending; case running; case completed; case failed; case skipped }

    struct Task {
        let id: String
        let label: String
        let status: TaskStatus
        let result: String?
        let subtasks: [Task]
    }

    private(set) var state: State = .idle
    private var goalLabel: String = ""
    private var tasks: [Task] = []
    private var selectedTaskId: String? = nil
    private var focusIndex: Int = 0
    private var flatTaskIds: [String] = []
    private var trackingArea: NSTrackingArea?

    var onTaskSelect: ((String) -> Void)?
    var onReorder: (([String]) -> Void)?

    private let rootStack = NSStackView()
    private let goalHeaderLabel = NSTextField(labelWithString: "")
    private let progressBar = NSProgressIndicator()
    private let progressLabel = NSTextField(labelWithString: "")
    private let taskScroll = NSScrollView()
    private let taskContainer = NSStackView()

    // MARK: - State machine

    func reduce(_ event: String, taskId: String? = nil) {
        switch state {
        case .idle:
            if event == "SELECT_TASK", let id = taskId { state = .taskSelected; selectedTaskId = id; onTaskSelect?(id) }
            if event == "START_REORDER" { state = .reordering }
        case .taskSelected:
            if event == "DESELECT" { state = .idle; selectedTaskId = nil }
            if event == "SELECT_TASK", let id = taskId { selectedTaskId = id; onTaskSelect?(id) }
        case .reordering:
            if event == "END_REORDER" { state = .idle }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Goal decomposition display showing a hierarchical task plan")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    // MARK: - Setup

    private func setupSubviews() {
        wantsLayer = true

        rootStack.orientation = .vertical
        rootStack.spacing = 6
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
        ])

        // Goal header
        goalHeaderLabel.font = .boldSystemFont(ofSize: 14)
        rootStack.addArrangedSubview(goalHeaderLabel)

        // Progress
        let progressRow = NSStackView()
        progressRow.orientation = .horizontal
        progressRow.spacing = 8
        progressBar.style = .bar
        progressBar.minValue = 0
        progressBar.maxValue = 100
        progressBar.setAccessibilityLabel("Task completion progress")
        progressLabel.font = .systemFont(ofSize: 11)
        progressLabel.textColor = .secondaryLabelColor
        progressRow.addArrangedSubview(progressBar)
        progressRow.addArrangedSubview(progressLabel)
        rootStack.addArrangedSubview(progressRow)

        // Task list
        taskScroll.hasVerticalScroller = true
        taskScroll.drawsBackground = false
        taskContainer.orientation = .vertical
        taskContainer.spacing = 2
        taskScroll.documentView = taskContainer
        rootStack.addArrangedSubview(taskScroll)

        updateUI()
    }

    // MARK: - Configure

    func configure(goal: String, tasks: [Task]) {
        self.goalLabel = goal
        self.tasks = tasks
        goalHeaderLabel.stringValue = goal
        rebuildTaskList()
        updateUI()
    }

    private func statusIcon(_ status: TaskStatus) -> String {
        switch status {
        case .completed: return "\u{2713}"
        case .running: return "\u{25CF}"
        case .failed: return "\u{2717}"
        case .skipped: return "\u{2014}"
        case .pending: return "\u{25CB}"
        }
    }

    private func statusColor(_ status: TaskStatus) -> NSColor {
        switch status {
        case .completed: return .systemGreen
        case .running: return .systemBlue
        case .failed: return .systemRed
        case .skipped: return .secondaryLabelColor
        case .pending: return .tertiaryLabelColor
        }
    }

    private func rebuildTaskList() {
        taskContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
        flatTaskIds = []
        for task in tasks {
            addTaskRow(task, depth: 0)
        }
    }

    private func addTaskRow(_ task: Task, depth: Int) {
        flatTaskIds.append(task.id)

        let row = NSStackView()
        row.orientation = .horizontal
        row.spacing = 6
        row.edgeInsets = NSEdgeInsets(top: 2, left: CGFloat(depth * 16), bottom: 2, right: 4)

        let icon = NSTextField(labelWithString: statusIcon(task.status))
        icon.font = .systemFont(ofSize: 12)
        icon.textColor = statusColor(task.status)
        row.addArrangedSubview(icon)

        let nameBtn = NSButton(title: task.label, target: self, action: #selector(handleTaskClick(_:)))
        nameBtn.bezelStyle = .roundRect
        nameBtn.identifier = NSUserInterfaceItemIdentifier(task.id)
        nameBtn.setAccessibilityLabel("\(task.label): \(task.status.rawValue)")
        if selectedTaskId == task.id { nameBtn.contentTintColor = .controlAccentColor }
        row.addArrangedSubview(nameBtn)

        if let result = task.result {
            let resultLabel = NSTextField(labelWithString: result)
            resultLabel.font = .systemFont(ofSize: 10)
            resultLabel.textColor = .tertiaryLabelColor
            row.addArrangedSubview(resultLabel)
        }

        taskContainer.addArrangedSubview(row)

        for subtask in task.subtasks {
            addTaskRow(subtask, depth: depth + 1)
        }
    }

    private func countCompleted(_ tasks: [Task]) -> (completed: Int, total: Int) {
        var completed = 0, total = 0
        for task in tasks {
            total += 1
            if task.status == .completed { completed += 1 }
            let sub = countCompleted(task.subtasks)
            completed += sub.completed
            total += sub.total
        }
        return (completed, total)
    }

    private func updateUI() {
        let (completed, total) = countCompleted(tasks)
        let pct = total > 0 ? Double(completed) / Double(total) * 100 : 0
        progressBar.doubleValue = pct
        progressLabel.stringValue = "\(completed)/\(total) tasks"

        setAccessibilityValue("\(goalLabel), \(completed) of \(total) tasks completed, \(state.rawValue)")
    }

    // MARK: - Actions

    @objc private func handleTaskClick(_ sender: NSButton) {
        if let id = sender.identifier?.rawValue {
            reduce("SELECT_TASK", taskId: id)
        }
    }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 125: focusIndex = min(focusIndex + 1, flatTaskIds.count - 1); if focusIndex < flatTaskIds.count { reduce("SELECT_TASK", taskId: flatTaskIds[focusIndex]) }
        case 126: focusIndex = max(focusIndex - 1, 0); if focusIndex < flatTaskIds.count { reduce("SELECT_TASK", taskId: flatTaskIds[focusIndex]) }
        case 53: reduce("DESELECT")
        default: super.keyDown(with: event)
        }
    }

    deinit {}
}

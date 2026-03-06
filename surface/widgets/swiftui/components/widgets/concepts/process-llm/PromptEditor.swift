import SwiftUI

enum PromptEditorWidgetState {
    case editing, testing, viewing
}

enum PromptEditorEvent {
    case test, input, testComplete, testError, edit
}

func promptEditorReduce(state: PromptEditorWidgetState, event: PromptEditorEvent) -> PromptEditorWidgetState {
    switch state {
    case .editing:
        if event == .test { return .testing }
        return state
    case .testing:
        if event == .testComplete { return .viewing }
        if event == .testError { return .editing }
        return state
    case .viewing:
        if event == .edit { return .editing }
        if event == .test { return .testing }
        return state
    }
}

struct PromptMessage: Identifiable {
    var id: String
    var role: String // "system", "user", "assistant"
    var content: String
}

struct PromptTool: Identifiable {
    var id: String { name }
    var name: String
    var description: String?
}

struct PromptEditorView: View {
    var systemPrompt: String? = nil
    var userPrompt: String
    var model: String
    var tools: [PromptTool]
    var showTest: Bool = true
    var showTools: Bool = true
    var showTokenCount: Bool = true
    var messages: [PromptMessage]? = nil
    var testResult: String? = nil
    var testError: String? = nil
    var onSystemPromptChange: ((String) -> Void)? = nil
    var onUserPromptChange: ((String) -> Void)? = nil
    var onMessagesChange: (([PromptMessage]) -> Void)? = nil
    var onTest: (() -> Void)? = nil

    @State private var widgetState: PromptEditorWidgetState = .editing
    @State private var systemText: String = ""
    @State private var userText: String = ""
    @State private var messageList: [PromptMessage] = []
    @State private var lastTestResult: String? = nil
    @State private var lastTestError: String? = nil

    private static var nextMsgId: Int = 1

    private let roles: [String] = ["system", "user", "assistant"]
    private let roleLabels: [String: String] = ["system": "System", "user": "User", "assistant": "Assistant"]

    private func extractVariables(_ text: String) -> [String] {
        let pattern = "\\{\\{(\\w+)\\}\\}"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
        let range = NSRange(text.startIndex..., in: text)
        let matches = regex.matches(in: text, options: [], range: range)
        var found = Set<String>()
        for match in matches {
            if let r = Range(match.range(at: 1), in: text) {
                found.insert(String(text[r]))
            }
        }
        return Array(found).sorted()
    }

    private func estimateTokens(_ text: String) -> Int {
        max(1, text.count / 4)
    }

    private var allText: String {
        var total = systemText + userText
        for msg in messageList { total += msg.content }
        return total
    }

    private var tokenCount: Int { estimateTokens(allText) }

    private var detectedVariables: [String] { extractVariables(allText) }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // System prompt block
            VStack(alignment: .leading, spacing: 4) {
                Text("System")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.blue)
                TextEditor(text: $systemText)
                    .font(.system(.body, design: .monospaced))
                    .frame(minHeight: 60)
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color.gray.opacity(0.3), lineWidth: 1))
                    .accessibilityLabel("System prompt")
                    .onChange(of: systemText) { onSystemPromptChange?($0) }
            }

            // User prompt block
            VStack(alignment: .leading, spacing: 4) {
                Text("User")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.green)
                TextEditor(text: $userText)
                    .font(.system(.body, design: .monospaced))
                    .frame(minHeight: 100)
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color.gray.opacity(0.3), lineWidth: 1))
                    .accessibilityLabel("User prompt")
                    .onChange(of: userText) { onUserPromptChange?($0) }
            }

            // Additional message blocks
            ForEach(Array(messageList.enumerated()), id: \.element.id) { index, msg in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Picker("Role", selection: Binding(
                            get: { messageList[index].role },
                            set: { newRole in
                                messageList[index].role = newRole
                                onMessagesChange?(messageList)
                            }
                        )) {
                            ForEach(roles, id: \.self) { r in
                                Text(roleLabels[r] ?? r).tag(r)
                            }
                        }
                        .pickerStyle(.menu)
                        .accessibilityLabel("Message \(index + 1) role")

                        Spacer()

                        HStack(spacing: 4) {
                            Button {
                                guard index > 0 else { return }
                                messageList.swapAt(index, index - 1)
                                onMessagesChange?(messageList)
                            } label: {
                                Image(systemName: "arrow.up")
                                    .font(.caption)
                            }
                            .disabled(index == 0)
                            .accessibilityLabel("Move message up")

                            Button {
                                guard index < messageList.count - 1 else { return }
                                messageList.swapAt(index, index + 1)
                                onMessagesChange?(messageList)
                            } label: {
                                Image(systemName: "arrow.down")
                                    .font(.caption)
                            }
                            .disabled(index == messageList.count - 1)
                            .accessibilityLabel("Move message down")

                            Button {
                                messageList.remove(at: index)
                                onMessagesChange?(messageList)
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.caption)
                                    .foregroundColor(.red)
                            }
                            .accessibilityLabel("Remove message \(index + 1)")
                        }
                    }

                    TextEditor(text: Binding(
                        get: { messageList[index].content },
                        set: { newContent in
                            messageList[index].content = newContent
                            onMessagesChange?(messageList)
                        }
                    ))
                    .font(.system(.body, design: .monospaced))
                    .frame(minHeight: 60)
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color.gray.opacity(0.3), lineWidth: 1))
                    .accessibilityLabel("\(roleLabels[msg.role] ?? msg.role) message content")
                }
                .padding(8)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.gray.opacity(0.2), lineWidth: 1))
            }

            // Add message button
            Button("+ Add Message") {
                PromptEditorView.nextMsgId += 1
                let newMsg = PromptMessage(id: "msg-\(PromptEditorView.nextMsgId)", role: "user", content: "")
                messageList.append(newMsg)
                onMessagesChange?(messageList)
            }
            .accessibilityLabel("Add message")

            // Variable pills
            HStack(spacing: 4) {
                if detectedVariables.isEmpty {
                    Text("No template variables detected")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else {
                    ForEach(detectedVariables, id: \.self) { variable in
                        Text("{{\(variable)}}")
                            .font(.caption)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(Color.blue.opacity(0.15))
                            .foregroundColor(.blue)
                            .cornerRadius(12)
                            .accessibilityLabel("Variable: \(variable)")
                    }
                }
            }

            // Model badge
            Text(model)
                .font(.caption)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.secondary.opacity(0.15))
                .cornerRadius(4)

            // Token count
            if showTokenCount {
                Text("~\(tokenCount) tokens")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            // Test button
            if showTest {
                Button(widgetState == .testing ? "Testing..." : "Test Prompt") {
                    widgetState = promptEditorReduce(state: widgetState, event: .test)
                    onTest?()
                }
                .disabled(widgetState == .testing)
                .accessibilityLabel("Test prompt")
            }

            // Test result panel
            if widgetState == .viewing, let result = lastTestResult {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Test Result")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                        Spacer()
                        Button("Edit") {
                            widgetState = promptEditorReduce(state: widgetState, event: .edit)
                        }
                        .accessibilityLabel("Back to editing")
                    }
                    Text(result)
                        .font(.system(.caption, design: .monospaced))
                        .padding(8)
                        .background(Color.gray.opacity(0.05))
                        .cornerRadius(4)
                }
                .padding(8)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.gray.opacity(0.2), lineWidth: 1))
            }

            if let error = lastTestError {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.red)
                    .padding(8)
                    .background(Color.red.opacity(0.1))
                    .cornerRadius(4)
                    .accessibilityRole(.alert)
            }

            // Tool list
            if showTools && !tools.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Tools (\(tools.count))")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                    ForEach(tools) { tool in
                        HStack(spacing: 8) {
                            Text(tool.name)
                                .font(.system(.caption, design: .monospaced))
                            if let desc = tool.description {
                                Text(desc)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Prompt editor")
        .onAppear {
            systemText = systemPrompt ?? ""
            userText = userPrompt
            messageList = messages ?? []
            lastTestResult = testResult
            lastTestError = testError
        }
        .onChange(of: testResult) { newResult in
            if let result = newResult, widgetState == .testing {
                lastTestResult = result
                widgetState = promptEditorReduce(state: widgetState, event: .testComplete)
            }
        }
        .onChange(of: testError) { newError in
            if let error = newError, widgetState == .testing {
                lastTestError = error
                widgetState = promptEditorReduce(state: widgetState, event: .testError)
            }
        }
    }
}

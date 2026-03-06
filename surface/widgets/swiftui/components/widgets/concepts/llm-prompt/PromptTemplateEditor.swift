import SwiftUI

enum PromptTemplateEditorWidgetState {
    case editing, messageSelected, compiling
}

enum PromptTemplateEditorEvent {
    case addMessage, removeMessage, reorder, compile, selectMessage, deselect, compileComplete, compileError
}

func promptTemplateEditorReduce(state: PromptTemplateEditorWidgetState, event: PromptTemplateEditorEvent) -> PromptTemplateEditorWidgetState {
    switch state {
    case .editing:
        if event == .compile { return .compiling }
        if event == .selectMessage { return .messageSelected }
        return state
    case .messageSelected:
        if event == .deselect { return .editing }
        if event == .selectMessage { return .messageSelected }
        return state
    case .compiling:
        if event == .compileComplete { return .editing }
        if event == .compileError { return .editing }
        return state
    }
}

struct PTEMessage: Identifiable {
    let id = UUID()
    var role: String
    var content: String
}

struct PTEVariable: Identifiable {
    let id = UUID()
    var name: String
    var type: String
    var defaultValue: String?
    var description: String?
}

struct PromptTemplateEditorView: View {
    var initialMessages: [PTEMessage]? = nil
    var variables: [PTEVariable] = []
    var modelId: String? = nil
    var showParameters: Bool = true
    var showTokenCount: Bool = true
    var maxMessages: Int = 20
    var onMessagesChange: (([PTEMessage]) -> Void)? = nil
    var onCompile: (([PTEMessage], [String: String]) -> Void)? = nil

    @State private var widgetState: PromptTemplateEditorWidgetState = .editing
    @State private var messages: [PTEMessage] = []
    @State private var selectedIndex: Int? = nil
    @State private var previewMode: Bool = false
    @State private var variableValues: [String: String] = [:]

    private func extractVariables(from content: String) -> [String] {
        let pattern = "\\{\\{(\\w+)\\}\\}"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
        let range = NSRange(content.startIndex..., in: content)
        let matches = regex.matches(in: content, options: [], range: range)
        var found: [String] = []
        for match in matches {
            if let r = Range(match.range(at: 1), in: content) {
                let name = String(content[r])
                if !found.contains(name) { found.append(name) }
            }
        }
        return found
    }

    private var allDetectedVarNames: [String] {
        var found = Set<String>()
        for msg in messages { found.formUnion(extractVariables(from: msg.content)) }
        found.formUnion(variables.map { $0.name })
        return Array(found).sorted()
    }

    private var resolvedValues: [String: String] {
        var result: [String: String] = [:]
        for name in allDetectedVarNames {
            result[name] = variableValues[name].flatMap { $0.isEmpty ? nil : $0 }
                ?? variables.first(where: { $0.name == name })?.defaultValue ?? ""
        }
        return result
    }

    private func resolveTemplate(_ content: String) -> String {
        var result = content
        for (key, value) in resolvedValues {
            result = result.replacingOccurrences(of: "{{\(key)}}", with: value)
        }
        return result
    }

    private var totalContent: String { messages.map { $0.content }.joined(separator: "\n") }
    private var charCount: Int { totalContent.count }
    private var tokenCount: Int { max(1, totalContent.count / 4) }

    private let roles = ["system", "user", "assistant"]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Button(previewMode ? "Edit" : "Preview") {
                    previewMode.toggle()
                }
                .accessibilityLabel("Toggle preview")

                Button(widgetState == .compiling ? "Compiling..." : "Compile") {
                    widgetState = promptTemplateEditorReduce(state: widgetState, event: .compile)
                    onCompile?(messages, resolvedValues)
                    widgetState = promptTemplateEditorReduce(state: widgetState, event: .compileComplete)
                }
                .disabled(widgetState == .compiling)
                .accessibilityLabel("Compile template")
            }

            ForEach(Array(messages.enumerated()), id: \.element.id) { index, msg in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Image(systemName: "line.3.horizontal")
                            .foregroundColor(.secondary)
                            .accessibilityHidden(true)

                        Picker("Role", selection: Binding(
                            get: { messages[index].role },
                            set: { newRole in
                                messages[index].role = newRole
                                onMessagesChange?(messages)
                            }
                        )) {
                            ForEach(roles, id: \.self) { role in
                                Text(role).tag(role)
                            }
                        }
                        .pickerStyle(.menu)
                        .accessibilityLabel("Role for message \(index + 1)")

                        Spacer()

                        Button("Delete") {
                            guard messages.count > 1 else { return }
                            if selectedIndex == index {
                                selectedIndex = nil
                                widgetState = promptTemplateEditorReduce(state: widgetState, event: .deselect)
                            }
                            messages.remove(at: index)
                            onMessagesChange?(messages)
                        }
                        .disabled(messages.count <= 1)
                        .accessibilityLabel("Remove message \(index + 1)")
                    }

                    if previewMode {
                        Text(resolveTemplate(msg.content))
                            .font(.system(.body, design: .monospaced))
                            .padding(8)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.gray.opacity(0.1))
                            .cornerRadius(4)
                    } else {
                        TextEditor(text: Binding(
                            get: { messages[index].content },
                            set: { newContent in
                                messages[index].content = newContent
                                onMessagesChange?(messages)
                            }
                        ))
                        .font(.system(.body, design: .monospaced))
                        .frame(minHeight: 80)
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(selectedIndex == index ? Color.accentColor : Color.gray.opacity(0.3), lineWidth: selectedIndex == index ? 2 : 1)
                        )
                        .accessibilityLabel("Template content for \(msg.role) message \(index + 1)")
                        .onTapGesture {
                            selectedIndex = index
                            widgetState = promptTemplateEditorReduce(state: widgetState, event: .selectMessage)
                        }

                        let vars = extractVariables(from: msg.content)
                        if !vars.isEmpty {
                            HStack(spacing: 4) {
                                ForEach(vars, id: \.self) { varName in
                                    let declared = variables.first(where: { $0.name == varName })
                                    HStack(spacing: 2) {
                                        Text(varName).font(.caption)
                                        if let decl = declared {
                                            Text(": \(decl.type)")
                                                .font(.caption2)
                                                .opacity(0.7)
                                        }
                                    }
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 2)
                                    .background(Color.blue.opacity(0.15))
                                    .foregroundColor(.blue)
                                    .cornerRadius(12)
                                }
                            }
                        }
                    }
                }
                .padding(8)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(selectedIndex == index ? Color.accentColor : Color.gray.opacity(0.2), lineWidth: selectedIndex == index ? 2 : 1)
                )
            }

            Button("+ Add Message") {
                guard messages.count < maxMessages else { return }
                messages.append(PTEMessage(role: "user", content: ""))
                onMessagesChange?(messages)
            }
            .disabled(messages.count >= maxMessages)
            .accessibilityLabel("Add message")

            if !allDetectedVarNames.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Variables").font(.headline)
                    ForEach(allDetectedVarNames, id: \.self) { varName in
                        let declared = variables.first(where: { $0.name == varName })
                        HStack(spacing: 8) {
                            VStack(alignment: .leading, spacing: 0) {
                                Text("{{\(varName)}}")
                                    .font(.system(.caption, design: .monospaced))
                                if let decl = declared {
                                    Text("(\(decl.type))")
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                }
                            }
                            .frame(minWidth: 100, alignment: .leading)

                            TextField(
                                declared?.defaultValue ?? "",
                                text: Binding(
                                    get: { variableValues[varName] ?? "" },
                                    set: { variableValues[varName] = $0 }
                                )
                            )
                            .font(.system(.body, design: .monospaced))
                            .textFieldStyle(.roundedBorder)
                            .accessibilityLabel("Value for variable \(varName)")

                            if let desc = declared?.description {
                                Image(systemName: "questionmark.circle")
                                    .foregroundColor(.secondary)
                                    .help(desc)
                            }
                        }
                    }
                }
                .padding(12)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.gray.opacity(0.2), lineWidth: 1))
            }

            if showParameters {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Parameters").font(.headline)
                    HStack(spacing: 8) {
                        Text("Model:").font(.caption)
                        Text(modelId ?? "")
                            .font(.system(.caption, design: .monospaced))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.secondary.opacity(0.1))
                            .cornerRadius(4)
                    }
                }
                .padding(12)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.gray.opacity(0.2), lineWidth: 1))
            }

            if showTokenCount {
                Text("\(charCount) chars | ~\(tokenCount) tokens")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Prompt template editor")
        .onAppear {
            messages = initialMessages ?? [PTEMessage(role: "system", content: "")]
        }
    }
}

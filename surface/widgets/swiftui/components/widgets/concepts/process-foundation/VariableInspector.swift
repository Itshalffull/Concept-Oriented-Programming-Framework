import SwiftUI

enum VariableInspectorWidgetState {
    case idle, filtering, varSelected
}

enum VariableInspectorEvent {
    case search, selectVar, addWatch, clear, deselect
}

func variableInspectorReduce(state: VariableInspectorWidgetState, event: VariableInspectorEvent) -> VariableInspectorWidgetState {
    switch state {
    case .idle:
        if event == .search { return .filtering }
        if event == .selectVar { return .varSelected }
        return state
    case .filtering:
        if event == .clear { return .idle }
        if event == .selectVar { return .varSelected }
        return state
    case .varSelected:
        if event == .deselect { return .idle }
        if event == .selectVar { return .varSelected }
        return state
    }
}

struct ProcessVariable: Identifiable {
    var id: String { name }
    var name: String
    var type: String
    var value: String
    var scope: String? = nil
    var changed: Bool = false
}

struct WatchExpression: Identifiable {
    var id: String
    var expression: String
    var value: String? = nil
}

struct VariableInspectorView: View {
    var variables: [ProcessVariable]
    var runStatus: String
    var showTypes: Bool = true
    var showWatch: Bool = true
    var expandDepth: Int = 1
    var watchExpressions: [WatchExpression] = []
    var onSelectVariable: ((String) -> Void)? = nil
    var onAddWatch: ((String) -> Void)? = nil
    var onRemoveWatch: ((String) -> Void)? = nil

    @State private var widgetState: VariableInspectorWidgetState = .idle
    @State private var searchQuery: String = ""
    @State private var selectedVar: String? = nil
    @State private var focusIndex: Int = 0

    private func typeBadge(_ type: String) -> String {
        let map = ["string": "str", "number": "num", "boolean": "bool", "object": "obj", "array": "arr"]
        return map[type.lowercased()] ?? type
    }

    private var filteredVariables: [ProcessVariable] {
        if searchQuery.isEmpty { return variables }
        let q = searchQuery.lowercased()
        return variables.filter { $0.name.lowercased().contains(q) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Search bar
            HStack {
                TextField("Filter variables...", text: $searchQuery)
                    .textFieldStyle(.roundedBorder)
                    .accessibilityLabel("Filter variables by name")
                    .onChange(of: searchQuery) { newVal in
                        if newVal.isEmpty {
                            widgetState = variableInspectorReduce(state: widgetState, event: .clear)
                        } else {
                            widgetState = .idle
                            widgetState = variableInspectorReduce(state: widgetState, event: .search)
                        }
                    }

                if !searchQuery.isEmpty {
                    Button {
                        searchQuery = ""
                        widgetState = variableInspectorReduce(state: widgetState, event: .clear)
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.secondary)
                    }
                    .accessibilityLabel("Clear search")
                }
            }

            // Variable list
            if filteredVariables.isEmpty {
                Text(searchQuery.isEmpty ? "No variables available" : "No variables match the filter")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding()
            } else {
                LazyVStack(spacing: 4) {
                    ForEach(filteredVariables) { variable in
                        HStack(spacing: 8) {
                            Text(variable.name)
                                .font(.system(.body, design: .monospaced))
                                .fontWeight(selectedVar == variable.name ? .bold : .regular)

                            if showTypes {
                                Text(typeBadge(variable.type))
                                    .font(.caption2)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.secondary.opacity(0.15))
                                    .cornerRadius(4)
                            }

                            if let scope = variable.scope {
                                Text(scope)
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                                    .accessibilityLabel("Scope: \(scope)")
                            }

                            Spacer()

                            Text(variable.value)
                                .font(.system(.caption, design: .monospaced))
                                .lineLimit(1)
                                .foregroundColor(.secondary)

                            if variable.changed {
                                Circle()
                                    .fill(Color.blue)
                                    .frame(width: 6, height: 6)
                                    .accessibilityLabel("Value changed")
                            }
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: 4)
                                .fill(selectedVar == variable.name ? Color.accentColor.opacity(0.1) : Color.clear)
                        )
                        .contentShape(Rectangle())
                        .onTapGesture {
                            selectedVar = variable.name
                            widgetState = variableInspectorReduce(state: .idle, event: .selectVar)
                            onSelectVariable?(variable.name)
                        }
                        .accessibilityLabel("\(variable.name): \(variable.value)")
                    }
                }
            }

            // Watch list
            if showWatch {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("Watch Expressions")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                        Spacer()
                        Button("+ Watch") {
                            if let name = selectedVar, !name.isEmpty {
                                onAddWatch?(name)
                            }
                        }
                        .font(.caption)
                        .accessibilityLabel("Add watch expression")
                    }

                    ForEach(watchExpressions) { watch in
                        HStack {
                            Text(watch.expression)
                                .font(.system(.caption, design: .monospaced))
                            Spacer()
                            Text(watch.value ?? "evaluating...")
                                .font(.system(.caption, design: .monospaced))
                                .foregroundColor(.secondary)
                            Button {
                                onRemoveWatch?(watch.id)
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                            .accessibilityLabel("Remove watch: \(watch.expression)")
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                    }
                }
                .padding(8)
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color.gray.opacity(0.2), lineWidth: 1)
                )
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Variable inspector")
    }
}

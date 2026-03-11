import SwiftUI

// State machine: idle | variableSelected
enum VariableInspectorWatchState {
    case idle
    case variableSelected
}

enum VariableInspectorWatchEvent {
    case selectVariable
    case deselect
}

func variableInspectorWatchReduce(_ state: VariableInspectorWatchState, _ event: VariableInspectorWatchEvent) -> VariableInspectorWatchState {
    switch state {
    case .idle:
        if case .selectVariable = event { return .variableSelected }
        return state
    case .variableSelected:
        if case .deselect = event { return .idle }
        if case .selectVariable = event { return .variableSelected }
        return state
    }
}

struct VariableEntryData: Identifiable {
    let id: String
    let name: String
    let value: String
    var type: String? = nil
    var scope: String? = nil
    var isModified: Bool = false
}

struct VariableInspectorWatchView: View {
    let variables: [VariableEntryData]
    var title: String = "Variables"
    var showTypes: Bool = true

    @State private var state: VariableInspectorWatchState = .idle
    @State private var selectedId: String? = nil
    @State private var searchText: String = ""

    private var filteredVariables: [VariableEntryData] {
        if searchText.isEmpty { return variables }
        return variables.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            $0.value.localizedCaseInsensitiveContains(searchText)
        }
    }

    private func typeColor(_ type: String?) -> Color {
        switch type {
        case "string": return .green
        case "number", "int", "float": return .blue
        case "boolean", "bool": return .orange
        case "object": return .purple
        case "array": return .cyan
        default: return .secondary
        }
    }

    var body: some View {
        VStack(spacing: 4) {
            // Header
            HStack {
                Text(title)
                    .font(.caption2)
                    .fontWeight(.bold)
                Spacer()
                Text("\(variables.count)")
                    .font(.system(size: 8))
                    .foregroundColor(.secondary)
            }

            // Variable list
            List {
                ForEach(filteredVariables) { variable in
                    Button {
                        if selectedId == variable.id {
                            selectedId = nil
                            state = variableInspectorWatchReduce(state, .deselect)
                        } else {
                            selectedId = variable.id
                            state = variableInspectorWatchReduce(state, .selectVariable)
                        }
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 3) {
                                // Modified indicator
                                if variable.isModified {
                                    Circle()
                                        .fill(Color.orange)
                                        .frame(width: 4, height: 4)
                                }

                                // Name
                                Text(variable.name)
                                    .font(.system(size: 9, weight: .semibold, design: .monospaced))
                                    .lineLimit(1)

                                Spacer()

                                // Type badge
                                if showTypes, let type = variable.type {
                                    Text(type)
                                        .font(.system(size: 7))
                                        .foregroundColor(typeColor(type))
                                }
                            }

                            // Value
                            Text(variable.value)
                                .font(.system(size: 8, design: .monospaced))
                                .foregroundColor(.secondary)
                                .lineLimit(selectedId == variable.id ? nil : 1)

                            // Selected detail
                            if selectedId == variable.id {
                                VStack(alignment: .leading, spacing: 1) {
                                    if let type = variable.type {
                                        Text("Type: \(type)")
                                            .font(.system(size: 7))
                                            .foregroundColor(typeColor(type))
                                    }
                                    if let scope = variable.scope {
                                        Text("Scope: \(scope)")
                                            .font(.system(size: 7))
                                            .foregroundColor(.secondary)
                                    }
                                    if variable.isModified {
                                        Text("Modified")
                                            .font(.system(size: 7))
                                            .foregroundColor(.orange)
                                    }
                                }
                                .padding(.top, 2)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                    .listRowBackground(selectedId == variable.id ? Color.blue.opacity(0.1) : Color.clear)
                }
            }
            .listStyle(.plain)
            .searchable(text: $searchText, prompt: "Search")
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Variable inspector, \(variables.count) variables")
    }
}

import SwiftUI

enum ExpressionToggleInputWidgetState {
    case fixed, expression, autocompleting
}

enum ExpressionToggleInputEvent {
    case toggle, input, showAC, select, dismiss
}

func expressionToggleInputReduce(state: ExpressionToggleInputWidgetState, event: ExpressionToggleInputEvent) -> ExpressionToggleInputWidgetState {
    switch state {
    case .fixed:
        if event == .toggle { return .expression }
        return state
    case .expression:
        if event == .toggle { return .fixed }
        if event == .showAC { return .autocompleting }
        return state
    case .autocompleting:
        if event == .select { return .expression }
        if event == .dismiss { return .expression }
        return state
    }
}

struct ExpressionToggleInputView: View {
    var value: String
    var mode: String
    var fieldType: String = "text" // "text", "number", "boolean", "object"
    var variables: [String] = []
    var expression: String = ""
    var previewValue: String? = nil
    var expressionValid: Bool? = nil
    var onChange: ((String) -> Void)? = nil
    var onExpressionChange: ((String) -> Void)? = nil
    var onToggleMode: ((String) -> Void)? = nil

    @State private var widgetState: ExpressionToggleInputWidgetState = .fixed
    @State private var fixedValue: String = ""
    @State private var expressionValue: String = ""
    @State private var acQuery: String = ""
    @State private var acIndex: Int = 0

    private var isExpressionMode: Bool { widgetState != .fixed }

    private var suggestions: [String] {
        if acQuery.isEmpty { return variables }
        let q = acQuery.lowercased()
        return variables.filter { $0.lowercased().contains(q) }
    }

    private func handleToggle() {
        let newMode: String = widgetState == .fixed ? "expression" : "fixed"
        widgetState = expressionToggleInputReduce(state: widgetState, event: .toggle)
        onToggleMode?(newMode)
    }

    private func handleFixedChange(_ newValue: String) {
        fixedValue = newValue
        onChange?(newValue)
    }

    private func handleExpressionChange(_ newExpr: String) {
        expressionValue = newExpr
        onExpressionChange?(newExpr)

        let parts = newExpr.components(separatedBy: CharacterSet(charactersIn: " ()+\\-*/,"))
        let lastWord = parts.last ?? ""
        if !lastWord.isEmpty && variables.contains(where: { $0.lowercased().hasPrefix(lastWord.lowercased()) }) {
            acQuery = lastWord
            acIndex = 0
            widgetState = expressionToggleInputReduce(state: widgetState, event: .showAC)
        }
    }

    private func selectSuggestion(_ variable: String) {
        let parts = expressionValue.components(separatedBy: CharacterSet(charactersIn: " ()+\\-*/,"))
        let lastPart = parts.last ?? ""
        let newExpr = String(expressionValue.dropLast(lastPart.count)) + variable
        expressionValue = newExpr
        onExpressionChange?(newExpr)
        widgetState = expressionToggleInputReduce(state: widgetState, event: .select)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Mode toggle
            Button(isExpressionMode ? "Expression" : "Fixed") {
                handleToggle()
            }
            .accessibilityLabel("Expression mode")
            .accessibilityValue(isExpressionMode ? "on" : "off")
            .accessibilityRole(.toggleButton)

            // Fixed value input
            if !isExpressionMode {
                switch fieldType {
                case "boolean":
                    Toggle(fixedValue == "true" ? "true" : "false", isOn: Binding(
                        get: { fixedValue == "true" },
                        set: { handleFixedChange(String($0)) }
                    ))
                    .accessibilityLabel("Fixed boolean value")

                case "number":
                    TextField("Number", text: Binding(
                        get: { fixedValue },
                        set: { handleFixedChange($0) }
                    ))
                    .textFieldStyle(.roundedBorder)
                    .accessibilityLabel("Fixed number value")

                case "object":
                    TextEditor(text: Binding(
                        get: { fixedValue },
                        set: { handleFixedChange($0) }
                    ))
                    .font(.system(.body, design: .monospaced))
                    .frame(minHeight: 80)
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color.gray.opacity(0.3), lineWidth: 1))
                    .accessibilityLabel("Fixed object value (JSON)")

                default:
                    TextField("Value", text: Binding(
                        get: { fixedValue },
                        set: { handleFixedChange($0) }
                    ))
                    .textFieldStyle(.roundedBorder)
                    .accessibilityLabel("Fixed text value")
                }
            }

            // Expression editor
            if isExpressionMode {
                TextEditor(text: Binding(
                    get: { expressionValue },
                    set: { handleExpressionChange($0) }
                ))
                .font(.system(.body, design: .monospaced))
                .frame(minHeight: 60)
                .overlay(
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(expressionValid == false ? Color.red : Color.gray.opacity(0.3), lineWidth: 1)
                )
                .accessibilityLabel("Expression editor")
            }

            // Autocomplete dropdown
            if widgetState == .autocompleting {
                VStack(alignment: .leading, spacing: 0) {
                    if suggestions.isEmpty {
                        Text("No matching variables")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .padding(8)
                    } else {
                        ForEach(Array(suggestions.enumerated()), id: \.element) { index, variable in
                            Text(variable)
                                .font(.system(.body, design: .monospaced))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(acIndex == index ? Color.accentColor.opacity(0.15) : Color.clear)
                                .onTapGesture { selectSuggestion(variable) }
                                .onHover { hovering in
                                    if hovering { acIndex = index }
                                }
                                .accessibilityLabel(variable)
                                .accessibilityValue(acIndex == index ? "focused" : "")
                        }
                    }
                }
                .background(Color(.systemBackground))
                .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color.gray.opacity(0.3), lineWidth: 1))
                .accessibilityLabel("Variable suggestions")
            }

            // Live preview
            if isExpressionMode {
                if let preview = previewValue {
                    Text(preview)
                        .font(.caption)
                        .foregroundColor(expressionValid == false ? .red : .green)
                        .accessibilityLabel("Preview: \(preview)")
                } else if !expressionValue.isEmpty {
                    Text("Enter expression to preview")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Expression toggle input")
        .onAppear {
            fixedValue = value
            expressionValue = expression
        }
    }
}

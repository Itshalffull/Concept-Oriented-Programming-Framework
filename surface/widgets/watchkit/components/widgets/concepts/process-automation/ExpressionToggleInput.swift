import SwiftUI

// State machine: fixed | expression (simplified for watch, no autocomplete)
enum ExpressionToggleInputWatchState {
    case fixed
    case expression
}

enum ExpressionToggleInputWatchEvent {
    case toggle
    case input
}

func expressionToggleInputWatchReduce(_ state: ExpressionToggleInputWatchState, _ event: ExpressionToggleInputWatchEvent) -> ExpressionToggleInputWatchState {
    switch state {
    case .fixed:
        switch event {
        case .toggle: return .expression
        case .input: return .fixed
        }
    case .expression:
        switch event {
        case .toggle: return .fixed
        case .input: return .expression
        }
    }
}

struct ExpressionToggleInputWatchView: View {
    @Binding var value: String
    var fieldType: String = "text" // "text", "number", "boolean"
    var expression: String = ""
    var previewValue: String? = nil
    var expressionValid: Bool? = nil
    var onToggleMode: ((String) -> Void)? = nil
    var onChange: ((String) -> Void)? = nil
    var onExpressionChange: ((String) -> Void)? = nil

    @State private var state: ExpressionToggleInputWatchState = .fixed
    @State private var expressionText: String = ""

    private var isExpression: Bool {
        state == .expression
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Mode toggle
            Button {
                state = expressionToggleInputWatchReduce(state, .toggle)
                onToggleMode?(isExpression ? "expression" : "fixed")
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: isExpression ? "function" : "textformat")
                        .font(.system(size: 9))
                        .foregroundColor(.blue)
                    Text(isExpression ? "Expression" : "Fixed")
                        .font(.system(size: 9, weight: .semibold))
                    Spacer()
                    Image(systemName: "arrow.left.arrow.right")
                        .font(.system(size: 8))
                        .foregroundColor(.secondary)
                }
            }
            .buttonStyle(.plain)

            if !isExpression {
                // Fixed mode input
                switch fieldType {
                case "boolean":
                    Toggle(isOn: Binding(
                        get: { value == "true" },
                        set: { newVal in
                            value = String(newVal)
                            onChange?(value)
                        }
                    )) {
                        Text(value == "true" ? "true" : "false")
                            .font(.system(size: 9, design: .monospaced))
                    }
                    .toggleStyle(.switch)

                case "number":
                    TextField("0", text: $value)
                        .font(.system(size: 9, design: .monospaced))
                        .onChange(of: value) { _, newVal in
                            onChange?(newVal)
                        }

                default:
                    TextField("Value", text: $value)
                        .font(.system(size: 9))
                        .onChange(of: value) { _, newVal in
                            onChange?(newVal)
                        }
                }
            } else {
                // Expression mode
                TextField("Expression...", text: $expressionText)
                    .font(.system(size: 9, design: .monospaced))
                    .onChange(of: expressionText) { _, newVal in
                        onExpressionChange?(newVal)
                    }

                // Preview
                if let preview = previewValue {
                    HStack(spacing: 3) {
                        Image(systemName: "arrow.right")
                            .font(.system(size: 7))
                            .foregroundColor(.secondary)
                        Text(preview)
                            .font(.system(size: 8, design: .monospaced))
                            .foregroundColor(expressionValid == false ? .red : .green)
                    }
                }

                // Validity indicator
                if let valid = expressionValid {
                    HStack(spacing: 2) {
                        Image(systemName: valid ? "checkmark.circle" : "xmark.circle")
                            .font(.system(size: 7))
                            .foregroundColor(valid ? .green : .red)
                        Text(valid ? "Valid" : "Invalid")
                            .font(.system(size: 7))
                            .foregroundColor(valid ? .green : .red)
                    }
                }
            }
        }
        .onAppear {
            expressionText = expression
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Expression toggle input, \(isExpression ? "expression" : "fixed") mode")
    }
}

import SwiftUI

enum GuardrailConfigWidgetState {
    case viewing, ruleSelected, testing, adding
}

enum GuardrailConfigEvent {
    case selectRule, test, addRule, deselect, testComplete, save, cancel
}

func guardrailConfigReduce(state: GuardrailConfigWidgetState, event: GuardrailConfigEvent) -> GuardrailConfigWidgetState {
    switch state {
    case .viewing:
        if event == .selectRule { return .ruleSelected }
        if event == .test { return .testing }
        if event == .addRule { return .adding }
        return state
    case .ruleSelected:
        if event == .deselect { return .viewing }
        return state
    case .testing:
        if event == .testComplete { return .viewing }
        return state
    case .adding:
        if event == .save { return .viewing }
        if event == .cancel { return .viewing }
        return state
    }
}

struct GuardrailRule: Identifiable {
    var id: String
    var name: String
    var description: String
    var enabled: Bool
    var type: String // "input", "output", "both"
    var severity: String // "block", "warn", "log"
}

struct GuardrailTestResult: Identifiable {
    var id: String { ruleId }
    var ruleId: String
    var ruleName: String
    var triggered: Bool
    var severity: String
}

struct GuardrailConfigView: View {
    var rules: [GuardrailRule]
    var name: String
    var guardrailType: String
    var testInput: String = ""
    var showHistory: Bool = true
    var showTest: Bool = true
    var onRuleToggle: ((String, Bool) -> Void)? = nil
    var onSeverityChange: ((String, String) -> Void)? = nil
    var onTest: ((String) -> [GuardrailTestResult])? = nil
    var onAddRule: (() -> Void)? = nil

    @State private var widgetState: GuardrailConfigWidgetState = .viewing
    @State private var selectedRuleId: String? = nil
    @State private var testValue: String = ""
    @State private var testResults: [GuardrailTestResult] = []

    private let severityOptions = ["block", "warn", "log"]

    private func severityColor(_ severity: String) -> Color {
        switch severity {
        case "block": return .red
        case "warn": return .orange
        case "log": return .blue
        default: return .secondary
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Text(name)
                    .font(.headline)
                Text(guardrailType)
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Color.secondary.opacity(0.15))
                    .cornerRadius(4)
                    .accessibilityLabel("Type: \(guardrailType)")
            }

            // Rule list
            ForEach(rules) { rule in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Button(rule.enabled ? "On" : "Off") {
                            onRuleToggle?(rule.id, !rule.enabled)
                        }
                        .accessibilityLabel("Toggle \(rule.name)")
                        .accessibilityValue(rule.enabled ? "enabled" : "disabled")
                        .accessibilityRole(.toggleButton)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(rule.name)
                                .font(.body)
                                .fontWeight(.medium)
                            Text(rule.description)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }

                        Spacer()

                        Text(rule.type)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.secondary.opacity(0.1))
                            .cornerRadius(4)
                            .accessibilityLabel("Applies to: \(rule.type)")
                    }

                    // Severity selector
                    HStack(spacing: 4) {
                        ForEach(severityOptions, id: \.self) { sev in
                            Button(sev) {
                                onSeverityChange?(rule.id, sev)
                            }
                            .font(.caption)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(rule.severity == sev ? severityColor(sev).opacity(0.2) : Color.clear)
                            .overlay(
                                RoundedRectangle(cornerRadius: 4)
                                    .stroke(rule.severity == sev ? severityColor(sev) : Color.gray.opacity(0.3), lineWidth: 1)
                            )
                            .cornerRadius(4)
                            .accessibilityLabel("Set severity to \(sev)")
                            .accessibilityValue(rule.severity == sev ? "selected" : "")
                        }
                    }

                    if showHistory {
                        Rectangle()
                            .fill(Color.gray.opacity(0.1))
                            .frame(height: 20)
                            .cornerRadius(2)
                            .accessibilityHidden(true)
                    }
                }
                .padding(8)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(selectedRuleId == rule.id ? Color.accentColor : Color.gray.opacity(0.2), lineWidth: selectedRuleId == rule.id ? 2 : 1)
                )
                .onTapGesture {
                    selectedRuleId = rule.id
                    widgetState = guardrailConfigReduce(state: widgetState, event: .selectRule)
                }
                .accessibilityLabel("\(rule.name) \u{2014} \(rule.severity)")
            }

            // Add rule button
            Button("Add Rule") {
                widgetState = guardrailConfigReduce(state: widgetState, event: .addRule)
                onAddRule?()
            }
            .accessibilityLabel("Add new custom rule")

            // Test area
            if showTest {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Rule Tester")
                        .font(.subheadline)
                        .fontWeight(.semibold)

                    TextEditor(text: $testValue)
                        .frame(minHeight: 60)
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                        )
                        .accessibilityLabel("Test input for validating rules")

                    Button(widgetState == .testing ? "Testing..." : "Test") {
                        guard !testValue.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                        widgetState = guardrailConfigReduce(state: widgetState, event: .test)
                        if let results = onTest?(testValue) {
                            testResults = results
                        }
                        widgetState = guardrailConfigReduce(state: widgetState, event: .testComplete)
                    }
                    .disabled(widgetState == .testing || testValue.trimmingCharacters(in: .whitespaces).isEmpty)
                    .accessibilityLabel("Test rules against input")

                    // Test results
                    if !testResults.isEmpty {
                        let triggered = testResults.filter { $0.triggered }
                        Text(triggered.isEmpty ? "All rules passed" : "\(triggered.count) rule\(triggered.count == 1 ? "" : "s") triggered")
                            .font(.caption)
                            .foregroundColor(triggered.isEmpty ? .green : .red)

                        ForEach(testResults) { result in
                            HStack {
                                Text(result.ruleName)
                                    .font(.caption)
                                Spacer()
                                Text(result.triggered ? result.severity : "pass")
                                    .font(.caption)
                                    .foregroundColor(result.triggered ? severityColor(result.severity) : .green)
                            }
                        }
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
        .accessibilityLabel("Guardrail config: \(name)")
        .onAppear {
            testValue = testInput
        }
    }
}

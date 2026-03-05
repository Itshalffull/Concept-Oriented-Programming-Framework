import SwiftUI

// State machine: idle | copied
enum FormulaDisplayWatchState {
    case idle
    case copied
}

enum FormulaDisplayWatchEvent {
    case copy
    case timeout
}

func formulaDisplayWatchReduce(_ state: FormulaDisplayWatchState, _ event: FormulaDisplayWatchEvent) -> FormulaDisplayWatchState {
    switch state {
    case .idle:
        if case .copy = event { return .copied }
        return state
    case .copied:
        if case .timeout = event { return .idle }
        return state
    }
}

struct FormulaDisplayWatchView: View {
    let formula: String
    let language: String
    var scope: String? = nil
    var name: String? = nil
    var description: String? = nil

    @State private var state: FormulaDisplayWatchState = .idle
    @State private var isExpanded: Bool = false

    private let collapseThreshold = 100

    private var languageLabel: String {
        switch language {
        case "smtlib": return "SMT-LIB"
        case "tlaplus": return "TLA+"
        case "alloy": return "Alloy"
        case "lean": return "Lean"
        case "dafny": return "Dafny"
        case "cvl": return "CVL"
        default: return language.uppercased()
        }
    }

    private var displayFormula: String {
        if formula.count > collapseThreshold && !isExpanded {
            return String(formula.prefix(collapseThreshold)) + "\u{2026}"
        }
        return formula
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                // Header
                HStack(spacing: 4) {
                    Text(languageLabel)
                        .font(.system(size: 9, design: .monospaced))
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .overlay(
                            RoundedRectangle(cornerRadius: 3)
                                .stroke(Color.secondary, lineWidth: 0.5)
                        )

                    if let scope = scope {
                        Text(scope)
                            .font(.system(size: 9))
                            .foregroundColor(.secondary)
                    }

                    Spacer()
                }

                if let name = name {
                    Text(name)
                        .font(.caption2)
                        .fontWeight(.semibold)
                }

                // Formula text
                Text(displayFormula)
                    .font(.system(size: 9, design: .monospaced))
                    .lineLimit(isExpanded ? nil : 6)

                // Expand toggle
                if formula.count > collapseThreshold {
                    Button(isExpanded ? "Show less" : "Show more") {
                        isExpanded.toggle()
                    }
                    .font(.caption2)
                    .foregroundColor(.blue)
                }

                // Description
                if let description = description {
                    Divider()
                    Text(description)
                        .font(.system(size: 9))
                        .foregroundColor(.secondary)
                }
            }
            .padding(.horizontal, 4)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Formula in \(languageLabel)\(name != nil ? ": \(name!)" : "")")
    }
}

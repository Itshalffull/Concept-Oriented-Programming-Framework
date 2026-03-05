import SwiftUI

enum FormulaLanguage: String, CaseIterable {
    case smtlib, tlaplus, alloy, lean, dafny, cvl
    var displayName: String {
        switch self {
        case .smtlib: return "SMT-LIB"
        case .tlaplus: return "TLA+"
        case .alloy: return "Alloy"
        case .lean: return "Lean"
        case .dafny: return "Dafny"
        case .cvl: return "CVL"
        }
    }
}

enum FormulaDisplayWidgetState { case idle, copied, rendering }

struct FormulaDisplayView: View {
    let formula: String
    var language: FormulaLanguage = .smtlib
    var scope: String?
    var renderLatex: Bool = false
    var name: String?
    var formulaDescription: String?

    @State private var widgetState: FormulaDisplayWidgetState = .idle
    @State private var expanded: Bool = false
    @State private var descriptionOpen: Bool = false

    private let collapseThreshold = 200
    private var isLong: Bool { formula.count > collapseThreshold }
    private var displayFormula: String {
        isLong && !expanded ? String(formula.prefix(collapseThreshold)) + "\u{2026}" : formula
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(language.displayName)
                    .font(.system(size: 12, design: .monospaced))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color.primary.opacity(0.5), lineWidth: 1))
                if let scope = scope { Text(scope).font(.caption).opacity(0.7) }
                Spacer()
                Button(widgetState == .copied ? "Copied!" : "Copy") {
                    widgetState = .copied
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { widgetState = .idle }
                }
                .buttonStyle(.bordered).controlSize(.small)
                .accessibilityLabel("Copy formula to clipboard")
            }
            if let name = name { Text(name).fontWeight(.semibold) }
            ScrollView(.horizontal, showsIndicators: false) {
                Text(displayFormula).font(.system(size: 13, design: .monospaced)).textSelection(.enabled).padding(8)
            }
            .background(Color.gray.opacity(0.08)).cornerRadius(4)
            if isLong {
                Button(expanded ? "Show less" : "Show more") { expanded.toggle() }
                    .font(.caption).buttonStyle(.plain)
            }
            if let desc = formulaDescription {
                Button(descriptionOpen ? "Hide description" : "Show description") { descriptionOpen.toggle() }
                    .font(.caption).buttonStyle(.plain)
                if descriptionOpen { Text(desc).font(.system(size: 14)).opacity(0.85) }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Formula in \(language.displayName)")
    }
}

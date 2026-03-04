// ============================================================
// Clef Surface AppKit Widget — TokenInput
//
// Text field that tokenizes input into removable tokens.
// Wraps NSTokenField for native token behavior.
// ============================================================

import AppKit

public class ClefTokenInput: NSTokenField {
    public var tokens: [String] = [] { didSet { objectValue = tokens as [AnyObject] } }
    public var onTokensChange: (([String]) -> Void)?

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        tokenStyle = .rounded
        delegate = self
    }
}

extension ClefTokenInput: NSTokenFieldDelegate {
    public func tokenField(_ tokenField: NSTokenField, shouldAdd tokens: [Any], at index: Int) -> [Any] {
        let strings = tokens.compactMap { $0 as? String }
        self.tokens.insert(contentsOf: strings, at: min(index, self.tokens.count))
        onTokensChange?(self.tokens)
        return tokens
    }
}

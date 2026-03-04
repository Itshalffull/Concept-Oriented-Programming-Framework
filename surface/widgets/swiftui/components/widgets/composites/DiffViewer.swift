// ============================================================
// Clef Surface SwiftUI Widget — DiffViewer
//
// Side-by-side or unified diff viewer for comparing two text
// versions with color-coded additions and removals.
// ============================================================

import SwiftUI

enum DiffMode { case unified, split }

struct DiffViewerView: View {
    var oldText: String
    var newText: String
    var mode: DiffMode = .unified

    private var diffLines: [(type: String, content: String, oldNum: Int?, newNum: Int?)] {
        let oldLines = oldText.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        let newLines = newText.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        var result: [(String, String, Int?, Int?)] = []
        var oi = 0; var ni = 0
        while oi < oldLines.count || ni < newLines.count {
            let ol = oi < oldLines.count ? oldLines[oi] : nil
            let nl = ni < newLines.count ? newLines[ni] : nil
            if let ol = ol, let nl = nl, ol == nl {
                result.append(("unchanged", ol, oi + 1, ni + 1)); oi += 1; ni += 1
            } else if let ol = ol {
                result.append(("removed", ol, oi + 1, nil)); oi += 1
            } else if let nl = nl {
                result.append(("added", nl, nil, ni + 1)); ni += 1
            }
        }
        return result
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            let additions = diffLines.filter { $0.type == "added" }.count
            let deletions = diffLines.filter { $0.type == "removed" }.count
            HStack {
                Text("Diff").font(.headline).fontWeight(.bold)
                Text("+\(additions)").foregroundColor(.green).fontWeight(.bold)
                Text("-\(deletions)").foregroundColor(.red).fontWeight(.bold)
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(diffLines.enumerated()), id: \.offset) { _, line in
                        let prefix = line.type == "added" ? "+" : (line.type == "removed" ? "-" : " ")
                        let color: Color = line.type == "added" ? .green : (line.type == "removed" ? .red : .secondary)
                        HStack(spacing: 4) {
                            Text(line.oldNum.map(String.init) ?? " ").font(.system(.caption2, design: .monospaced)).foregroundColor(.secondary).frame(width: 30, alignment: .trailing)
                            Text(line.newNum.map(String.init) ?? " ").font(.system(.caption2, design: .monospaced)).foregroundColor(.secondary).frame(width: 30, alignment: .trailing)
                            Text("\(prefix) \(line.content)").font(.system(.caption, design: .monospaced)).foregroundColor(color)
                            Spacer()
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(Color(.systemBackground))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(.systemGray4), lineWidth: 1))
    }
}

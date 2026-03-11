import SwiftUI

enum ArgumentTag: String, CaseIterable {
    case `for`, against, question, amendment
    var color: Color {
        switch self { case .for: return .green; case .against: return .red; case .question: return .blue; case .amendment: return .yellow }
    }
    var label: String { rawValue.capitalized }
}

struct DeliberationEntry: Identifiable {
    let id: String; let author: String; var avatar: String?; let content: String
    let timestamp: String; let tag: ArgumentTag; var parentId: String?; var relevance: Double?
}

enum DeliberationThreadWidgetState { case viewing, composing, entrySelected }

struct DeliberationThreadView: View {
    let entries: [DeliberationEntry]
    let status: String
    var summary: String?
    var showSentiment: Bool = true
    var showTags: Bool = true
    var maxNesting: Int = 3
    var onReply: ((String, String) -> Void)?
    var onEntrySelect: ((String) -> Void)?

    @State private var widgetState: DeliberationThreadWidgetState = .viewing
    @State private var selectedEntryId: String?
    @State private var replyTargetId: String?
    @State private var composeText: String = ""
    @State private var sortMode: String = "time"

    private var sortedEntries: [DeliberationEntry] {
        switch sortMode {
        case "tag": return entries.sorted { $0.tag.rawValue < $1.tag.rawValue }
        case "relevance": return entries.sorted { ($0.relevance ?? 0) > ($1.relevance ?? 0) }
        default: return entries.sorted { $0.timestamp < $1.timestamp }
        }
    }

    private var rootEntries: [DeliberationEntry] { sortedEntries.filter { $0.parentId == nil } }

    private func children(of id: String) -> [DeliberationEntry] {
        sortedEntries.filter { $0.parentId == id }
    }

    private var sentiment: (forCount: Int, againstCount: Int, ratio: Double) {
        let f = entries.filter { $0.tag == .for }.count
        let a = entries.filter { $0.tag == .against }.count
        let total = f + a
        return (f, a, total > 0 ? Double(f) / Double(total) : 0.5)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack {
                Text(status).fontWeight(.semibold).textCase(.uppercase)
                Spacer()
                ForEach(["time", "tag", "relevance"], id: \.self) { mode in
                    Button(mode.capitalized) { sortMode = mode }
                        .buttonStyle(.bordered).controlSize(.mini)
                        .tint(sortMode == mode ? .accentColor : .gray)
                }
            }
            if let s = summary { Text(s).font(.subheadline).foregroundColor(.secondary) }

            // Sentiment bar
            if showSentiment {
                GeometryReader { geo in
                    HStack(spacing: 0) {
                        Rectangle().fill(Color.green).frame(width: geo.size.width * sentiment.ratio)
                        Rectangle().fill(Color.red)
                    }
                }
                .frame(height: 8).cornerRadius(4)
                .accessibilityLabel("Sentiment: \(sentiment.forCount) for, \(sentiment.againstCount) against")
            }

            // Entries
            if rootEntries.isEmpty {
                Text("No contributions yet.").foregroundColor(.secondary).italic()
            } else {
                ForEach(rootEntries) { entry in entryRow(entry, depth: 0) }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Deliberation thread")
    }

    @ViewBuilder
    private func entryRow(_ entry: DeliberationEntry, depth: Int) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Circle().fill(Color.gray.opacity(0.3)).frame(width: 28, height: 28)
                    .overlay(Text(String(entry.author.prefix(1)).uppercased()).font(.system(size: 14, weight: .semibold)))
                Text(entry.author).fontWeight(.medium)
                if showTags {
                    Text(entry.tag.label).font(.caption).padding(.horizontal, 8).padding(.vertical, 2)
                        .background(entry.tag.color).foregroundColor(.white).cornerRadius(12)
                }
                Spacer()
                Text(entry.timestamp).font(.caption).foregroundColor(.secondary)
            }
            Text(entry.content).font(.body)
            HStack {
                Button("Reply") { replyTargetId = entry.id; widgetState = .composing }.buttonStyle(.plain).font(.caption)
            }

            // Compose box
            if widgetState == .composing && replyTargetId == entry.id {
                VStack(alignment: .leading, spacing: 4) {
                    TextEditor(text: $composeText)
                        .frame(height: 60).overlay(RoundedRectangle(cornerRadius: 4).stroke(Color.gray.opacity(0.3)))
                    HStack {
                        Button("Send") { onReply?(entry.id, composeText); composeText = ""; widgetState = .viewing }
                        Button("Cancel") { composeText = ""; widgetState = .viewing }
                    }.buttonStyle(.bordered).controlSize(.small)
                }.padding(.leading, 24)
            }

            // Children
            let kids = children(of: entry.id)
            if !kids.isEmpty && depth < maxNesting {
                ForEach(kids) { child in entryRow(child, depth: depth + 1) }
            }
        }
        .padding(.leading, CGFloat(depth * 24))
        .padding(.vertical, 4)
        .accessibilityLabel("\(entry.author): \(entry.tag.label)")
    }
}

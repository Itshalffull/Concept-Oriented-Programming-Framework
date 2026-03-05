import SwiftUI

// State machine: viewing | composing | entrySelected
enum DeliberationThreadWatchState {
    case viewing
    case composing
    case entrySelected
}

enum DeliberationThreadWatchEvent {
    case replyTo(String)
    case selectEntry(String)
    case send
    case cancel
    case deselect
}

func deliberationThreadWatchReduce(_ state: DeliberationThreadWatchState, _ event: DeliberationThreadWatchEvent) -> DeliberationThreadWatchState {
    switch state {
    case .viewing:
        switch event {
        case .replyTo: return .composing
        case .selectEntry: return .entrySelected
        default: return state
        }
    case .composing:
        switch event {
        case .send, .cancel: return .viewing
        default: return state
        }
    case .entrySelected:
        switch event {
        case .deselect: return .viewing
        case .replyTo: return .composing
        default: return state
        }
    }
}

struct DeliberationEntryData: Identifiable {
    let id: String
    let author: String
    let content: String
    let timestamp: String
    let tag: String // "for", "against", "question", "amendment"
    var parentId: String? = nil
}

struct DeliberationThreadWatchView: View {
    let entries: [DeliberationEntryData]
    let status: String
    var summary: String? = nil
    var onEntrySelect: ((String) -> Void)? = nil

    @State private var state: DeliberationThreadWatchState = .viewing
    @State private var selectedEntryId: String? = nil

    private var forCount: Int { entries.filter { $0.tag == "for" }.count }
    private var againstCount: Int { entries.filter { $0.tag == "against" }.count }
    private var sentimentRatio: Double {
        let total = forCount + againstCount
        return total > 0 ? Double(forCount) / Double(total) : 0.5
    }

    private func tagColor(_ tag: String) -> Color {
        switch tag {
        case "for": return .green
        case "against": return .red
        case "question": return .blue
        case "amendment": return .yellow
        default: return .secondary
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(status.capitalized)
                        .font(.caption2).fontWeight(.bold)
                    Spacer()
                    Text("\(entries.count)")
                        .font(.caption2).foregroundColor(.secondary)
                }

                if let summary = summary {
                    Text(summary).font(.system(size: 9)).foregroundColor(.secondary).lineLimit(2)
                }

                // Sentiment bar
                GeometryReader { geo in
                    HStack(spacing: 0) {
                        Rectangle().fill(Color.green).frame(width: geo.size.width * sentimentRatio)
                        Rectangle().fill(Color.red)
                    }
                }.frame(height: 4).cornerRadius(2)

                HStack {
                    Text("\(forCount) for").font(.system(size: 8)).foregroundColor(.green)
                    Spacer()
                    Text("\(againstCount) against").font(.system(size: 8)).foregroundColor(.red)
                }

                Divider()

                ForEach(entries) { entry in
                    Button {
                        if selectedEntryId == entry.id {
                            selectedEntryId = nil
                            state = deliberationThreadWatchReduce(state, .deselect)
                        } else {
                            selectedEntryId = entry.id
                            state = deliberationThreadWatchReduce(state, .selectEntry(entry.id))
                            onEntrySelect?(entry.id)
                        }
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 4) {
                                Text(String(entry.author.prefix(1)))
                                    .font(.system(size: 8)).fontWeight(.bold)
                                    .frame(width: 14, height: 14)
                                    .background(Color.secondary.opacity(0.3))
                                    .cornerRadius(7)
                                Text(entry.author).font(.system(size: 9)).fontWeight(.semibold)
                                Text(entry.tag.capitalized)
                                    .font(.system(size: 7))
                                    .padding(.horizontal, 3).padding(.vertical, 1)
                                    .background(tagColor(entry.tag).opacity(0.3))
                                    .cornerRadius(4)
                            }
                            Text(entry.content)
                                .font(.system(size: 9))
                                .lineLimit(selectedEntryId == entry.id ? nil : 2)
                        }
                        .padding(.vertical, 2)
                        .background(selectedEntryId == entry.id ? Color.blue.opacity(0.1) : Color.clear)
                        .cornerRadius(4)
                    }
                    .buttonStyle(.plain)
                }

                if entries.isEmpty {
                    Text("No contributions yet.").font(.caption2).foregroundColor(.secondary).italic()
                }
            }
            .padding(.horizontal, 4)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Deliberation thread, \(status), \(entries.count) entries")
    }
}

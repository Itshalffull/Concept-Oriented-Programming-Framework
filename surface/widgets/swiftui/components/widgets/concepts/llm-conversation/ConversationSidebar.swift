import SwiftUI

// MARK: - Types

struct ConversationItem: Identifiable {
    let id: String
    let title: String
    let lastMessage: String
    let timestamp: String
    let messageCount: Int
    var isActive: Bool?
    var model: String?
    var tags: [String]?
    var folder: String?
}

enum ContextMenuAction: String, CaseIterable { case rename, delete, archive, share }

// MARK: - State Machine

enum ConversationSidebarState { case idle, searching, contextOpen }
enum ConversationSidebarEvent { case search, select, contextMenu, clearSearch, closeContext, action }

func conversationSidebarReduce(state: ConversationSidebarState, event: ConversationSidebarEvent) -> ConversationSidebarState {
    switch state {
    case .idle:
        switch event {
        case .search: return .searching
        case .select: return .idle
        case .contextMenu: return .contextOpen
        default: return state
        }
    case .searching:
        switch event {
        case .clearSearch: return .idle
        case .select: return .idle
        default: return state
        }
    case .contextOpen:
        switch event {
        case .closeContext, .action: return .idle
        default: return state
        }
    }
}

private func truncate(_ text: String, max: Int) -> String {
    text.count <= max ? text : String(text.prefix(max)) + "\u{2026}"
}

// MARK: - View

struct ConversationSidebarView: View {
    let conversations: [ConversationItem]
    var selectedId: String?
    var groupBy: String = "date"
    var showPreview: Bool = true
    var showModel: Bool = true
    var previewMaxLength: Int = 80
    var onSelect: ((String) -> Void)?
    var onCreate: (() -> Void)?
    var onDelete: ((String) -> Void)?
    var onContextAction: ((ContextMenuAction, String) -> Void)?

    @State private var widgetState: ConversationSidebarState = .idle
    @State private var searchQuery: String = ""

    private var filtered: [ConversationItem] {
        if searchQuery.trimmingCharacters(in: .whitespaces).isEmpty { return conversations }
        let q = searchQuery.lowercased()
        return conversations.filter { $0.title.lowercased().contains(q) || $0.lastMessage.lowercased().contains(q) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Search
            TextField("Search conversations\u{2026}", text: $searchQuery)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .onChange(of: searchQuery) { val in
                    if !val.trimmingCharacters(in: .whitespaces).isEmpty && widgetState != .searching {
                        widgetState = conversationSidebarReduce(state: widgetState, event: .search)
                    } else if val.trimmingCharacters(in: .whitespaces).isEmpty && widgetState == .searching {
                        widgetState = conversationSidebarReduce(state: widgetState, event: .clearSearch)
                    }
                }
                .accessibilityLabel("Search conversations")

            // New button
            Button("+ New conversation") { onCreate?() }
                .padding(.horizontal, 12).padding(.bottom, 8)
                .accessibilityLabel("New conversation")

            Divider()

            // List
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(filtered) { item in
                        let isSelected = item.id == selectedId

                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(item.title).fontWeight(.medium).lineLimit(1)
                                Spacer()
                                Text(item.timestamp).font(.caption2).foregroundColor(.secondary)
                            }

                            if showPreview {
                                Text(truncate(item.lastMessage, max: previewMaxLength))
                                    .font(.caption).foregroundColor(.secondary).lineLimit(2)
                            }

                            HStack {
                                Text("\(item.messageCount) msg\(item.messageCount != 1 ? "s" : "")").font(.caption2).foregroundColor(.secondary)
                                if showModel, let m = item.model {
                                    Text(m).font(.caption2).padding(.horizontal, 4).padding(.vertical, 1)
                                        .background(Color.gray.opacity(0.12)).cornerRadius(3)
                                }
                                Spacer()
                            }
                        }
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
                        .contentShape(Rectangle())
                        .onTapGesture {
                            widgetState = conversationSidebarReduce(state: widgetState, event: .select)
                            searchQuery = ""
                            onSelect?(item.id)
                        }
                        .contextMenu {
                            ForEach(ContextMenuAction.allCases, id: \.self) { action in
                                Button(action.rawValue.capitalized) {
                                    if action == .delete { onDelete?(item.id) }
                                    onContextAction?(action, item.id)
                                }
                            }
                        }
                        .accessibilityLabel("\(item.title)")
                    }

                    if filtered.isEmpty {
                        Text(searchQuery.isEmpty ? "No conversations yet." : "No conversations match your search.")
                            .font(.caption).foregroundColor(.secondary).padding(12)
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Conversation history")
    }
}

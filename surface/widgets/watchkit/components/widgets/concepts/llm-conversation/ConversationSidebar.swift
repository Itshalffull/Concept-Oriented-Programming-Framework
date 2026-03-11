import SwiftUI

// State machine: idle | searching (simplified for watch)
enum ConversationSidebarWatchState {
    case idle
    case searching
}

enum ConversationSidebarWatchEvent {
    case search
    case clearSearch
    case selectConversation
}

func conversationSidebarWatchReduce(_ state: ConversationSidebarWatchState, _ event: ConversationSidebarWatchEvent) -> ConversationSidebarWatchState {
    switch state {
    case .idle:
        if case .search = event { return .searching }
        return state
    case .searching:
        if case .clearSearch = event { return .idle }
        return state
    }
}

struct ConversationItemData: Identifiable {
    let id: String
    let title: String
    var lastMessage: String? = nil
    var timestamp: String? = nil
    var isActive: Bool = false
}

struct ConversationSidebarWatchView: View {
    let conversations: [ConversationItemData]
    var activeId: String? = nil
    var onSelect: ((String) -> Void)? = nil

    @State private var state: ConversationSidebarWatchState = .idle
    @State private var searchText: String = ""

    private var filteredConversations: [ConversationItemData] {
        if searchText.isEmpty { return conversations }
        return conversations.filter { $0.title.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        List {
            ForEach(filteredConversations) { conv in
                Button {
                    onSelect?(conv.id)
                } label: {
                    VStack(alignment: .leading, spacing: 1) {
                        HStack {
                            Text(conv.title)
                                .font(.caption2)
                                .fontWeight(conv.id == activeId ? .bold : .regular)
                                .lineLimit(1)
                            if conv.id == activeId {
                                Spacer()
                                Circle().fill(.blue).frame(width: 5, height: 5)
                            }
                        }
                        if let lastMsg = conv.lastMessage {
                            Text(lastMsg)
                                .font(.system(size: 8))
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                        }
                    }
                }
                .listRowBackground(conv.id == activeId ? Color.blue.opacity(0.1) : Color.clear)
            }
        }
        .listStyle(.plain)
        .searchable(text: $searchText, prompt: "Search")
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Conversations, \(conversations.count) items")
    }
}

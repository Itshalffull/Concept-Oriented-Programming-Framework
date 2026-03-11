import SwiftUI

// State machine: idle | searching | resultSelected
enum RegistrySearchWatchState {
    case idle
    case searching
    case resultSelected
}

enum RegistrySearchWatchEvent {
    case search
    case clearSearch
    case selectResult
    case deselect
    case searchComplete
}

func registrySearchWatchReduce(_ state: RegistrySearchWatchState, _ event: RegistrySearchWatchEvent) -> RegistrySearchWatchState {
    switch state {
    case .idle:
        if case .search = event { return .searching }
        if case .selectResult = event { return .resultSelected }
        return state
    case .searching:
        switch event {
        case .searchComplete: return .idle
        case .clearSearch: return .idle
        case .selectResult: return .resultSelected
        default: return state
        }
    case .resultSelected:
        if case .deselect = event { return .idle }
        if case .selectResult = event { return .resultSelected }
        if case .search = event { return .searching }
        return state
    }
}

struct RegistryPackageData: Identifiable {
    let id: String
    let name: String
    let version: String
    var description: String? = nil
    var author: String? = nil
    var downloads: Int? = nil
    var isInstalled: Bool = false
}

struct RegistrySearchWatchView: View {
    var results: [RegistryPackageData] = []
    var isSearching: Bool = false
    var onSearch: ((String) -> Void)? = nil
    var onSelect: ((String) -> Void)? = nil
    var onInstall: ((String) -> Void)? = nil

    @State private var state: RegistrySearchWatchState = .idle
    @State private var searchText: String = ""
    @State private var selectedId: String? = nil

    private func formatDownloads(_ count: Int) -> String {
        if count >= 1_000_000 { return "\(count / 1_000_000)M" }
        if count >= 1_000 { return "\(count / 1_000)K" }
        return "\(count)"
    }

    var body: some View {
        VStack(spacing: 4) {
            // Search field
            HStack(spacing: 4) {
                TextField("Search packages...", text: $searchText)
                    .font(.caption2)
                    .onSubmit {
                        guard !searchText.isEmpty else { return }
                        state = registrySearchWatchReduce(state, .search)
                        onSearch?(searchText)
                    }

                if !searchText.isEmpty {
                    Button {
                        searchText = ""
                        state = registrySearchWatchReduce(state, .clearSearch)
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 10))
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }

            // Loading indicator
            if isSearching {
                HStack(spacing: 4) {
                    ProgressView().scaleEffect(0.4)
                    Text("Searching...")
                        .font(.system(size: 8))
                        .foregroundColor(.secondary)
                }
            }

            // Results list
            if !results.isEmpty {
                ScrollView {
                    VStack(spacing: 3) {
                        ForEach(results) { pkg in
                            Button {
                                if selectedId == pkg.id {
                                    selectedId = nil
                                    state = registrySearchWatchReduce(state, .deselect)
                                } else {
                                    selectedId = pkg.id
                                    state = registrySearchWatchReduce(state, .selectResult)
                                    onSelect?(pkg.id)
                                }
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    HStack(spacing: 3) {
                                        Text(pkg.name)
                                            .font(.system(size: 9, weight: .semibold))
                                            .lineLimit(1)
                                        Spacer()
                                        Text(pkg.version)
                                            .font(.system(size: 7, design: .monospaced))
                                            .foregroundColor(.secondary)
                                        if pkg.isInstalled {
                                            Image(systemName: "checkmark.circle.fill")
                                                .font(.system(size: 7))
                                                .foregroundColor(.green)
                                        }
                                    }
                                    if let desc = pkg.description {
                                        Text(desc)
                                            .font(.system(size: 8))
                                            .foregroundColor(.secondary)
                                            .lineLimit(1)
                                    }
                                }
                                .padding(4)
                                .background(selectedId == pkg.id ? Color.blue.opacity(0.1) : Color.secondary.opacity(0.05))
                                .cornerRadius(3)
                            }
                            .buttonStyle(.plain)

                            // Selected detail
                            if selectedId == pkg.id {
                                VStack(alignment: .leading, spacing: 2) {
                                    if let author = pkg.author {
                                        Text("By \(author)")
                                            .font(.system(size: 8))
                                            .foregroundColor(.secondary)
                                    }
                                    if let downloads = pkg.downloads {
                                        Text("\(formatDownloads(downloads)) downloads")
                                            .font(.system(size: 8))
                                            .foregroundColor(.secondary)
                                    }
                                    if let desc = pkg.description {
                                        Text(desc)
                                            .font(.system(size: 8))
                                            .foregroundColor(.secondary)
                                            .lineLimit(4)
                                    }
                                    if !pkg.isInstalled, let onInstall = onInstall {
                                        Button("Install") {
                                            onInstall(pkg.id)
                                        }
                                        .font(.caption2)
                                        .buttonStyle(.borderedProminent)
                                    }
                                }
                                .padding(4)
                                .background(Color.secondary.opacity(0.05))
                                .cornerRadius(3)
                            }
                        }
                    }
                }
            } else if !isSearching && !searchText.isEmpty {
                Text("No results found")
                    .font(.system(size: 9))
                    .foregroundColor(.secondary)
                    .padding(.top, 8)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Package registry search")
    }
}

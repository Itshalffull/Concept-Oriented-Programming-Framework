import SwiftUI

enum RegistrySearchWidgetState {
    case idle, searching
}

enum RegistrySearchEvent {
    case input, selectResult, results, clear
}

func registrySearchReduce(state: RegistrySearchWidgetState, event: RegistrySearchEvent) -> RegistrySearchWidgetState {
    switch state {
    case .idle:
        if event == .input { return .searching }
        return state
    case .searching:
        if event == .results { return .idle }
        if event == .clear { return .idle }
        return state
    }
}

struct RegistrySearchResult: Identifiable {
    var id: String { "\(name)@\(version)" }
    var name: String
    var version: String
    var description: String
    var downloads: Int? = nil
    var author: String? = nil
    var keywords: [String]? = nil
}

struct RegistrySearchView: View {
    var query: String
    var results: [RegistrySearchResult]
    var sortBy: String = "relevance"
    var pageSize: Int = 20
    var loading: Bool = false
    var placeholder: String = "Search packages\u{2026}"
    var onSearch: ((String) -> Void)? = nil
    var onSelect: ((String) -> Void)? = nil
    var onKeywordClick: ((String) -> Void)? = nil

    @State private var widgetState: RegistrySearchWidgetState = .idle
    @State private var internalQuery: String = ""
    @State private var focusIndex: Int = -1
    @State private var currentPage: Int = 0

    private func formatDownloads(_ count: Int) -> String {
        if count >= 1_000_000 { return String(format: "%.1fM", Double(count) / 1_000_000) }
        if count >= 1_000 { return String(format: "%.1fK", Double(count) / 1_000) }
        return "\(count)"
    }

    private var totalPages: Int { max(1, Int(ceil(Double(results.count) / Double(pageSize)))) }
    private var paginatedResults: [RegistrySearchResult] {
        let start = currentPage * pageSize
        let end = min(start + pageSize, results.count)
        guard start < results.count else { return [] }
        return Array(results[start..<end])
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Search input
            TextField(placeholder, text: $internalQuery)
                .textFieldStyle(.roundedBorder)
                .accessibilityLabel("Search packages")
                .onChange(of: internalQuery) { newVal in
                    currentPage = 0
                    focusIndex = -1
                    if newVal.trimmingCharacters(in: .whitespaces).isEmpty {
                        widgetState = registrySearchReduce(state: widgetState, event: .clear)
                        onSearch?("")
                    } else {
                        widgetState = .idle
                        widgetState = registrySearchReduce(state: widgetState, event: .input)
                        onSearch?(newVal)
                    }
                }

            // Loading indicator
            if loading {
                HStack {
                    ProgressView()
                    Text("Loading results\u{2026}")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .accessibilityLabel("Loading search results")
            }

            // Result list
            if !paginatedResults.isEmpty {
                LazyVStack(spacing: 8) {
                    ForEach(Array(paginatedResults.enumerated()), id: \.element.id) { index, result in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(result.name)
                                    .fontWeight(.semibold)
                                Text(result.version)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Spacer()
                                if let downloads = result.downloads {
                                    Text(formatDownloads(downloads))
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                        .accessibilityLabel("\(downloads) downloads")
                                }
                            }

                            Text(result.description)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .lineLimit(2)

                            HStack(spacing: 8) {
                                if let author = result.author {
                                    Text(author)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }

                                if let keywords = result.keywords, !keywords.isEmpty {
                                    ForEach(keywords.prefix(5), id: \.self) { kw in
                                        Button(kw) {
                                            internalQuery = kw
                                            currentPage = 0
                                            widgetState = .idle
                                            widgetState = registrySearchReduce(state: widgetState, event: .input)
                                            onKeywordClick?(kw)
                                            onSearch?(kw)
                                        }
                                        .font(.caption2)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color.secondary.opacity(0.1))
                                        .cornerRadius(4)
                                        .accessibilityLabel("Filter by keyword: \(kw)")
                                    }
                                }
                            }
                        }
                        .padding(10)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(focusIndex == index ? Color.accentColor : Color.gray.opacity(0.2), lineWidth: 1)
                        )
                        .contentShape(Rectangle())
                        .onTapGesture {
                            widgetState = registrySearchReduce(state: widgetState, event: .selectResult)
                            onSelect?(result.name)
                        }
                        .accessibilityLabel("\(result.name)@\(result.version)")
                    }
                }
            }

            // Pagination
            if totalPages > 1 {
                HStack {
                    Button("Previous") {
                        currentPage = max(0, currentPage - 1)
                        focusIndex = -1
                    }
                    .disabled(currentPage == 0)
                    .accessibilityLabel("Previous page")

                    Spacer()

                    Text("Page \(currentPage + 1) of \(totalPages)")
                        .font(.caption)

                    Spacer()

                    Button("Next") {
                        currentPage = min(totalPages - 1, currentPage + 1)
                        focusIndex = -1
                    }
                    .disabled(currentPage >= totalPages - 1)
                    .accessibilityLabel("Next page")
                }
            }

            // Empty states
            if !loading && !internalQuery.trimmingCharacters(in: .whitespaces).isEmpty && results.isEmpty {
                Text("No packages found for \u{201C}\(internalQuery)\u{201D}. Try a different search term.")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding()
            }

            if !loading && internalQuery.trimmingCharacters(in: .whitespaces).isEmpty && results.isEmpty {
                Text("Enter a search term to find packages.")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding()
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Package registry search")
        .onAppear {
            internalQuery = query
        }
        .onChange(of: query) { internalQuery = $0 }
        .onChange(of: results) { _ in
            if widgetState == .searching && !loading {
                widgetState = registrySearchReduce(state: widgetState, event: .results)
            }
        }
    }
}

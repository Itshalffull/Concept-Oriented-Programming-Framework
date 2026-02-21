// Conduit Example App -- WatchKit Article Detail View
// Truncated article view for the watch screen with scroll support.

import SwiftUI

struct ArticleDetailView: View {
    @EnvironmentObject var api: WatchAPIClient
    let slug: String

    @State private var article: WatchArticle?
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
            } else if let error = errorMessage {
                VStack(spacing: 4) {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundColor(.red)
                    Text(error)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            } else if let article = article {
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(article.title)
                            .font(.headline)
                            .fontWeight(.bold)

                        HStack {
                            Text(article.author.username)
                                .font(.caption2)
                                .foregroundColor(.green)
                            Spacer()
                            Text(String(article.createdAt.prefix(10)))
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }

                        Divider()

                        // Truncate body for watch display
                        Text(truncatedBody(article.body))
                            .font(.caption)

                        if article.body.count > 500 {
                            Text("Read full article on phone...")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                                .italic()
                        }

                        Divider()

                        Button(action: toggleFavorite) {
                            HStack {
                                Image(systemName: "heart.fill")
                                    .foregroundColor(.red)
                                Text("\(article.favoritesCount)")
                                    .font(.caption)
                            }
                        }
                    }
                    .padding(.horizontal, 4)
                }
            }
        }
        .navigationTitle("Article")
        .task { await loadArticle() }
    }

    private func loadArticle() async {
        do {
            errorMessage = nil
            article = try await api.getArticle(slug: slug)
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    private func toggleFavorite() {
        guard let current = article else { return }
        Task {
            do {
                article = current.favoritesCount > 0
                    ? try await api.unfavorite(slug: slug)
                    : try await api.favorite(slug: slug)
            } catch { /* silently fail on watch */ }
        }
    }

    private func truncatedBody(_ body: String) -> String {
        if body.count <= 500 { return body }
        let index = body.index(body.startIndex, offsetBy: 500)
        return String(body[..<index]) + "..."
    }
}

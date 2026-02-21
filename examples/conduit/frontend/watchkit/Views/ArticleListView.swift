// Conduit Example App -- WatchKit Article List View
// Compact scrollable article list optimized for small watch screens.

import SwiftUI

struct ArticleListView: View {
    @EnvironmentObject var api: WatchAPIClient
    @State private var articles: [WatchArticle] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = errorMessage {
                VStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.title3)
                        .foregroundColor(.red)
                    Text(error)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                    Button("Retry") {
                        Task { await loadArticles() }
                    }
                    .font(.caption)
                }
            } else if articles.isEmpty {
                Text("No articles")
                    .foregroundColor(.secondary)
                    .font(.caption)
            } else {
                List(articles) { article in
                    NavigationLink(destination: ArticleDetailView(slug: article.slug)) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(article.title)
                                .font(.caption)
                                .fontWeight(.semibold)
                                .lineLimit(2)

                            HStack {
                                Text(article.author.username)
                                    .font(.caption2)
                                    .foregroundColor(.green)
                                Spacer()
                                Text("\u{2665} \(article.favoritesCount)")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .navigationTitle("Conduit")
        .task { await loadArticles() }
    }

    private func loadArticles() async {
        do {
            errorMessage = nil
            articles = try await api.getArticles()
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }
}

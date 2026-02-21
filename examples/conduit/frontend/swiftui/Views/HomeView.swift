// Conduit Example App -- SwiftUI Home View
// Displays the global article feed with pull-to-refresh.

import SwiftUI

struct HomeView: View {
    @EnvironmentObject var api: APIService
    @State private var articles: [Article] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading articles...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = errorMessage {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundColor(.red)
                    Text(error)
                        .foregroundColor(.secondary)
                    Button("Retry") { Task { await loadArticles() } }
                        .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(articles) { article in
                    NavigationLink(destination: ArticleView(slug: article.slug)) {
                        ArticleRow(article: article)
                    }
                }
                .listStyle(.plain)
                .refreshable { await loadArticles() }
            }
        }
        .navigationTitle("Conduit")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                if api.isAuthenticated {
                    NavigationLink(destination: ProfileView(username: api.currentUser?.username ?? "")) {
                        Image(systemName: "person.circle")
                    }
                } else {
                    NavigationLink(destination: LoginView()) {
                        Text("Sign In")
                    }
                }
            }
        }
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

struct ArticleRow: View {
    let article: Article

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(article.author.username)
                    .font(.caption)
                    .foregroundColor(Color(red: 0.36, green: 0.72, blue: 0.36))
                Spacer()
                Text(formattedDate(article.createdAt))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Text(article.title)
                .font(.headline)
                .lineLimit(2)

            Text(article.description)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .lineLimit(2)

            HStack {
                Image(systemName: article.favorited ? "heart.fill" : "heart")
                    .foregroundColor(article.favorited ? .red : .secondary)
                    .font(.caption)
                Text("\(article.favoritesCount)")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()

                ForEach(article.tagList.prefix(3), id: \.self) { tag in
                    Text(tag)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.gray.opacity(0.1))
                        .cornerRadius(8)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func formattedDate(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: dateString) {
            let display = DateFormatter()
            display.dateStyle = .medium
            return display.string(from: date)
        }
        return dateString
    }
}

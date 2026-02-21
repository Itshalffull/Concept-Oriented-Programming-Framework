// Conduit Example App -- SwiftUI Login View
// Email and password login form with registration option.

import SwiftUI

struct LoginView: View {
    @EnvironmentObject var api: APIService
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        Form {
            Section {
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .autocapitalization(.none)
                    .keyboardType(.emailAddress)
                    .disabled(isLoading)

                SecureField("Password", text: $password)
                    .textContentType(.password)
                    .disabled(isLoading)
            }

            if let error = errorMessage {
                Section {
                    Text(error)
                        .foregroundColor(.red)
                        .font(.caption)
                }
            }

            Section {
                Button(action: handleLogin) {
                    HStack {
                        Spacer()
                        if isLoading {
                            ProgressView()
                        } else {
                            Text("Sign In")
                                .fontWeight(.semibold)
                        }
                        Spacer()
                    }
                }
                .disabled(isLoading || email.isEmpty || password.isEmpty)

                Button(action: handleRegister) {
                    HStack {
                        Spacer()
                        Text("Create Account")
                        Spacer()
                    }
                }
                .disabled(isLoading || email.isEmpty || password.isEmpty)
            }
        }
        .navigationTitle("Sign In")
    }

    private func handleLogin() {
        isLoading = true
        errorMessage = nil
        Task {
            do {
                _ = try await api.login(email: email, password: password)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }

    private func handleRegister() {
        isLoading = true
        errorMessage = nil
        let username = email.components(separatedBy: "@").first ?? email
        Task {
            do {
                _ = try await api.register(username: username, email: email, password: password)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }
}

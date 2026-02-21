// Conduit Example App -- AppKit Login View Controller
// Modal sheet with email/password login form.

import AppKit

class LoginViewController: NSViewController {
    var onLoginComplete: (() -> Void)?

    private let emailField = NSTextField()
    private let passwordField = NSSecureTextField()
    private let loginButton = NSButton(title: "Sign In", target: nil, action: nil)
    private let registerButton = NSButton(title: "Create Account", target: nil, action: nil)
    private let cancelButton = NSButton(title: "Cancel", target: nil, action: nil)
    private let errorLabel = NSTextField(labelWithString: "")
    private let spinner = NSProgressIndicator()

    override func loadView() {
        view = NSView(frame: NSRect(x: 0, y: 0, width: 380, height: 260))

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .centerX
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false

        let titleLabel = NSTextField(labelWithString: "Sign In to Conduit")
        titleLabel.font = .systemFont(ofSize: 18, weight: .bold)

        emailField.placeholderString = "Email"
        emailField.translatesAutoresizingMaskIntoConstraints = false

        passwordField.placeholderString = "Password"
        passwordField.translatesAutoresizingMaskIntoConstraints = false

        errorLabel.textColor = .systemRed
        errorLabel.font = .systemFont(ofSize: 12)
        errorLabel.isHidden = true

        spinner.style = .spinning
        spinner.isHidden = true
        spinner.translatesAutoresizingMaskIntoConstraints = false

        loginButton.target = self
        loginButton.action = #selector(handleLogin)
        loginButton.bezelStyle = .rounded
        loginButton.keyEquivalent = "\r"

        registerButton.target = self
        registerButton.action = #selector(handleRegister)
        registerButton.bezelStyle = .rounded

        cancelButton.target = self
        cancelButton.action = #selector(handleCancel)
        cancelButton.bezelStyle = .rounded

        let buttonRow = NSStackView(views: [cancelButton, NSView(), registerButton, loginButton])
        buttonRow.orientation = .horizontal
        buttonRow.spacing = 8

        stack.addArrangedSubview(titleLabel)
        stack.addArrangedSubview(emailField)
        stack.addArrangedSubview(passwordField)
        stack.addArrangedSubview(errorLabel)
        stack.addArrangedSubview(spinner)
        stack.addArrangedSubview(buttonRow)

        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stack.widthAnchor.constraint(equalToConstant: 320),

            emailField.widthAnchor.constraint(equalTo: stack.widthAnchor),
            passwordField.widthAnchor.constraint(equalTo: stack.widthAnchor),
            buttonRow.widthAnchor.constraint(equalTo: stack.widthAnchor),
        ])
    }

    private func setLoading(_ loading: Bool) {
        emailField.isEnabled = !loading
        passwordField.isEnabled = !loading
        loginButton.isEnabled = !loading
        registerButton.isEnabled = !loading
        spinner.isHidden = !loading
        if loading { spinner.startAnimation(nil) } else { spinner.stopAnimation(nil) }
    }

    @objc private func handleLogin() {
        let email = emailField.stringValue.trimmingCharacters(in: .whitespaces)
        let password = passwordField.stringValue

        guard !email.isEmpty, !password.isEmpty else {
            showError("Email and password are required.")
            return
        }

        setLoading(true)
        errorLabel.isHidden = true

        Task { @MainActor in
            do {
                _ = try await APIClient.shared.login(email: email, password: password)
                dismiss(nil)
                onLoginComplete?()
            } catch {
                showError(error.localizedDescription)
            }
            setLoading(false)
        }
    }

    @objc private func handleRegister() {
        let email = emailField.stringValue.trimmingCharacters(in: .whitespaces)
        let password = passwordField.stringValue
        let username = email.components(separatedBy: "@").first ?? email

        guard !email.isEmpty, !password.isEmpty else {
            showError("Email and password are required.")
            return
        }

        setLoading(true)
        errorLabel.isHidden = true

        Task { @MainActor in
            do {
                _ = try await APIClient.shared.register(username: username, email: email, password: password)
                dismiss(nil)
                onLoginComplete?()
            } catch {
                showError(error.localizedDescription)
            }
            setLoading(false)
        }
    }

    @objc private func handleCancel() {
        dismiss(nil)
    }

    private func showError(_ message: String) {
        errorLabel.stringValue = message
        errorLabel.isHidden = false
    }
}

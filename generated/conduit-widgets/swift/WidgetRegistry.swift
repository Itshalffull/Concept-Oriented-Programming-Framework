// =============================================================================
// Conduit Widget Registry
//
// Central registry that stores all Conduit widget specifications and provides
// lookup by name and filtering by category. The shared instance is
// pre-populated with all 8 Conduit widgets.
// =============================================================================

import Foundation

/// Central registry for Conduit widget specifications.
///
/// Usage:
/// ```swift
/// let registry = ConduitWidgetRegistry.shared
/// let loginSpec = registry.get("login")
/// let formWidgets = registry.list(category: .form)
/// ```
final class ConduitWidgetRegistry {

    // MARK: - Singleton

    /// Pre-populated shared instance containing all Conduit widget specs.
    static let shared: ConduitWidgetRegistry = {
        let registry = ConduitWidgetRegistry()
        registry.register(registrationWidgetSpec())
        registry.register(loginWidgetSpec())
        registry.register(articleEditorWidgetSpec())
        registry.register(articleViewWidgetSpec())
        registry.register(commentWidgetSpec())
        registry.register(profileWidgetSpec())
        registry.register(feedWidgetSpec())
        registry.register(settingsWidgetSpec())
        return registry
    }()

    // MARK: - Storage

    private var specs: [String: WidgetSpec] = [:]

    // MARK: - Init

    init() {}

    // MARK: - Registration

    /// Registers a widget specification, keyed by its name.
    ///
    /// - Parameter spec: The widget specification to register.
    func register(_ spec: WidgetSpec) {
        specs[spec.name] = spec
    }

    // MARK: - Lookup

    /// Returns the widget specification with the given name, or `nil` if not found.
    ///
    /// - Parameter name: The widget name (e.g. "registration", "login").
    /// - Returns: The matching `WidgetSpec`, or `nil`.
    func get(_ name: String) -> WidgetSpec? {
        specs[name]
    }

    /// Returns all registered widget specifications, optionally filtered by category.
    ///
    /// - Parameter category: If provided, only specs matching this category are returned.
    /// - Returns: An array of matching `WidgetSpec` values.
    func list(category: WidgetCategory? = nil) -> [WidgetSpec] {
        if let category = category {
            return specs.values
                .filter { $0.category == category }
                .sorted { $0.name < $1.name }
        }
        return specs.values.sorted { $0.name < $1.name }
    }

    // MARK: - Introspection

    /// The total number of registered widgets.
    var count: Int {
        specs.count
    }

    /// All registered widget names, sorted alphabetically.
    var names: [String] {
        specs.keys.sorted()
    }
}

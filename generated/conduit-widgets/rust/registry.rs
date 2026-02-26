// generated: conduit-widgets/rust/registry.rs
//
// Widget registry for the Conduit application.
// Provides registration, lookup, and enumeration of Clef Surface widget specs.

use std::collections::HashMap;

use crate::widget_spec::WidgetSpec;

/// A registry that stores and retrieves widget specifications by name.
#[derive(Debug, Clone)]
pub struct WidgetRegistry {
    widgets: HashMap<String, WidgetSpec>,
}

impl WidgetRegistry {
    /// Creates an empty widget registry.
    pub fn new() -> Self {
        Self {
            widgets: HashMap::new(),
        }
    }

    /// Registers a widget specification. If a widget with the same name
    /// already exists, it is replaced and the old spec is returned.
    pub fn register(&mut self, spec: WidgetSpec) -> Option<WidgetSpec> {
        self.widgets.insert(spec.name.clone(), spec)
    }

    /// Retrieves a widget specification by name.
    pub fn get(&self, name: &str) -> Option<&WidgetSpec> {
        self.widgets.get(name)
    }

    /// Returns all registered widget specifications as a vector.
    pub fn list(&self) -> Vec<&WidgetSpec> {
        self.widgets.values().collect()
    }

    /// Returns the number of registered widgets.
    pub fn len(&self) -> usize {
        self.widgets.len()
    }

    /// Returns true if the registry contains no widgets.
    pub fn is_empty(&self) -> bool {
        self.widgets.is_empty()
    }

    /// Returns true if the registry contains a widget with the given name.
    pub fn contains(&self, name: &str) -> bool {
        self.widgets.contains_key(name)
    }

    /// Removes a widget specification by name and returns it if found.
    pub fn remove(&mut self, name: &str) -> Option<WidgetSpec> {
        self.widgets.remove(name)
    }

    /// Returns an iterator over all registered widget names.
    pub fn names(&self) -> impl Iterator<Item = &String> {
        self.widgets.keys()
    }
}

impl Default for WidgetRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Creates a pre-populated registry containing all eight Conduit widget specs.
pub fn conduit_registry() -> WidgetRegistry {
    let mut registry = WidgetRegistry::new();

    registry.register(crate::registration_widget::spec());
    registry.register(crate::login_widget::spec());
    registry.register(crate::article_editor_widget::spec());
    registry.register(crate::article_view_widget::spec());
    registry.register(crate::comment_widget::spec());
    registry.register(crate::profile_widget::spec());
    registry.register(crate::feed_widget::spec());
    registry.register(crate::settings_widget::spec());

    registry
}

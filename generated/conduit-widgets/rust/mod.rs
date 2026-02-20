// generated: conduit-widgets/rust/mod.rs
//
// Module declarations and re-exports for all Conduit COIF widgets.

pub mod widget_spec;
pub mod registry;

pub mod registration_widget;
pub mod login_widget;
pub mod article_editor_widget;
pub mod article_view_widget;
pub mod comment_widget;
pub mod profile_widget;
pub mod feed_widget;
pub mod settings_widget;

pub use widget_spec::*;
pub use registry::*;

use widget_spec::WidgetSpec;

/// Returns all eight Conduit widget specifications.
pub fn all_widget_specs() -> Vec<WidgetSpec> {
    vec![
        registration_widget::spec(),
        login_widget::spec(),
        article_editor_widget::spec(),
        article_view_widget::spec(),
        comment_widget::spec(),
        profile_widget::spec(),
        feed_widget::spec(),
        settings_widget::spec(),
    ]
}

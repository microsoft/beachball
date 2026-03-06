/// Format items as a bulleted list.
pub fn bulleted_list(items: &[&str]) -> String {
    items.iter().map(|item| format!("  • {item}")).collect::<Vec<_>>().join("\n")
}

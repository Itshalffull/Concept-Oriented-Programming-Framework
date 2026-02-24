// XPath field mapper — XPath expression evaluation for XML-like structures
// Supports: / (root), // (descendant), [@attr] (attribute predicate), text() (text content)

use std::collections::HashMap;
use std::fmt;

pub const PROVIDER_ID: &str = "xpath";
pub const PLUGIN_TYPE: &str = "field_mapper";

#[derive(Debug, Clone)]
pub struct MapperConfig {
    pub path_syntax: String,
    pub options: Option<HashMap<String, String>>,
}

#[derive(Debug)]
pub enum MapperError {
    InvalidExpression(String),
    NotXmlStructure(String),
}

impl fmt::Display for MapperError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            MapperError::InvalidExpression(e) => write!(f, "invalid xpath: {}", e),
            MapperError::NotXmlStructure(e) => write!(f, "not xml: {}", e),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Null,
    Bool(bool),
    Number(f64),
    Str(String),
    Array(Vec<Value>),
    Object(HashMap<String, Value>),
}

#[derive(Debug, Clone)]
pub struct XmlNode {
    pub tag: String,
    pub attributes: HashMap<String, String>,
    pub children: Vec<XmlNode>,
    pub text: Option<String>,
}

impl XmlNode {
    fn from_value(val: &Value) -> Option<Self> {
        if let Value::Object(map) = val {
            let tag = match map.get("tag")? {
                Value::Str(s) => s.clone(),
                _ => return None,
            };
            let attributes = match map.get("attributes") {
                Some(Value::Object(attrs)) => attrs
                    .iter()
                    .filter_map(|(k, v)| {
                        if let Value::Str(s) = v { Some((k.clone(), s.clone())) } else { None }
                    })
                    .collect(),
                _ => HashMap::new(),
            };
            let children = match map.get("children") {
                Some(Value::Array(arr)) => {
                    arr.iter().filter_map(|v| XmlNode::from_value(v)).collect()
                }
                _ => Vec::new(),
            };
            let text = match map.get("text") {
                Some(Value::Str(s)) => Some(s.clone()),
                _ => None,
            };
            Some(XmlNode { tag, attributes, children, text })
        } else {
            None
        }
    }

    fn text_content(&self) -> String {
        if let Some(ref t) = self.text {
            return t.clone();
        }
        self.children.iter().map(|c| c.text_content()).collect::<Vec<_>>().join("")
    }

    fn find_children(&self, tag: &str) -> Vec<&XmlNode> {
        if tag == "*" {
            self.children.iter().collect()
        } else {
            self.children.iter().filter(|c| c.tag == tag).collect()
        }
    }

    fn find_descendants(&self, tag: &str) -> Vec<&XmlNode> {
        let mut results = Vec::new();
        for child in &self.children {
            if child.tag == tag || tag == "*" {
                results.push(child);
            }
            results.extend(child.find_descendants(tag));
        }
        results
    }
}

struct Step {
    tag: String,
    predicate: Option<String>,
    is_descendant: bool,
}

fn parse_steps(expr: &str) -> Vec<Step> {
    let mut steps = Vec::new();
    let parts: Vec<&str> = expr.split('/').collect();
    let mut i = 0;
    while i < parts.len() {
        if parts[i].is_empty() {
            if i + 1 < parts.len() && parts[i + 1].is_empty() {
                // "//" descendant axis
                i += 2;
                if i < parts.len() && !parts[i].is_empty() {
                    let (tag, pred) = parse_tag_predicate(parts[i]);
                    steps.push(Step { tag, predicate: pred, is_descendant: true });
                }
            }
            i += 1;
            if i < parts.len() && !parts[i].is_empty() && steps.last().map_or(true, |s| !s.is_descendant || s.tag != parts[i].split('[').next().unwrap_or("")) {
                let (tag, pred) = parse_tag_predicate(parts[i]);
                steps.push(Step { tag, predicate: pred, is_descendant: false });
            }
            continue;
        }
        let (tag, pred) = parse_tag_predicate(parts[i]);
        steps.push(Step { tag, predicate: pred, is_descendant: false });
        i += 1;
    }
    steps
}

fn parse_tag_predicate(s: &str) -> (String, Option<String>) {
    if let Some(bracket) = s.find('[') {
        let tag = s[..bracket].to_string();
        let pred = s[bracket + 1..s.len() - 1].to_string();
        (tag, Some(pred))
    } else {
        (s.to_string(), None)
    }
}

fn matches_predicate(node: &XmlNode, pred: &str) -> bool {
    let trimmed = pred.trim();
    if trimmed.starts_with("@") {
        if let Some(eq_pos) = trimmed.find('=') {
            let attr = trimmed[1..eq_pos].trim();
            let val = trimmed[eq_pos + 1..].trim().trim_matches(|c| c == '\'' || c == '"');
            return node.attributes.get(attr).map_or(false, |v| v == val);
        }
        let attr = &trimmed[1..];
        return node.attributes.contains_key(attr);
    }
    if let Ok(pos) = trimmed.parse::<usize>() {
        return pos > 0; // positional handled at collection level
    }
    true
}

fn positional_index(pred: &str) -> Option<usize> {
    pred.trim().parse::<usize>().ok()
}

fn evaluate_steps<'a>(nodes: Vec<&'a XmlNode>, steps: &[Step]) -> Vec<String> {
    if steps.is_empty() {
        return nodes.iter().map(|n| n.text_content()).collect();
    }

    let step = &steps[0];
    let remaining = &steps[1..];

    if step.tag == "text()" {
        return nodes.iter().map(|n| n.text_content()).collect();
    }

    if step.tag.starts_with('@') {
        let attr = &step.tag[1..];
        return nodes
            .iter()
            .filter_map(|n| n.attributes.get(attr).cloned())
            .collect();
    }

    let mut matched: Vec<&XmlNode> = Vec::new();
    for node in &nodes {
        let candidates: Vec<&XmlNode> = if step.is_descendant {
            node.find_descendants(&step.tag)
        } else {
            node.find_children(&step.tag)
        };

        if let Some(ref pred) = step.predicate {
            if let Some(pos) = positional_index(pred) {
                if pos > 0 && pos <= candidates.len() {
                    matched.push(candidates[pos - 1]);
                }
            } else {
                for c in candidates {
                    if matches_predicate(c, pred) {
                        matched.push(c);
                    }
                }
            }
        } else {
            matched.extend(candidates);
        }
    }

    evaluate_steps(matched, remaining)
}

pub struct XPathMapperProvider;

impl XPathMapperProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn resolve(
        &self,
        record: &Value,
        source_path: &str,
        _config: &MapperConfig,
    ) -> Result<Value, MapperError> {
        let root = XmlNode::from_value(record).ok_or_else(|| {
            MapperError::NotXmlStructure("record is not an XML node structure".to_string())
        })?;

        let steps = parse_steps(source_path.trim());
        let results = evaluate_steps(vec![&root], &steps);

        if results.is_empty() {
            Ok(Value::Null)
        } else if results.len() == 1 {
            Ok(Value::Str(results.into_iter().next().unwrap()))
        } else {
            Ok(Value::Array(results.into_iter().map(Value::Str).collect()))
        }
    }

    pub fn supports(&self, path_syntax: &str) -> bool {
        matches!(path_syntax, "xpath" | "xml")
    }
}

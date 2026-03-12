use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChangeType {
    None,
    Prerelease,
    Prepatch,
    Patch,
    Preminor,
    Minor,
    Premajor,
    Major,
}

impl ChangeType {
    /// Ordered from least to most significant (matching TS SortedChangeTypes).
    pub const SORTED: &[ChangeType] = &[
        ChangeType::None,
        ChangeType::Prerelease,
        ChangeType::Prepatch,
        ChangeType::Patch,
        ChangeType::Preminor,
        ChangeType::Minor,
        ChangeType::Premajor,
        ChangeType::Major,
    ];

    pub fn rank(self) -> usize {
        Self::SORTED.iter().position(|&t| t == self).unwrap_or(0)
    }
}

impl PartialOrd for ChangeType {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for ChangeType {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.rank().cmp(&other.rank())
    }
}

impl fmt::Display for ChangeType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ChangeType::None => write!(f, "none"),
            ChangeType::Prerelease => write!(f, "prerelease"),
            ChangeType::Prepatch => write!(f, "prepatch"),
            ChangeType::Patch => write!(f, "patch"),
            ChangeType::Preminor => write!(f, "preminor"),
            ChangeType::Minor => write!(f, "minor"),
            ChangeType::Premajor => write!(f, "premajor"),
            ChangeType::Major => write!(f, "major"),
        }
    }
}

impl std::str::FromStr for ChangeType {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "none" => Ok(ChangeType::None),
            "prerelease" => Ok(ChangeType::Prerelease),
            "prepatch" => Ok(ChangeType::Prepatch),
            "patch" => Ok(ChangeType::Patch),
            "preminor" => Ok(ChangeType::Preminor),
            "minor" => Ok(ChangeType::Minor),
            "premajor" => Ok(ChangeType::Premajor),
            "major" => Ok(ChangeType::Major),
            _ => Err(format!("invalid change type: {s}")),
        }
    }
}

/// Info saved in each change file.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeFileInfo {
    #[serde(rename = "type")]
    pub change_type: ChangeType,
    pub comment: String,
    pub package_name: String,
    pub email: String,
    pub dependent_change_type: ChangeType,
}

/// Grouped change file format.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeInfoMultiple {
    pub changes: Vec<ChangeFileInfo>,
}

/// A single entry in a ChangeSet.
#[derive(Debug, Clone)]
pub struct ChangeSetEntry {
    pub change: ChangeFileInfo,
    /// Filename the change came from (under changeDir).
    pub change_file: String,
}

/// List of change file infos.
pub type ChangeSet = Vec<ChangeSetEntry>;

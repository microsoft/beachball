package types

import (
	"encoding/json"
	"fmt"
)

// ChangeType represents the type of version bump.
type ChangeType string

const (
	ChangeTypeNone       ChangeType = "none"
	ChangeTypePrerelease ChangeType = "prerelease"
	ChangeTypePrepatch   ChangeType = "prepatch"
	ChangeTypePatch      ChangeType = "patch"
	ChangeTypePreminor   ChangeType = "preminor"
	ChangeTypeMinor      ChangeType = "minor"
	ChangeTypePremajor   ChangeType = "premajor"
	ChangeTypeMajor      ChangeType = "major"
)

var validChangeTypes = map[ChangeType]bool{
	ChangeTypeNone:       true,
	ChangeTypePrerelease: true,
	ChangeTypePrepatch:   true,
	ChangeTypePatch:      true,
	ChangeTypePreminor:   true,
	ChangeTypeMinor:      true,
	ChangeTypePremajor:   true,
	ChangeTypeMajor:      true,
}

func (c ChangeType) String() string {
	return string(c)
}

// ParseChangeType validates and returns a ChangeType from a string.
func ParseChangeType(s string) (ChangeType, error) {
	ct := ChangeType(s)
	if validChangeTypes[ct] {
		return ct, nil
	}
	return "", fmt.Errorf("invalid change type: %q", s)
}

func (c ChangeType) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(c))
}

func (c *ChangeType) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	ct, err := ParseChangeType(s)
	if err != nil {
		return err
	}
	*c = ct
	return nil
}

// IsValidChangeType checks if a string is a valid change type.
func IsValidChangeType(s string) bool {
	return validChangeTypes[ChangeType(s)]
}

// ChangeFileInfo is the info saved in each change file.
type ChangeFileInfo struct {
	Type                ChangeType `json:"type"`
	Comment             string     `json:"comment"`
	PackageName         string     `json:"packageName"`
	Email               string     `json:"email"`
	DependentChangeType ChangeType `json:"dependentChangeType"`
}

// ChangeInfoMultiple is the info saved in grouped change files.
type ChangeInfoMultiple struct {
	Changes []ChangeFileInfo `json:"changes"`
}

// ChangeSetEntry is one entry in a change set.
type ChangeSetEntry struct {
	Change     ChangeFileInfo
	ChangeFile string
}

// ChangeSet is a list of change file infos.
type ChangeSet []ChangeSetEntry

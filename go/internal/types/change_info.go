package types

import (
	"encoding/json"
	"fmt"
)

// ChangeType represents the type of version bump.
type ChangeType int

const (
	ChangeTypeNone ChangeType = iota
	ChangeTypePrerelease
	ChangeTypePrepatch
	ChangeTypePatch
	ChangeTypePreminor
	ChangeTypeMinor
	ChangeTypePremajor
	ChangeTypeMajor
)

var changeTypeStrings = map[ChangeType]string{
	ChangeTypeNone:       "none",
	ChangeTypePrerelease: "prerelease",
	ChangeTypePrepatch:   "prepatch",
	ChangeTypePatch:      "patch",
	ChangeTypePreminor:   "preminor",
	ChangeTypeMinor:      "minor",
	ChangeTypePremajor:   "premajor",
	ChangeTypeMajor:      "major",
}

var stringToChangeType = map[string]ChangeType{
	"none":       ChangeTypeNone,
	"prerelease": ChangeTypePrerelease,
	"prepatch":   ChangeTypePrepatch,
	"patch":      ChangeTypePatch,
	"preminor":   ChangeTypePreminor,
	"minor":      ChangeTypeMinor,
	"premajor":   ChangeTypePremajor,
	"major":      ChangeTypeMajor,
}

func (c ChangeType) String() string {
	if s, ok := changeTypeStrings[c]; ok {
		return s
	}
	return "unknown"
}

func ParseChangeType(s string) (ChangeType, error) {
	if ct, ok := stringToChangeType[s]; ok {
		return ct, nil
	}
	return ChangeTypeNone, fmt.Errorf("invalid change type: %q", s)
}

func (c ChangeType) MarshalJSON() ([]byte, error) {
	return json.Marshal(c.String())
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
	_, ok := stringToChangeType[s]
	return ok
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

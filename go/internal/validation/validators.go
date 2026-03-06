package validation

import "github.com/microsoft/beachball/internal/types"

var validAuthTypes = map[string]bool{
	"authToken": true,
	"password":  true,
}

// IsValidAuthType checks if the auth type is valid.
func IsValidAuthType(authType string) bool {
	return validAuthTypes[authType]
}

// IsValidChangeType checks if a change type string is valid.
func IsValidChangeType(s string) bool {
	return types.IsValidChangeType(s)
}

// IsValidDependentChangeType checks if a dependent change type is valid.
func IsValidDependentChangeType(s string, disallowed []string) bool {
	if !types.IsValidChangeType(s) {
		return false
	}
	for _, d := range disallowed {
		if s == d {
			return false
		}
	}
	return true
}

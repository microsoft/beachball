package validation

import (
	"slices"

	"github.com/microsoft/beachball/internal/types"
)

var validAuthTypes = map[types.AuthType]bool{
	types.AuthTypeAuthToken: true,
	types.AuthTypePassword:  true,
}

// IsValidAuthType checks if the auth type is valid.
func IsValidAuthType(authType types.AuthType) bool {
	return validAuthTypes[authType]
}

// IsValidChangeType checks if a change type is valid.
func IsValidChangeType(ct types.ChangeType) bool {
	return types.IsValidChangeType(string(ct))
}

// IsValidDependentChangeType checks if a dependent change type is valid.
func IsValidDependentChangeType(ct types.ChangeType, disallowed []types.ChangeType) bool {
	if !types.IsValidChangeType(string(ct)) {
		return false
	}
	return !slices.Contains(disallowed, ct)
}

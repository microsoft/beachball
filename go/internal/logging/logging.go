package logging

import (
	"fmt"
	"strings"
)

// BulletedList formats a list of strings as a bulleted list.
func BulletedList(items []string) string {
	var sb strings.Builder
	for _, item := range items {
		fmt.Fprintf(&sb, " - %s\n", item)
	}
	return strings.TrimRight(sb.String(), "\n")
}

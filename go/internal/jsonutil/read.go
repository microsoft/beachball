package jsonutil

import (
	"encoding/json"
	"fmt"
	"os"
)

// ReadJSON reads a JSON file and unmarshals it into the given type.
func ReadJSON[T any](filePath string) (T, error) {
	var result T
	data, err := os.ReadFile(filePath)
	if err != nil {
		return result, fmt.Errorf("reading %s: %w", filePath, err)
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return result, fmt.Errorf("parsing %s: %w", filePath, err)
	}
	return result, nil
}

package testutil

import (
	"path/filepath"

	"github.com/microsoft/beachball/internal/types"
)

// MakePackageInfos builds PackageInfos from a map of folder->name, with root prefix.
func MakePackageInfos(root string, folders map[string]string) types.PackageInfos {
	infos := make(types.PackageInfos)
	for folder, name := range folders {
		infos[name] = &types.PackageInfo{
			Name:            name,
			Version:         "1.0.0",
			PackageJSONPath: filepath.Join(root, folder, "package.json"),
		}
	}
	return infos
}

// MakePackageInfosSimple builds PackageInfos from names, defaulting folder to packages/{name}.
func MakePackageInfosSimple(root string, names ...string) types.PackageInfos {
	folders := make(map[string]string, len(names))
	for _, name := range names {
		folders[filepath.Join("packages", name)] = name
	}
	return MakePackageInfos(root, folders)
}

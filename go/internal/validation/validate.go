package validation

import (
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/microsoft/beachball/internal/changefile"
	"github.com/microsoft/beachball/internal/git"
	"github.com/microsoft/beachball/internal/logging"
	"github.com/microsoft/beachball/internal/monorepo"
	"github.com/microsoft/beachball/internal/types"
)

// ValidateOptions controls what validation checks are performed.
type ValidateOptions struct {
	CheckChangeNeeded       bool
	AllowMissingChangeFiles bool
}

// ValidationResult holds the result of validation.
type ValidationResult struct {
	IsChangeNeeded  bool
	ChangedPackages []string
	PackageInfos    types.PackageInfos
	PackageGroups   types.PackageGroups
	ScopedPackages  types.ScopedPackages
	ChangeSet       types.ChangeSet
}

// Validate runs validation of options, change files, and packages.
func Validate(parsed types.ParsedOptions, validateOpts ValidateOptions) (*ValidationResult, error) {
	options := &parsed.Options
	hasError := false

	logError := func(msg string) {
		fmt.Fprintf(os.Stderr, "ERROR: %s\n", msg)
		hasError = true
	}

	fmt.Println("\nValidating options and change files...")

	// Check for untracked changes
	untracked, _ := git.GetUntrackedChanges(options.Path)
	if len(untracked) > 0 {
		fmt.Fprintf(os.Stderr, "WARN: There are untracked changes in your repository:\n%s\n",
			logging.BulletedList(untracked))
	}

	packageInfos, err := monorepo.GetPackageInfos(options)
	if err != nil {
		return nil, fmt.Errorf("failed to get package infos: %w", err)
	}

	if options.All && len(options.Package) > 0 {
		logError("Cannot specify both \"all\" and \"package\" options")
	} else if len(options.Package) > 0 {
		var invalidReasons []string
		for _, pkg := range options.Package {
			info, ok := packageInfos[pkg]
			if !ok {
				invalidReasons = append(invalidReasons, fmt.Sprintf("%q was not found", pkg))
			} else if info.Private {
				invalidReasons = append(invalidReasons, fmt.Sprintf("%q is marked as private", pkg))
			}
		}
		if len(invalidReasons) > 0 {
			logError(fmt.Sprintf("Invalid package(s) specified:\n%s", logging.BulletedList(invalidReasons)))
		}
	}

	if options.AuthType != "" && !IsValidAuthType(options.AuthType) {
		logError(fmt.Sprintf("authType %q is not valid", options.AuthType))
	}

	if options.Command == "publish" && options.Token != "" {
		if options.Token == "" {
			logError("token should not be an empty string")
		} else if strings.HasPrefix(options.Token, "$") && options.AuthType != "password" {
			logError(fmt.Sprintf("token appears to be a variable reference: %q", options.Token))
		}
	}

	if options.DependentChangeType != "" && !IsValidChangeType(options.DependentChangeType) {
		logError(fmt.Sprintf("dependentChangeType %q is not valid", options.DependentChangeType))
	}

	if options.Type != "" && !IsValidChangeType(options.Type) {
		logError(fmt.Sprintf("Change type %q is not valid", options.Type))
	}

	packageGroups := monorepo.GetPackageGroups(packageInfos, options.Path, options.Groups)
	scopedPackages := monorepo.GetScopedPackages(options, packageInfos)
	changeSet := changefile.ReadChangeFiles(options, packageInfos, scopedPackages)

	for _, entry := range changeSet {
		disallowed := changefile.GetDisallowedChangeTypes(entry.Change.PackageName, packageInfos, packageGroups, options)

		changeTypeStr := entry.Change.Type.String()
		if changeTypeStr == "" {
			logError(fmt.Sprintf("Change type is missing in %s", entry.ChangeFile))
		} else if !IsValidChangeType(changeTypeStr) {
			logError(fmt.Sprintf("Invalid change type detected in %s: %q", entry.ChangeFile, changeTypeStr))
		} else {
			for _, d := range disallowed {
				if changeTypeStr == d {
					logError(fmt.Sprintf("Disallowed change type detected in %s: %q", entry.ChangeFile, changeTypeStr))
					break
				}
			}
		}

		depTypeStr := entry.Change.DependentChangeType.String()
		if depTypeStr == "" {
			logError(fmt.Sprintf("dependentChangeType is missing in %s", entry.ChangeFile))
		} else if !IsValidDependentChangeType(depTypeStr, disallowed) {
			logError(fmt.Sprintf("Invalid dependentChangeType detected in %s: %q", entry.ChangeFile, depTypeStr))
		}
	}

	if hasError {
		return nil, fmt.Errorf("validation failed")
	}

	result := &ValidationResult{
		PackageInfos:   packageInfos,
		PackageGroups:  packageGroups,
		ScopedPackages: scopedPackages,
		ChangeSet:      changeSet,
	}

	if validateOpts.CheckChangeNeeded {
		changedPackages, err := changefile.GetChangedPackages(options, packageInfos, scopedPackages)
		if err != nil {
			return nil, err
		}
		result.ChangedPackages = changedPackages
		result.IsChangeNeeded = len(changedPackages) > 0

		if result.IsChangeNeeded {
			msg := "Found changes in the following packages"
			if options.All {
				msg = "Considering the following packages due to --all"
			} else if len(options.Package) > 0 {
				msg = "Considering the specific --package"
			}
			sorted := make([]string, len(changedPackages))
			copy(sorted, changedPackages)
			sort.Strings(sorted)
			fmt.Printf("%s:\n%s\n", msg, logging.BulletedList(sorted))
		}

		if result.IsChangeNeeded && !validateOpts.AllowMissingChangeFiles {
			logError("Change files are needed!")
			fmt.Println(options.ChangeHint)
			return nil, fmt.Errorf("change files needed")
		}

		if options.DisallowDeletedChangeFiles && AreChangeFilesDeleted(options) {
			logError("Change files must not be deleted!")
			return nil, fmt.Errorf("change files deleted")
		}
	}

	fmt.Println()

	return result, nil
}

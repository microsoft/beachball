package main

import (
	"os"

	"github.com/microsoft/beachball/internal/commands"
	"github.com/microsoft/beachball/internal/logging"
	"github.com/microsoft/beachball/internal/options"
	"github.com/microsoft/beachball/internal/types"
	"github.com/spf13/cobra"
)

func main() {
	var cli types.CliOptions

	rootCmd := &cobra.Command{
		Use:   "beachball",
		Short: "Beachball - automated semantic versioning and change management",
	}

	// Persistent flags
	rootCmd.PersistentFlags().StringVar(&cli.Branch, "branch", "", "target branch")
	rootCmd.PersistentFlags().StringVar(&cli.Path, "path", "", "path to the repository")
	rootCmd.PersistentFlags().StringVar(&cli.ConfigPath, "config-path", "", "path to beachball config")

	boolPtr := func(b bool) *bool { return &b }

	checkCmd := &cobra.Command{
		Use:   "check",
		Short: "Check if change files are needed",
		RunE: func(cmd *cobra.Command, args []string) error {
			cli.Command = "check"
			cwd, _ := os.Getwd()
			parsed, err := options.GetParsedOptions(cwd, cli)
			if err != nil {
				return err
			}
			return commands.Check(parsed)
		},
	}

	changeCmd := &cobra.Command{
		Use:   "change",
		Short: "Create change files",
		RunE: func(cmd *cobra.Command, args []string) error {
			cli.Command = "change"
			cwd, _ := os.Getwd()
			parsed, err := options.GetParsedOptions(cwd, cli)
			if err != nil {
				return err
			}
			return commands.Change(parsed)
		},
	}
	changeCmd.Flags().StringVarP(&cli.ChangeType, "type", "t", "", "change type (patch, minor, major, etc.)")
	changeCmd.Flags().StringVarP(&cli.Message, "message", "m", "", "change description")
	changeCmd.Flags().StringSliceVar(&cli.Package, "package", nil, "specific package(s) to create change files for")

	var noCommitFlag bool
	changeCmd.Flags().BoolVar(&noCommitFlag, "no-commit", false, "don't commit change files")

	var noFetchFlag bool
	rootCmd.PersistentFlags().BoolVar(&noFetchFlag, "no-fetch", false, "don't fetch remote branch")

	var allFlag, verboseFlag bool
	rootCmd.PersistentFlags().BoolVar(&allFlag, "all", false, "include all packages")
	rootCmd.PersistentFlags().BoolVar(&verboseFlag, "verbose", false, "verbose output")

	cobra.OnInitialize(func() {
		if rootCmd.PersistentFlags().Changed("all") {
			cli.All = boolPtr(allFlag)
		}
		if rootCmd.PersistentFlags().Changed("verbose") {
			cli.Verbose = boolPtr(verboseFlag)
		}
		if rootCmd.PersistentFlags().Changed("no-fetch") {
			cli.Fetch = boolPtr(!noFetchFlag)
		}
		if changeCmd.Flags().Changed("no-commit") {
			cli.Commit = boolPtr(!noCommitFlag)
		}
	})

	rootCmd.AddCommand(checkCmd, changeCmd)

	if err := rootCmd.Execute(); err != nil {
		logging.Error.Println(err)
		os.Exit(1)
	}
}

(window.webpackJsonp=window.webpackJsonp||[]).push([[16],{293:function(e,t,s){"use strict";s.r(t);var n=s(10),a=Object(n.a)({},(function(){var e=this,t=e._self._c;return t("ContentSlotsDistributor",{attrs:{"slot-key":e.$parent.slotKey}},[t("h1",{attrs:{id:"ci-integration"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#ci-integration"}},[e._v("#")]),e._v(" CI Integration")]),e._v(" "),t("p",[e._v("There are two parts to CI integration with "),t("code",[e._v("beachball")]),e._v(":")]),e._v(" "),t("ol",[t("li",[t("a",{attrs:{href:"./change-files#validating-change-files"}},[e._v("Add a PR build step")]),e._v(" to call "),t("code",[e._v("beachball check")]),e._v(" to validate that change files are included.")]),e._v(" "),t("li",[e._v("Add a release build step to call "),t("code",[e._v("beachball publish")]),e._v(" to publish to npm and push back to git (this page).")])]),e._v(" "),t("p",[e._v("To automate the bumping of package versions based on change files, you'll need to configure your release workflow/pipeline so that "),t("code",[e._v("beachball publish")]),e._v(" has write access to the git repo and npm registry. The exact steps will vary between CI systems, but general concepts as well as steps for some common setups are outlined below.")]),e._v(" "),t("h2",{attrs:{id:"authentication"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#authentication"}},[e._v("#")]),e._v(" Authentication")]),e._v(" "),t("p",[e._v("Automated publishing from a GitHub repo to the public npm registry ("),t("code",[e._v("registry.npmjs.org")]),e._v(") typically uses personal access tokens for authentication. These tokens are stored as secrets in your CI system. You should ensure that these secrets are only available to release builds.")]),e._v(" "),t("p",[e._v("For Azure DevOps repos publishing to a private registry, there are other possible approaches (such as using a service account with credentials stored in a key vault) which are not currently covered by these docs.")]),e._v(" "),t("h3",{attrs:{id:"generating-tokens"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#generating-tokens"}},[e._v("#")]),e._v(" Generating tokens")]),e._v(" "),t("h4",{attrs:{id:"npm-token"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#npm-token"}},[e._v("#")]),e._v(" npm token")]),e._v(" "),t("p",[e._v("If publishing to the public npm registry ("),t("code",[e._v("registry.npmjs.org")]),e._v("), "),t("a",{attrs:{href:"https://docs.npmjs.com/creating-and-viewing-access-tokens#creating-granular-access-tokens-on-the-website",target:"_blank",rel:"noopener noreferrer"}},[e._v("create a granular access token"),t("OutboundLink")],1),e._v(" with write access to only the relevant package(s) and/or scope(s). Classic automation tokens are not recommended due to their overly broad permissions.")]),e._v(" "),t("h4",{attrs:{id:"github-token"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#github-token"}},[e._v("#")]),e._v(" GitHub token")]),e._v(" "),t("p",[e._v("You should use "),t("a",{attrs:{href:"https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/managing-a-branch-protection-rule",target:"_blank",rel:"noopener noreferrer"}},[e._v("branch protection"),t("OutboundLink")],1),e._v(" for your "),t("code",[e._v("main")]),e._v("/"),t("code",[e._v("master")]),e._v(" branch, but this creates some difficulties for pushing changes back during automated publishing.")]),e._v(" "),t("p",[e._v("The main way to allow "),t("code",[e._v("beachball")]),e._v(" to push back to a repo with branch protections is by using a "),t("a",{attrs:{href:"https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token#personal-access-tokens-classic",target:"_blank",rel:"noopener noreferrer"}},[e._v("classic personal access token"),t("OutboundLink")],1),e._v(" with "),t("code",[e._v("repo")]),e._v(" permissions. (If the repo is part of an organization that uses SAML single sign-on (SSO), be sure to "),t("a",{attrs:{href:"https://docs.github.com/en/authentication/authenticating-with-saml-single-sign-on/authorizing-a-personal-access-token-for-use-with-saml-single-sign-on",target:"_blank",rel:"noopener noreferrer"}},[e._v("authorize the token for SSO access"),t("OutboundLink")],1),e._v(".) Since classic PATs have broad permissions, they must only be accessible to release builds—"),t("a",{attrs:{href:"#storing-tokens"}},[e._v("instructions below")]),e._v(".")]),e._v(" "),t("p",[e._v('An alternative approach is creating a classic PAT with a "machine user" account. Create a new account with an alternate email or '),t("a",{attrs:{href:"https://en.wikipedia.org/wiki/Email_address#Subaddressing",target:"_blank",rel:"noopener noreferrer"}},[e._v("subaddress"),t("OutboundLink")],1),e._v(" ("),t("code",[e._v("+")]),e._v(' address), give it contributor permissions to only this repo, and add it under "Restrict who can push to matching branches" in the branch protection rule.')]),e._v(" "),t("p",[e._v("(It's unclear if/when branch policy bypass support will be added for "),t("a",{attrs:{href:"https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token#creating-a-fine-grained-personal-access-token",target:"_blank",rel:"noopener noreferrer"}},[e._v("fine-grained PATs"),t("OutboundLink")],1),e._v("; it's been "),t("a",{attrs:{href:"https://github.com/community/community/discussions/36441?sort=top#discussioncomment-4602435",target:"_blank",rel:"noopener noreferrer"}},[e._v("requested"),t("OutboundLink")],1),e._v(" by users with no response and doesn't seem to be on the "),t("a",{attrs:{href:"https://github.com/orgs/github/projects/4247/views/1",target:"_blank",rel:"noopener noreferrer"}},[e._v("public roadmap"),t("OutboundLink")],1),e._v(". The "),t("a",{attrs:{href:"https://docs.github.com/en/actions/security-guides/automatic-token-authentication",target:"_blank",rel:"noopener noreferrer"}},[e._v("built-in "),t("code",[e._v("GITHUB_TOKEN")]),t("OutboundLink")],1),e._v(" won't work for the same reason.)")]),e._v(" "),t("h3",{attrs:{id:"storing-tokens"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#storing-tokens"}},[e._v("#")]),e._v(" Storing tokens")]),e._v(" "),t("h4",{attrs:{id:"secrets-github-actions"}},[e._v("GitHub Actions"),e._v(" "),t("p",[e._v("To restrict secret access to appropriate branches, use an "),t("strong",[t("a",{attrs:{href:"https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment",target:"_blank",rel:"noopener noreferrer"}},[e._v("environment"),t("OutboundLink")],1)]),e._v(". (The docs for environments focus on cloud deployments or resources, but environments can also be used only for secret storage.)")]),e._v(" "),t("ol",[t("li",[t("a",{attrs:{href:"https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment#creating-an-environment",target:"_blank",rel:"noopener noreferrer"}},[e._v("Create an environment"),t("OutboundLink")],1),e._v(".")]),e._v(" "),t("li",[e._v("Restrict "),t("a",{attrs:{href:"https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment#deployment-branches",target:"_blank",rel:"noopener noreferrer"}},[e._v("deployment branches"),t("OutboundLink")],1),e._v(' to "Selected branches" and add a rule to allow only your release branch(es) (often '),t("code",[e._v("main")]),e._v("/"),t("code",[e._v("master")]),e._v(").")]),e._v(" "),t("li",[t("a",{attrs:{href:"https://docs.github.com/en/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-an-environment",target:"_blank",rel:"noopener noreferrer"}},[e._v("Add secrets"),t("OutboundLink")],1),e._v(" for the npm and GitHub tokens.")]),e._v(" "),t("li",[e._v("To "),t("a",{attrs:{href:"https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment#using-an-environment",target:"_blank",rel:"noopener noreferrer"}},[e._v("use the environment"),t("OutboundLink")],1),e._v(", add a key "),t("code",[e._v("environment: your-env-name")]),e._v(" in your release workflow job. (Full example below.)")])]),e._v(" "),t("h4",{attrs:{id:"secrets-azure-pipelines"}},[e._v("Azure Pipelines"),e._v(" "),t("p",[e._v("There are a couple of options here:")]),e._v(" "),t("ul",[t("li",[e._v("Use "),t("a",{attrs:{href:"https://learn.microsoft.com/en-us/azure/devops/pipelines/process/variables?view=azure-devops&tabs=yaml%2Cbatch#secret-variables",target:"_blank",rel:"noopener noreferrer"}},[e._v("secret variables in your release pipeline"),t("OutboundLink")],1),e._v(".")]),e._v(" "),t("li",[e._v("Use "),t("a",{attrs:{href:"https://learn.microsoft.com/en-us/azure/devops/pipelines/library/variable-groups?view=azure-devops&tabs=classic",target:"_blank",rel:"noopener noreferrer"}},[e._v("secrets in a variable group"),t("OutboundLink")],1),e._v(", which can optionally be linked to a key vault. Ensure that this variable group is only accessible to your release pipeline.")])]),e._v(" "),t("h2",{attrs:{id:"setting-options-for-publishing"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#setting-options-for-publishing"}},[e._v("#")]),e._v(" Setting options for publishing")]),e._v(" "),t("p",[e._v("If you're passing any custom options besides the npm token to "),t("code",[e._v("beachball publish")]),e._v(", it's recommended to set them in either the "),t("code",[e._v("beachball")]),e._v(" config (if they don't interfere with other commands), or a "),t("code",[e._v("package.json")]),e._v(" script (if specific to "),t("code",[e._v("publish")]),e._v(").")]),e._v(" "),t("p",[e._v("For example, the following script could be used for publishing public scoped packages:")]),e._v(" "),t("div",{staticClass:"language-json extra-class"},[t("pre",{pre:!0,attrs:{class:"language-json"}},[t("code",[t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("{")]),e._v("\n  "),t("span",{pre:!0,attrs:{class:"token property"}},[e._v('"scripts"')]),t("span",{pre:!0,attrs:{class:"token operator"}},[e._v(":")]),e._v(" "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("{")]),e._v("\n    "),t("span",{pre:!0,attrs:{class:"token property"}},[e._v('"release"')]),t("span",{pre:!0,attrs:{class:"token operator"}},[e._v(":")]),e._v(" "),t("span",{pre:!0,attrs:{class:"token string"}},[e._v('"beachball publish --access public"')]),e._v("\n  "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("}")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("}")]),e._v("\n")])])]),t("p",[e._v("If you're publishing to a private feed, "),t("code",[e._v("registry")]),e._v(" should be set in the overall "),t("code",[e._v("beachball")]),e._v(" config, since it's also used by the "),t("code",[e._v("sync")]),e._v(" command. For example, if your beachball config is in the root "),t("code",[e._v("package.json")]),e._v(" (or it works the same in a config file):")]),e._v(" "),t("div",{staticClass:"language-json extra-class"},[t("pre",{pre:!0,attrs:{class:"language-json"}},[t("code",[t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("{")]),e._v("\n  "),t("span",{pre:!0,attrs:{class:"token property"}},[e._v('"beachball"')]),t("span",{pre:!0,attrs:{class:"token operator"}},[e._v(":")]),e._v(" "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("{")]),e._v("\n    "),t("span",{pre:!0,attrs:{class:"token property"}},[e._v('"registry"')]),t("span",{pre:!0,attrs:{class:"token operator"}},[e._v(":")]),e._v(" "),t("span",{pre:!0,attrs:{class:"token string"}},[e._v('"https://pkgs.dev.azure.com/some-org/_packaging/some-feed/npm/registry/"')]),e._v("\n  "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("}")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("}")]),e._v("\n")])])]),t("h2",{attrs:{id:"publishing"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#publishing"}},[e._v("#")]),e._v(" Publishing")]),e._v(" "),t("p",[e._v("The exact publishing setup will vary depending on your CI setup, but the overall steps are as follows:")]),e._v(" "),t("ol",[t("li",[e._v("Ensure the git user name and email are set, or git will reject the commit. Somewhere in your pipeline:"),t("div",{staticClass:"language-bash extra-class"},[t("pre",{pre:!0,attrs:{class:"language-bash"}},[t("code",[t("span",{pre:!0,attrs:{class:"token function"}},[e._v("git")]),e._v(" config user.name "),t("span",{pre:!0,attrs:{class:"token string"}},[e._v('"someone"')]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token function"}},[e._v("git")]),e._v(" config user.email "),t("span",{pre:!0,attrs:{class:"token string"}},[e._v('"someone@example.com"')]),e._v("\n")])])])]),e._v(" "),t("li",[e._v("Set up git authentication. This could use tokens (covered below), SSH keys, or some other non-interactive method.")]),e._v(" "),t("li",[e._v("Set up npm authentication. This could use tokens passed on the command line (covered below), tokens set in "),t("code",[e._v(".npmrc")]),e._v(", or some other method.")]),e._v(" "),t("li",[e._v("Run "),t("code",[e._v("beachball publish")]),e._v("!")])]),e._v(" "),t("h3",{attrs:{id:"github-repo-github-actions"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#github-repo-github-actions"}},[e._v("#")]),e._v(" GitHub repo + GitHub Actions")]),e._v(" "),t("p",[e._v("Here's a sample setup for publishing from a GitHub repo using GitHub actions. The environment, secret, and script names can be modified as you prefer.")]),e._v(" "),t("p",[e._v("This sample assumes the following:")]),e._v(" "),t("ul",[t("li",[e._v("An environment called "),t("code",[e._v("release")]),e._v(" (set up "),t("a",{attrs:{href:"#secrets-github-actions"}},[e._v("as described above")]),e._v(") with the following secrets:\n"),t("ul",[t("li",[t("code",[e._v("REPO_PAT")]),e._v(": A GitHub classic personal access token with admin access ("),t("a",{attrs:{href:"#generating-a-github-token"}},[e._v("as described above")]),e._v(")")]),e._v(" "),t("li",[t("code",[e._v("NPM_TOKEN")]),e._v(": An npm token with write access to the package(s) and/or scope(s), such as a "),t("a",{attrs:{href:"#generating-an-npm-token"}},[e._v("fine-grained token for public npm")])])])]),e._v(" "),t("li",[e._v("A repo root "),t("code",[e._v("package.json")]),e._v(" script "),t("code",[e._v("release")]),e._v(" which runs "),t("code",[e._v("beachball publish")])]),e._v(" "),t("li",[e._v("The build is running on a Linux/Mac agent. (This could be easily adapted to a Windows agent with different syntax in the commands.)")])]),e._v(" "),t("p",[e._v("Note that in GitHub Actions, it's easiest to set up authentication if you set "),t("code",[e._v("persist-credentials: false")]),e._v(" when checking out code.")]),e._v(" "),t("div",{staticClass:"language-yml extra-class"},[t("pre",{pre:!0,attrs:{class:"language-yml"}},[t("code",[t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("# Example trigger configurations (choose one or more, or another setup)")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("# on:")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("#   # Release on push to main")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("#   push:")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("#     branches: [main]")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("#   # Release daily (see https://crontab-generator.org/ for help with schedules)")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("#   schedule:")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("#     - cron: '0 8 * * *'")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("#   # Release on manual trigger (can be used alone or with other options)")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("#   workflow_dispatch:")]),e._v("\n\n"),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("environment")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v(" release\n\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("# Variable syntax below assumes Linux/Mac but could be easily adapted to Windows")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("runs-on")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v(" ubuntu"),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("-")]),e._v("latest\n\n"),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("steps")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v("\n  "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("-")]),e._v(" "),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("name")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v(" Check out code\n    "),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("uses")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v(" actions/checkout@v3\n    "),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("with")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v("\n      "),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("# Prevent the action from storing credentials in a way that's hard to override")]),e._v("\n      "),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("persist-credentials")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v(" "),t("span",{pre:!0,attrs:{class:"token boolean important"}},[e._v("false")]),e._v("\n\n  "),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("# ... Other steps to prepare for publishing (install, build, test, etc) ...")]),e._v("\n\n  "),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("# Set the name, email, and URL with PAT")]),e._v("\n  "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("-")]),e._v(" "),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("name")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v(" Set git credentials\n    "),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("run")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v(" "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("|")]),t("span",{pre:!0,attrs:{class:"token scalar string"}},[e._v('\n      git config user.name "someone"\n      git config user.email "someone@example.com"\n      git remote set-url origin "https://$REPO_PAT@github.com/your-org/your-repo"')]),e._v("\n    "),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("env")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v("\n      "),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("REPO_PAT")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v(" $"),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("{")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("{")]),e._v(" secrets.REPO_PAT "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("}")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("}")]),e._v("\n\n  "),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("# Pass the token on the command line for publishing")]),e._v("\n  "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("-")]),e._v(" "),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("name")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v(" Publish\n    "),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("run")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v(" npm run release "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("-")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("-")]),e._v(" "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("-")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("-")]),e._v('token "$NPM_TOKEN"\n    '),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("env")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v("\n      "),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("NPM_TOKEN")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v(" $"),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("{")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("{")]),e._v(" secrets.NPM_TOKEN "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("}")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("}")]),e._v("\n")])])]),t("h3",{attrs:{id:"github-repo-azure-pipelines"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#github-repo-azure-pipelines"}},[e._v("#")]),e._v(" GitHub repo + Azure Pipelines")]),e._v(" "),t("p",[e._v("Here's a sample setup for publishing from a GitHub repo using Azure Pipelines. The environment, secret, and script names can be modified as you prefer.")]),e._v(" "),t("p",[e._v("This sample assumes the following:")]),e._v(" "),t("ul",[t("li",[e._v("A variable group called "),t("code",[e._v("Beachball secrets")]),e._v(" (set up "),t("a",{attrs:{href:"#secrets-azure-pipelines"}},[e._v("as described above")]),e._v(") with the following secrets:\n"),t("ul",[t("li",[t("code",[e._v("GITHUB_PAT")]),e._v(": A GitHub classic personal access token with admin access ("),t("a",{attrs:{href:"#generating-a-github-token"}},[e._v("as described above")]),e._v(")")]),e._v(" "),t("li",[t("code",[e._v("NPM_TOKEN")]),e._v(": An npm token with write access to the package(s) and/or scope(s), such as a "),t("a",{attrs:{href:"#generating-an-npm-token"}},[e._v("fine-grained token for public npm")])])])]),e._v(" "),t("li",[e._v("A repo root "),t("code",[e._v("package.json")]),e._v(" script "),t("code",[e._v("release")]),e._v(" which runs "),t("code",[e._v("beachball publish")])]),e._v(" "),t("li",[e._v("The build is running on a Linux/Mac agent. (This could be easily adapted to a Windows agent with different syntax in the commands.)")])]),e._v(" "),t("div",{staticClass:"language-yml extra-class"},[t("pre",{pre:!0,attrs:{class:"language-yml"}},[t("code",[t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("# Example trigger configurations (choose one or more, or another setup)")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("#")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("# # Release on push to main")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("# trigger: [main]")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("#")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("# # Release on a schedule")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("# # https://docs.microsoft.com/en-us/azure/devops/pipelines/build/triggers?tabs=yaml&view=azure-devops#supported-cron-syntax")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("# schedules:")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("#   - cron: '0 8 * * *'")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("#     branches:")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("#       include: [main]")]),e._v("\n\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("# This group should only be accessible to the release pipeline")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("variables")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v("\n  "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("-")]),e._v(" "),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("group")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v(" Beachball secrets\n\n"),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("# Variable syntax below assumes Linux/Mac but could be easily adapted to Windows")]),e._v("\n"),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("pool")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v("\n  "),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("vmImage")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v(" ubuntu"),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("-")]),e._v("latest\n\n"),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("steps")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v("\n  "),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("# ... Other steps to set up repo and prepare for publishing (install, build, test, etc) ...")]),e._v("\n\n  "),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("# Set the name, email, and URL with PAT")]),e._v("\n  "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("-")]),e._v(" "),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("script")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v(" "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("|")]),t("span",{pre:!0,attrs:{class:"token scalar string"}},[e._v('\n      git config user.name "someone"\n      git config user.email "someone@example.com"\n      git remote set-url origin "https://$(REPO_PAT)@github.com/your-org/your-repo"')]),e._v("\n    "),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("name")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v(" Set git credentials\n\n  "),t("span",{pre:!0,attrs:{class:"token comment"}},[e._v("# Pass the token on the command line for publishing")]),e._v("\n  "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("-")]),e._v(" "),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("script")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v(" npm run release "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("-")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("-")]),e._v(" "),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("-")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v("-")]),e._v('token "$(NPM_TOKEN)"\n    '),t("span",{pre:!0,attrs:{class:"token key atrule"}},[e._v("name")]),t("span",{pre:!0,attrs:{class:"token punctuation"}},[e._v(":")]),e._v(" Publish\n")])])]),t("h3",{attrs:{id:"azure-repos-azure-pipelines"}},[t("a",{staticClass:"header-anchor",attrs:{href:"#azure-repos-azure-pipelines"}},[e._v("#")]),e._v(" Azure Repos + Azure Pipelines")]),e._v(" "),t("p",[e._v("This should be very similar to the GitHub version, aside from possibly the authentication method. You could potentially use personal access tokens for git and npm feed authentication (similar to above), or other methods are available which aren't currently covered here.")]),e._v(" "),t("p",[e._v("If you're publishing to a private Azure Artifacts npm feed, be sure to set "),t("code",[e._v("registry")]),e._v(" in the "),t("code",[e._v("beachball")]),e._v(" config "),t("a",{attrs:{href:"#setting-options-for-publishing"}},[e._v("as described above")]),e._v(".")])])])])}),[],!1,null,null,null);t.default=a.exports}}]);
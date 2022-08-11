(window.webpackJsonp=window.webpackJsonp||[]).push([[10],{280:function(t,a,e){"use strict";e.r(a);var s=e(10),n=Object(s.a)({},(function(){var t=this,a=t._self._c;return a("ContentSlotsDistributor",{attrs:{"slot-key":t.$parent.slotKey}},[a("h1",{attrs:{id:"check"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#check"}},[t._v("#")]),t._v(" "),a("code",[t._v("check")])]),t._v(" "),a("p",[t._v("It is useful to enforce that "),a("a",{attrs:{href:"./concepts/change-files"}},[t._v("change files")]),t._v(" are checked in for each PR before they enter the target branch. In this way, all changes are captured and would affect semver appropriately. To check to make sure all changes are captured in change files, simply run:")]),t._v(" "),a("div",{staticClass:"language-bash extra-class"},[a("pre",{pre:!0,attrs:{class:"language-bash"}},[a("code",[t._v("$ beachball check\n")])])]),a("p",[t._v("This command also checks for various types of misconfigurations that would result in problems when attempting to publish.")]),t._v(" "),a("h3",{attrs:{id:"where-should-check-be-run"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#where-should-check-be-run"}},[t._v("#")]),t._v(" Where Should Check Be Run?")]),t._v(" "),a("h4",{attrs:{id:"as-a-step-in-the-pr-review-gate"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#as-a-step-in-the-pr-review-gate"}},[t._v("#")]),t._v(" As a step in the PR review gate")]),t._v(" "),a("p",[t._v("Add a step "),a("code",[t._v("yarn checkchange")]),t._v(" in your PR validation build, where "),a("code",[t._v("checkchange")]),t._v(" is defined in "),a("code",[t._v("package.json")]),t._v(" as "),a("code",[t._v("beachball check")]),t._v(" (with any appropriate options).")]),t._v(" "),a("p",[t._v("Note that in GitHub action workflows, you "),a("strong",[t._v("must")]),t._v(" specify "),a("code",[t._v("fetch-depth: 0")]),t._v(" in the "),a("code",[t._v("checkout")]),t._v(" option. You can see a full example in "),a("a",{attrs:{href:"https://github.com/microsoft/beachball/blob/master/.github/workflows/pr.yml",target:"_blank",rel:"noopener noreferrer"}},[t._v("beachball's own PR workflow"),a("OutboundLink")],1),t._v(".")]),t._v(" "),a("div",{staticClass:"language-yaml extra-class"},[a("pre",{pre:!0,attrs:{class:"language-yaml"}},[a("code",[a("span",{pre:!0,attrs:{class:"token key atrule"}},[t._v("jobs")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(":")]),t._v("\n  "),a("span",{pre:!0,attrs:{class:"token key atrule"}},[t._v("build")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(":")]),t._v("\n    "),a("span",{pre:!0,attrs:{class:"token key atrule"}},[t._v("steps")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(":")]),t._v("\n      "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("-")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token key atrule"}},[t._v("uses")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(":")]),t._v(" actions/checkout@v2\n        "),a("span",{pre:!0,attrs:{class:"token key atrule"}},[t._v("with")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(":")]),t._v("\n          "),a("span",{pre:!0,attrs:{class:"token key atrule"}},[t._v("fetch-depth")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(":")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token number"}},[t._v("0")]),t._v("\n      "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("-")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token key atrule"}},[t._v("name")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(":")]),t._v(" Use Node.js 12\n        "),a("span",{pre:!0,attrs:{class:"token key atrule"}},[t._v("uses")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(":")]),t._v(" actions/setup"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("-")]),t._v("node@v1\n        "),a("span",{pre:!0,attrs:{class:"token key atrule"}},[t._v("with")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(":")]),t._v("\n          "),a("span",{pre:!0,attrs:{class:"token key atrule"}},[t._v("node-version")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(":")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token number"}},[t._v("12")]),t._v("\n      "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("-")]),t._v(" yarn\n      "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("-")]),t._v(" yarn checkchange\n      "),a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("# build/test steps as appropriate")]),t._v("\n")])])]),a("p",[t._v("Another example, for Travis CI:")]),t._v(" "),a("div",{staticClass:"language-yaml extra-class"},[a("pre",{pre:!0,attrs:{class:"language-yaml"}},[a("code",[a("span",{pre:!0,attrs:{class:"token key atrule"}},[t._v("language")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(":")]),t._v(" node_js\n"),a("span",{pre:!0,attrs:{class:"token key atrule"}},[t._v("node_js")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(":")]),t._v("\n  "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("-")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token string"}},[t._v("'12'")]),t._v("\n"),a("span",{pre:!0,attrs:{class:"token key atrule"}},[t._v("script")]),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(":")]),t._v("\n  "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("-")]),t._v(" yarn\n  "),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v("-")]),t._v(" yarn checkchange\n  "),a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("# build/test steps as appropriate")]),t._v("\n")])])]),a("h4",{attrs:{id:"as-git-hook-optional"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#as-git-hook-optional"}},[t._v("#")]),t._v(" As git hook (optional)")]),t._v(" "),a("p",[t._v("For a reference of git hooks, take a look at "),a("a",{attrs:{href:"https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks",target:"_blank",rel:"noopener noreferrer"}},[t._v("this documentation"),a("OutboundLink")],1),t._v(". It is recommended to place this hook as a pre-push.")])])}),[],!1,null,null,null);a.default=n.exports}}]);
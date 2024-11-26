import{_ as s,c as i,a,d as l,o,r as n}from"./app-uCQkGTo0.js";const r={};function c(h,e){const t=n("Mermaid");return o(),i("div",null,[e[0]||(e[0]=a('<h1 id="getting-started" tabindex="-1"><a class="header-anchor" href="#getting-started"><span>Getting started</span></a></h1><h2 id="why-beachball" tabindex="-1"><a class="header-anchor" href="#why-beachball"><span>Why Beachball?</span></a></h2><p>The JavaScript ecosystem moves fast. One reason that this ecosystem is so vibrant and agile is its ability to share code via npm packages. Developers publishing npm packages have to keep track of what&#39;s changed in their code to determine how to bump versions, then make sure the versions in their git repo stay in sync with the npm registry...what a hassle!</p><p><code>beachball</code> helps streamline this process. As developers make PRs, it helps track the types and details of changes being made. Then when it&#39;s time to publish a new version, <code>beachball</code> automates publishing version bumps to npm, generating changelogs, and syncing changes back to the git repo.</p><h2 id="beachball-workflow" tabindex="-1"><a class="header-anchor" href="#beachball-workflow"><span>Beachball workflow</span></a></h2><p><code>beachball</code> fits into your workflow without any extra configuration (by default).</p><p>For the workflow, a <s>picture</s> diagram is worth a thousand words, so here it is:</p>',7)),l(t,{id:"mermaid-21",code:"eJxdkD0OwjAMhfeewmIqQzkCAxsSQwVsVYemtZKgNAn5Gbg9TgKldLDs9+zIn8PdYAXcTxWAxxBt3TrzwDHALak92VJrdMoYW59TBRcqk29d3Ual4IrPiD5kKzIlvSA/52SNYtAcleHdUh3mqacOl6GjAIfWJK3t3FGQ5tIH9+qrLxM0zfGHsUaiDjAcRsEGIikb8rR1mfC//8ErA6VOO9b2ArnxCXTjEGoGjKx84Q52JFcHZ1Xe5eMoo56qNzoWdUc="}),e[1]||(e[1]=a('<p><strong>Inner loop:</strong> When you&#39;ve made some commits to your branch, simply run <a href="../cli/change"><code>beachball change</code></a> to generate change files.</p><p><strong>Pull request:</strong> The PR build runs <a href="../cli/check"><code>beachball check</code></a> to verify change files are included. Your colleagues can review the change file description and type, and easily propose changes if needed. The PR with change files then gets merged to the target branch (e.g. <code>main</code>).</p><p><strong>Publish:</strong> When it&#39;s time to release, <a href="../cli/publish"><code>beachball publish</code></a> is either called <a href="../concepts/ci-integration">by a continuous integration (CI) system</a> or manually by a developer. This does three things:</p><ol><li>All change files are deleted</li><li>Versions are bumped, checked in locally and pushed remotely</li><li>npm packages are published to a public or private registry</li></ol><p>At that point, your repo is ready for the next change!</p><h2 id="next-steps" tabindex="-1"><a class="header-anchor" href="#next-steps"><span>Next steps</span></a></h2><ul><li><a href="./installation">Install <code>beachball</code></a></li><li><a href="../concepts/change-files">Learn more about change files</a></li><li><a href="../concepts/ci-integration">Set up CI integration</a></li></ul>',7))])}const p=s(r,[["render",c],["__file","getting-started.html.vue"]]),g=JSON.parse('{"path":"/overview/getting-started.html","title":"Getting started","lang":"en-US","frontmatter":{"tags":["overview"],"category":"doc"},"headers":[{"level":2,"title":"Why Beachball?","slug":"why-beachball","link":"#why-beachball","children":[]},{"level":2,"title":"Beachball workflow","slug":"beachball-workflow","link":"#beachball-workflow","children":[]},{"level":2,"title":"Next steps","slug":"next-steps","link":"#next-steps","children":[]}],"git":{"updatedTime":1732587575000,"contributors":[{"name":"Elizabeth Craig","email":"elcraig@microsoft.com","commits":1,"url":"https://github.com/Elizabeth Craig"}]},"filePathRelative":"overview/getting-started.md"}');export{p as comp,g as data};

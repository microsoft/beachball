import{_ as a,c as t,a as n,o}from"./app-6Pxy8Dwq.js";const s={};function i(h,e){return o(),t("div",null,e[0]||(e[0]=[n(`<h1 id="check" tabindex="-1"><a class="header-anchor" href="#check"><span><code>check</code></span></a></h1><p>It&#39;s recommended to enforce that <a href="../concepts/change-files">change files</a> are included with each PR. This way, all changes are captured and affect semver appropriately.</p><p>To ensure that all changes are captured in change files, simply run:</p><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh" data-title="sh"><pre><code><span class="line">$ beachball check</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><p>This command also checks for misconfigurations that would result in problems when attempting to publish.</p><h3 id="options" tabindex="-1"><a class="header-anchor" href="#options"><span>Options</span></a></h3><h3 id="options-1" tabindex="-1"><a class="header-anchor" href="#options-1"><span>Options</span></a></h3><p><a href="./options">General options</a> also apply for this command.</p><table><thead><tr><th>Option</th><th>Default</th><th>Description</th></tr></thead><tbody><tr><td><code>--changehint</code></td><td><code>&#39;Run &quot;beachball change&quot; to create a change file&#39;</code></td><td>Hint message if the developer forgot to add a change file.</td></tr><tr><td><code>--disallow-deleted-change-files</code></td><td><code>false</code></td><td>verifies that no change files were deleted between head and target branch</td></tr></tbody></table><h3 id="where-should-check-be-run" tabindex="-1"><a class="header-anchor" href="#where-should-check-be-run"><span>Where should <code>check</code> be run?</span></a></h3><h4 id="as-a-step-in-the-pr-review-gate" tabindex="-1"><a class="header-anchor" href="#as-a-step-in-the-pr-review-gate"><span>As a step in the PR review gate</span></a></h4><p>See the <a href="../concepts/change-files#validating-change-files">change files page</a> for how to set this up.</p><h4 id="not-recommended-as-a-git-hook" tabindex="-1"><a class="header-anchor" href="#not-recommended-as-a-git-hook"><span>Not recommended: as a git hook</span></a></h4><p>While running <code>beachball check</code> as a pre-push hook may seem appealing, it has some downsides: it will substantially slow down running <code>git push</code> and could be annoying when pushing work-in-progress changes to remote branches. Our experience with repos enabling this hook is that it will quickly be removed due to developer feedback.</p><p>If you want to try this, take a look at <a href="https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks" target="_blank" rel="noopener noreferrer">this documentation</a> about git hooks.</p>`,15)]))}const r=a(s,[["render",i],["__file","check.html.vue"]]),l=JSON.parse('{"path":"/cli/check.html","title":"check","lang":"en-US","frontmatter":{"tags":["cli"],"category":"doc"},"headers":[{"level":3,"title":"Options","slug":"options","link":"#options","children":[]},{"level":3,"title":"Options","slug":"options-1","link":"#options-1","children":[]},{"level":3,"title":"Where should check be run?","slug":"where-should-check-be-run","link":"#where-should-check-be-run","children":[]}],"git":{"updatedTime":1733808221000,"contributors":[{"name":"Elizabeth Craig","email":"elcraig@microsoft.com","commits":1,"url":"https://github.com/Elizabeth Craig"}]},"filePathRelative":"cli/check.md"}');export{r as comp,l as data};
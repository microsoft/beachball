import{_ as a,c as s,a as t,o as n}from"./app-uCQkGTo0.js";const i={};function l(c,e){return n(),s("div",null,e[0]||(e[0]=[t(`<h1 id="change" tabindex="-1"><a class="header-anchor" href="#change"><span><code>change</code></span></a></h1><p>This command walks you through a couple of questions and will generate the appropriate <a href="../concepts/change-files">change file</a> in the <code>/change</code> directory. The generated file will be committed automatically.</p><p>One of the niceties of using this utility to generate change files is that it will <a href="./check">check</a> whether or not you even need a change file. Also, it will load recent commit messages to ease change file generation.</p><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh" data-title="sh"><pre><code><span class="line">$ beachball change</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><h3 id="options" tabindex="-1"><a class="header-anchor" href="#options"><span>Options</span></a></h3><p>Some <a href="./options">general options</a> including <code>--branch</code> and <code>--scope</code> also apply for this command.</p><table><thead><tr><th>Option</th><th>Alias</th><th>Default</th><th>Description</th></tr></thead><tbody><tr><td><code>--all</code></td><td></td><td>false</td><td>Generate change files for all packages</td></tr><tr><td><code>--dependent-change-type</code></td><td></td><td><code>patch</code></td><td>use this change type for dependent packages</td></tr><tr><td><code>--message</code></td><td><code>-m</code></td><td>(prompt)</td><td>Description for all change files</td></tr><tr><td><code>--no-commit</code></td><td></td><td>false</td><td>Stage the change files rather than committing</td></tr><tr><td><code>--package</code></td><td></td><td>(changed packages)</td><td>Generate change files for these packages (can be specified multiple times)</td></tr><tr><td><code>--type</code></td><td></td><td>(prompt)</td><td>Type for all the change files (must be valid for each package)</td></tr></tbody></table><h3 id="examples" tabindex="-1"><a class="header-anchor" href="#examples"><span>Examples</span></a></h3><p>Basic interactive prompt (see <a href="#prompt-walkthrough">walkthrough</a> for details):</p><div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text" data-title="text"><pre><code><span class="line">beachball change</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><p>Skip the interactive prompt by specifying a message and type for all changed packages:</p><div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text" data-title="text"><pre><code><span class="line">beachball change --type patch --message &#39;some message&#39;</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><p>Generate change file for specific package(s), regardless of changes, and even if a change file already exists for the package in this branch. Each package must be specified with a separate <code>--package</code> option. (You can also use the <code>--message</code> and <code>--type</code> options here.)</p><div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text" data-title="text"><pre><code><span class="line">beachball change --package foo --package bar</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><p>Generate change files for all packages, regardless of changes. This would most often be used for build config updates which only touch a shared config file, but actually impact the output of all packages.</p><div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text" data-title="text"><pre><code><span class="line">beachball change --all --type patch --message &#39;update build output settings&#39;</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><h3 id="prompt-walkthrough" tabindex="-1"><a class="header-anchor" href="#prompt-walkthrough"><span>Prompt walkthrough</span></a></h3><p>If you have changes that are not committed yet (i.e. <code>git status</code> reports changes), then <code>beachball change</code> will warn you about these:</p><div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text" data-title="text"><pre><code><span class="line">$ beachball change</span>
<span class="line">Defaults to &quot;origin/master&quot;</span>
<span class="line">There are uncommitted changes in your repository. Please commit these files first:</span>
<span class="line">- a-new-file</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Make sure to commit <em>all</em> changes before proceeding with the <code>change</code> command.</p><p>After committing, run <code>beachball change</code>:</p><div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text" data-title="text"><pre><code><span class="line">$ beachball change</span>
<span class="line"></span>
<span class="line">Validating options and change files...</span>
<span class="line">Checking for changes against &quot;origin/main&quot;</span>
<span class="line">Found changes in the following packages:</span>
<span class="line">  some-pkg</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>For each package, the prompt will start by asking for a change <strong>type</strong>. This should be chosen based on <a href="https://semver.org/" target="_blank" rel="noopener noreferrer">semantic versioning rules</a> because it determines how to update the package version. If the change doesn&#39;t affect the published package at all (e.g. you just updated some comments), choose <code>none</code>.</p><div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text" data-title="text"><pre><code><span class="line">Please describe the changes for: some-pkg</span>
<span class="line">? Change type › - Use arrow-keys. Return to submit.</span>
<span class="line">❯ Patch - bug fixes; no backwards incompatible changes.</span>
<span class="line">  Minor - small feature; backwards compatible changes.</span>
<span class="line">  None - this change does not affect the published package in any way.</span>
<span class="line">  Major - major feature; breaking changes.</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Next, it asks for a <strong>description</strong> of the change. You can type any text or choose from a list of recent commit messages.</p><blockquote><p>Tip: These descriptions will be collated into a changelog when the change is published by <code>beachball publish</code>, so think about how to describe your change in a way that&#39;s helpful and relevant for consumers of the package.</p></blockquote><div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text" data-title="text"><pre><code><span class="line">Please describe the changes for: some-pkg</span>
<span class="line">? Describe changes (type or choose one) ›</span>
<span class="line">adding a new file</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div>`,27)]))}const r=a(i,[["render",l],["__file","change.html.vue"]]),o=JSON.parse('{"path":"/cli/change.html","title":"change","lang":"en-US","frontmatter":{"tags":["cli"],"category":"doc"},"headers":[{"level":3,"title":"Options","slug":"options","link":"#options","children":[]},{"level":3,"title":"Examples","slug":"examples","link":"#examples","children":[]},{"level":3,"title":"Prompt walkthrough","slug":"prompt-walkthrough","link":"#prompt-walkthrough","children":[]}],"git":{"updatedTime":1732587575000,"contributors":[{"name":"Elizabeth Craig","email":"elcraig@microsoft.com","commits":1,"url":"https://github.com/Elizabeth Craig"}]},"filePathRelative":"cli/change.md"}');export{r as comp,o as data};

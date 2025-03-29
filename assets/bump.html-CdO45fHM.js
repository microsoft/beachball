import{_ as t,c as a,a as o,o as s}from"./app-D1C2ssbJ.js";const i={};function r(n,e){return s(),a("div",null,e[0]||(e[0]=[o(`<h1 id="bump" tabindex="-1"><a class="header-anchor" href="#bump"><span><code>bump</code></span></a></h1><p>Bumps versions locally without publishing to the remote git repo or npm registry. This command will also generate changelogs.</p><p>This is the same logic that is used by the <code>publish</code> command, so it&#39;s a good practice to bump things locally to see what kind of changes will be made before those changes are published to the npm registry and the remote git repo.</p><p>Since this affects files locally only, it&#39;s up to you to synchronize the package versions in the remote git repo as well as the npm registry after running this command. (Or if you were using it for testing, simply revert the local changes and run <code>beachball publish</code>.)</p><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh"><pre><code><span class="line">$ beachball bump</span>
<span class="line"></span></code></pre><div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0;"><div class="line-number"></div></div></div><h3 id="options" tabindex="-1"><a class="header-anchor" href="#options"><span>Options</span></a></h3><p><a href="./options">General options</a> also apply for this command.</p><table><thead><tr><th>Option</th><th>Description</th></tr></thead><tbody><tr><td><code>--keep-change-files</code></td><td>don&#39;t delete the change files from disk after bumping</td></tr><tr><td><code>--prerelease-prefix</code></td><td>prerelease prefix (e.g. <code>beta</code>) for packages that will receive a prerelease bump</td></tr></tbody></table>`,8)]))}const c=t(i,[["render",r]]),p=JSON.parse('{"path":"/cli/bump.html","title":"bump","lang":"en-US","frontmatter":{"tags":["cli"],"category":"doc"},"headers":[{"level":3,"title":"Options","slug":"options","link":"#options","children":[]}],"git":{"updatedTime":1743204103000,"contributors":[{"name":"renovate[bot]","username":"renovate[bot]","email":"29139614+renovate[bot]@users.noreply.github.com","commits":2,"url":"https://github.com/renovate[bot]"},{"name":"Elizabeth Craig","username":"","email":"elcraig@microsoft.com","commits":1}],"changelog":[{"hash":"3f62cbaced714abeddd841fbef3e7b4deeeeb51a","time":1743204103000,"email":"29139614+renovate[bot]@users.noreply.github.com","author":"renovate[bot]","message":"Update Yarn to v4.8.0 (#1039)","coAuthors":[{"name":"renovate[bot]","email":"29139614+renovate[bot]@users.noreply.github.com"},{"name":"Elizabeth Craig","email":"elcraig@microsoft.com"}]}]},"filePathRelative":"cli/bump.md"}');export{c as comp,p as data};

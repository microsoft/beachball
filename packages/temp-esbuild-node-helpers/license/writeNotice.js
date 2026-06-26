import fs from 'fs';
import path from 'path';
export const noticeFilename = 'NOTICE.txt';
/**
 * Write NOTICE.txt with license and author info for the given dependencies.
 */
export function writeNotice(dependencies, absOutDir, excludeFromNotice) {
    if (!dependencies.length)
        return;
    const filteredDependencies = excludeFromNotice ? dependencies.filter((dep) => !excludeFromNotice(dep)) : dependencies;
    if (!filteredDependencies.length)
        return;
    const noticeText = [
        `NOTICES\n\nThis package incorporates material as listed below or described in the code.`,
        ...filteredDependencies
            .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
            .map((dep) => {
            const shortLicense = dep.license ? (/^see license/i.test(dep.license) ? '' : dep.license) : 'unknown license';
            return [
                `${dep.name} ${dep.version}${shortLicense ? ` - ${shortLicense}` : ''}${dep.url ? `\n${dep.url}` : ''}`,
                // Unclear which author/maintainer/contributor info is required, so include all of them
                dep.author && `Author: ${dep.author}`,
                dep.maintainers && `Maintainers:\n${dep.maintainers}`,
                dep.contributors && `Contributors:\n${dep.contributors}`,
                // The license text typically includes the official copyright notice
                dep.licenseText,
                // As of writing we don't use any packages that publish NOTICES
                dep.noticeText && `NOTICES:\n\n${dep.noticeText}`,
            ]
                .filter(Boolean)
                .join('\n\n');
        }),
    ].join('\n\n----\n\n');
    const outFile = path.join(absOutDir, noticeFilename);
    fs.mkdirSync(absOutDir, { recursive: true });
    fs.writeFileSync(outFile, noticeText, 'utf8');
    console.log(`Wrote license notices to ${outFile}\n`);
}
//# sourceMappingURL=writeNotice.js.map
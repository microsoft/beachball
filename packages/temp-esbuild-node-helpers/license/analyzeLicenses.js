import fs from 'fs';
import hostedGitInfo from 'hosted-git-info';
import path from 'path';
import validateLicense from 'validate-npm-package-license';
import { BundleError } from "../utils/BundleError.js";
import { bulletedList, colors, logError } from "../utils/logHelpers.js";
/**
 * Analyze licenses for all included packages.
 * @param includedPackages Mapping from package root to package.json for all packages in the bundle
 */
export function analyzeLicenses(includedPackages, options) {
    let dependencies;
    let errorDependencies;
    try {
        ({ dependencies, errorDependencies } = readAndValidateLicenses(includedPackages, options));
    }
    catch (err) {
        // this would be due to some issue reading a file (the function isn't intended to throw)
        // but we need to catch it for clear error reporting in the esbuild onEnd context
        logError(`Unexpected error during license analysis: ${err.stack || err}`);
        throw new BundleError('Unexpected error during license analysis', { alreadyLogged: true, cause: err });
    }
    if (errorDependencies.length) {
        // Return the formatted string from the function to verify the output formatting
        // (it's hard to test this via the esbuild plugin)
        const errors = errorDependencies.map((dep) => [`${dep.name}@${dep.version} (${dep.path})`, dep.issues]).flat(1);
        return {
            error: colors.red(`${colors.bold('ERROR:')} Found dependencies with license issues:\n${bulletedList(errors)}`),
        };
    }
    return { dependencies };
}
/**
 * Check the license specified in package.json, and if it's valid, read the license and notice text.
 */
function readAndValidateLicenses(includedPackages, options) {
    const dependencies = [];
    const errorDependencies = [];
    const sortedEntries = Object.entries(includedPackages).sort((a, b) => a[1].name.localeCompare(b[1].name) || a[1].version.localeCompare(b[1].version));
    for (const [depPkgRoot, depPkgJson] of sortedEntries) {
        const pkgMeta = {
            name: depPkgJson.name,
            version: depPkgJson.version,
            path: path.relative(options.packageRoot, depPkgRoot).replace(/\\/g, '/'),
        };
        const license = depPkgJson.license;
        if (!license || typeof license !== 'string') {
            errorDependencies.push({
                ...pkgMeta,
                issues: [license ? `Unexpected "license" format ${JSON.stringify(license)}` : 'Missing "license"'],
            });
            continue;
        }
        const licenseResult = validateLicense(license);
        if (!licenseResult.validForNewPackages) {
            errorDependencies.push({
                ...pkgMeta,
                issues: [`Invalid "license" value ${JSON.stringify(license)}`, ...(licenseResult.warnings || [])],
            });
            continue;
        }
        const licenseInFilePath = licenseResult.inFile && path.join(depPkgRoot, licenseResult.inFile);
        if (licenseInFilePath && !fs.existsSync(licenseInFilePath)) {
            errorDependencies.push({
                ...pkgMeta,
                issues: [`License file "${licenseResult.inFile}" (specified by "SEE LICENSE IN") not found`],
            });
            continue;
        }
        if (options.unacceptableLicenseTest?.(license)) {
            errorDependencies.push({
                ...pkgMeta,
                issues: [
                    `License ${JSON.stringify(license)} is not allowed (if incorrect, update the unacceptableLicenseTest setting)`,
                ],
            });
            continue;
        }
        const files = fs.readdirSync(depPkgRoot);
        // Read the license from either "SEE LICENSE IN ___" or a file named LICENSE*
        let licenseText;
        if (licenseInFilePath) {
            licenseText = fs.readFileSync(licenseInFilePath, 'utf8');
        }
        else {
            licenseText = findFile(/^license/i, files, depPkgRoot) || findFile(/^copying/i, files, depPkgRoot);
        }
        // Just look for a "notice" file at the root for notices
        const noticeText = findFile(/^notice/i, files, depPkgRoot);
        // Get author from package.json and/or "authors" file
        let author = personToString(depPkgJson.author);
        const authorsText = findFile(/^authors/i, files, depPkgRoot);
        if (authorsText) {
            author = (author ? author + '\n' : '') + authorsText;
        }
        // Same with contributors
        let contributors = depPkgJson.contributors?.map(personToString).filter(Boolean).join('\n');
        const contributorsText = findFile(/^contributors?/i, files, depPkgRoot);
        if (contributorsText) {
            contributors = (contributors ? contributors + '\n' : '') + contributorsText;
        }
        const maintainers = depPkgJson.maintainers?.map(personToString).join('\n');
        // Following CG, use "homepage" by default, followed by "repository"
        let url = depPkgJson.homepage;
        const repository = depPkgJson.repository;
        if (!url && repository) {
            url = typeof repository === 'string' ? repository : repository.url;
            const gitInfo = hostedGitInfo.fromUrl(url);
            if (gitInfo) {
                url = gitInfo.browse();
            }
        }
        dependencies.push({
            name: pkgMeta.name,
            version: pkgMeta.version,
            author,
            contributors,
            maintainers,
            url,
            license,
            licenseText,
            noticeText,
        });
    }
    return { dependencies, errorDependencies };
}
/**
 * Convert a person field to a string
 */
function personToString(person) {
    if (!person || typeof person === 'string') {
        return person;
    }
    const { name, email, url } = person;
    return `${name}${email ? ` <${email}>` : ''}${url ? ` (${url})` : ''}`;
}
/**
 * Find and read a file in a directory that matches a specific pattern.
 * @param isMatch - The function or regexp to match the file name.
 * @param files - The list of files to search.
 * @param dir - The parent directory path.
 * @returns The file contents if found (whitespace trimmed), otherwise undefined.
 */
function findFile(isMatch, files, dir) {
    const match = files.find(typeof isMatch === 'function' ? isMatch : (file) => isMatch.test(file));
    return match && fs.readFileSync(path.join(dir, match), 'utf8').trim();
}
//# sourceMappingURL=analyzeLicenses.js.map
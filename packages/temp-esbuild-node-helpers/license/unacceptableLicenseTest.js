/**
 * A default license plugin check for unacceptable licenses.
 * It requires a license to be defined and only allows a predefined expected list
 * (which could be expanded if new acceptable licenses are encountered).
 * @returns true if the license is **un**acceptable
 */
export function unacceptableLicenseTest(license) {
    // Conservatively list only the licenses we expect today.
    // Additional licenses could be added if encountered and acceptable.
    return !license || !['0BSD', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MIT'].includes(license);
}
//# sourceMappingURL=unacceptableLicenseTest.js.map
import { BeachballOptions } from '../types/BeachballOptions';
import { getAllPackages } from './getAllPackages';
import minimatch from 'minimatch';

export function getScopedPackages(options: BeachballOptions) {
  const allPackages = getAllPackages(options.path);
  if (!options.scope) {
    return allPackages;
  }

  return allPackages.filter(pkg => {
    return options.scope?.some(scope => minimatch(pkg, scope));
  });
}

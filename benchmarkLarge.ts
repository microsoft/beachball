// Description: Benchmarking the performance of micromatch vs minimatch
import minimatch from 'minimatch';
import micromatch from 'micromatch';

const Benchmark = require('benchmark');

(() => {
  var suite = new Benchmark.Suite();

  const ignorePatterns = ['*.test.js', 'tests/**', 'yarn.lock', 'change/*.json', 'CHANGELOG.{md,json}'];

  const filesToCheck = [
    'src/foo.test.js',
    'tests/stuff.js',
    'yarn.lock',
    'playwright',
    'browser',
    'edge',
    'foo',
    'bar',
    'baz',
    'qux',
    'src/f',
  ];

  const numberOfRandomFiles = 10000;

  // Generate additional random files
  for (let i = 0; i < numberOfRandomFiles; i++) {
    const randomIndex = Math.floor(Math.random() * filesToCheck.length);
    const randomFileName = filesToCheck[randomIndex];
    const randomVariant = Math.floor(Math.random() * 1000); // Generate a random number for variation

    filesToCheck.push(`${randomFileName}_${randomVariant}`);
  }

  suite
    .add('micromatch', function () {
      for (const file of filesToCheck) {
        ignorePatterns.find(pattern => micromatch.isMatch(file, pattern, { matchBase: true }));
      }
    })
    .add('minimatch', function () {
      for (const file of filesToCheck) {
        ignorePatterns.find(pattern => minimatch(file, pattern, { matchBase: true }));
      }
    })
    .on('complete', function (this: any) {
      console.log('Fastest is ' + this.filter('fastest').map('name'));
      const tableData = this.map(benchmark => ({
        Function: benchmark.name,
        'Mean Time (ms)': (benchmark.stats.mean * 1000).toFixed(2), // Convert to milliseconds
        'Operations per Second': benchmark.hz.toFixed(2),
        'Standard Error of the Mean': benchmark.stats.sem.toFixed(2),
        'Relative Margin of Error': benchmark.stats.rme.toFixed(2),
      }));

      // Create a console table
      console.table(tableData);
    })
    .run();
})();

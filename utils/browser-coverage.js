export const browserCoverage = {
  name: 'Little Goods browser coverage',
  outputDir: 'coverage/browser',
  entryFilter: entry => entry.url.includes('/assets/') && entry.url.endsWith('.js'),
  sourceFilter: source => /(?:^|\/)src\/main\.jsx$/.test(source),
  sourcePath: source => source.endsWith('src/main.jsx') ? 'src/main.jsx' : source,
  reports: ['v8', 'lcovonly', ['html', { subdir: 'html' }], 'json', 'json-summary'],
  cleanCache: false
};

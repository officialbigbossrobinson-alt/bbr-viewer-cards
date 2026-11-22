// Run before every build: the version in server.js (APP_VERSION), package.json and the git tag must agree,
// and no logins or data may be in the folder that gets packaged.
const fs = require('fs');
const path = require('path');
const R = require('./lib/releases');
const root = path.join(__dirname, '..');
const app = (/const APP_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(root, 'server.js'), 'utf8')) || [])[1];
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const bad = [];
if (!app) bad.push('No APP_VERSION in server.js');
else if (R.cmp(app, pkg.split('-')[0]) !== 0) bad.push('server.js says ' + app + ' but package.json says ' + pkg + ' (set package.json "version" to "' + R.toSemver(app) + '")');
const tag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : null;
if (tag && tag.replace(/^v/, '') !== pkg) bad.push('The tag is ' + tag + ' but package.json says ' + pkg + ' (tag it v' + pkg + ')');
for (const f of ['config.json', 'data']) if (fs.existsSync(path.join(root, f))) bad.push(f + ' is in the folder: logins and data must never be packaged. Move it out first.');
if (bad.length) { console.error('NOT BUILT:\n - ' + bad.join('\n - ')); process.exit(1); }
console.log('Version ' + pkg + ' (APP_VERSION ' + app + ')' + (tag ? ', tag ' + tag : '') + ': OK');

const fs = require('fs');
const source = fs.readFileSync('src/routes/index.js', 'utf8');
const re = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
let match;
while ((match = re.exec(source))) {
  console.log(`${match[1].toUpperCase()} ${match[2]}`);
}

const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'css', 'style.css');
const css = fs.readFileSync(cssPath, 'utf8');

const importantCount = (css.match(/!important/g) || []).length;
const mediaQueries = (css.match(/@media[^{]+\{/g) || []).length;
const totalLines = css.split('\n').length;
const totalSizeKB = Math.round(Buffer.byteLength(css, 'utf8') / 1024);

// Check for color inconsistencies
const hexColors = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
const uniqueColors = new Set(hexColors.map(c => c.toLowerCase()));

// Count font families
const fontFamilies = css.match(/font-family:[^;]+/g) || [];

console.log('CSS AUDIT:');
console.log('Total Size:', totalSizeKB, 'KB');
console.log('Total Lines:', totalLines);
console.log('!important count:', importantCount);
console.log('@media queries count:', mediaQueries);
console.log('Unique hex colors used:', uniqueColors.size);
console.log('Font family declarations:', fontFamilies.length);

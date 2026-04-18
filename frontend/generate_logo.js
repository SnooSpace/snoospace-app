const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, 'assets', 'SnooSpace_Master_Logo_Dark.svg');
const outPath = path.join(__dirname, 'components', 'SnooSpaceLogoDark.js');

const svgContent = fs.readFileSync(svgPath, 'utf8');

const jsContent = `import React from 'react';
import { SvgXml } from 'react-native-svg';

export const SnooSpaceLogoDarkXml = \`${svgContent}\`;

export default function SnooSpaceLogoDark(props) {
  return <SvgXml xml={SnooSpaceLogoDarkXml} {...props} />;
}
`;

fs.writeFileSync(outPath, jsContent);
console.log('Successfully generated SnooSpaceLogoDark.js');

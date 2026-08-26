import { parseTJAForPreview } from './src/parser/tja-parser.js';
import fs from 'fs';
const tja = fs.readFileSync('tests/fixtures/basic.tja', 'utf-8');
const result = parseTJAForPreview(tja);
console.log("Global:", result.globalConfig.BALLOON);
console.log("Course:", result.courses[3].ballonList);

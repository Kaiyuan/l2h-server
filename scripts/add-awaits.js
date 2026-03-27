const fs = require('fs');
const path = require('path');

const filesToProcess = [
    'src/index.ts',
    'src/routes/api.ts',
    'src/routes/admin.ts'
];

filesToProcess.forEach(file => {
    let content = fs.readFileSync(file, 'utf-8');
    
    // add await before db.prepare if not already there
    // Regex matches db.prepare or (db.prepare
    content = content.replace(/(?<!await\s*)(\(?db\.prepare\(.*?\)\.(get|all|run)\(.*?\))/g, 'await $1');
    content = content.replace(/(?<!await\s*)(db\.prepare\(.*?\)\.(get|all|run)\(\))/g, 'await $1');

    fs.writeFileSync(file, content);
    console.log(`Processed ${file}`);
});

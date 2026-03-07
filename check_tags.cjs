
const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\user\\Desktop\\Portfolio\\salon\\authservice1\\saloon-admin-fe\\pages\\ExpenseList.tsx', 'utf8');

const lines = content.split('\n');
let stack = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Simplistic but better regex
    // Matches <div but NOT <div.../>
    // Matches </div>

    // Let's just find all <div and </div> and self-closing <div.../>

    let re = /<(div|Card|motion\.div|Button|Input|Table|Select|ResponsiveContainer|PieChart|Pie|Cell|RechartsTooltip|Legend|ExpenseModal|AttachmentsInput|Modal|form|textarea)(\s|>)|<\/(div|Card|motion\.div|Button|Input|Table|Select|ResponsiveContainer|PieChart|Pie|Cell|RechartsTooltip|Legend|ExpenseModal|AttachmentsInput|Modal|form|textarea)>|<(div|Card|motion\.div|Button|Input|Table|Select|ResponsiveContainer|PieChart|Pie|Cell|RechartsTooltip|Legend|ExpenseModal|AttachmentsInput|Modal|form|textarea)(\s[^>]*)\/>/g;

    let match;
    while ((match = re.exec(line)) !== null) {
        let tag = match[0];
        if (tag.startsWith('</')) {
            if (stack.length > 0) {
                let last = stack.pop();
                // console.log(`Closed tag ${last.tag} from line ${last.line} at line ${i+1}`);
            } else {
                console.log(`Extra closing tag ${tag} at line ${i + 1}`);
            }
        } else if (tag.endsWith('/>')) {
            // Self-closing, ignore
        } else {
            let tagName = match[1];
            stack.push({ tag: tagName, line: i + 1 });
        }
    }
}

if (stack.length > 0) {
    stack.forEach(s => console.log(`Unclosed ${s.tag} opened at line ${s.line}`));
} else {
    console.log('All tags balanced!');
}

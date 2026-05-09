const fs = require('fs');
const path = require('path');
function s(dir) {
  try {
    for (const f of fs.readdirSync(dir, {withFileTypes: true})) {
      if (f.isDirectory()) {
         if (f.name !== '.bin') s(path.join(dir, f.name));
      } else if (f.isFile() && f.name.endsWith('.js')) {
        const c = fs.readFileSync(path.join(dir, f.name), 'utf8');
        if (c.includes('window.fetch')) {
          const match = c.match(/.{0,30}window\.fetch.{0,30}/g);
          if (match) {
            match.forEach(m => {
               if(m.includes('=') && !m.includes('==')) {
                 console.log(path.join(dir, f.name), ":", m);
               }
            });
          }
        }
      }
    }
  } catch (e) {}
}
s('node_modules');

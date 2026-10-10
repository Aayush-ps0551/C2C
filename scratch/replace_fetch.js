const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'c:/Users/aayus/Desktop/C2C/frontend/src/lib/fsm/useSessionStore.ts',
  'c:/Users/aayus/Desktop/C2C/frontend/src/components/report/ReportView.tsx',
  'c:/Users/aayus/Desktop/C2C/frontend/src/components/lobby/GDSettingsModal.tsx',
  'c:/Users/aayus/Desktop/C2C/frontend/src/components/history/HistoryView.tsx'
];

for (const file of filesToUpdate) {
  let content = fs.readFileSync(file, 'utf8');
  
  if (!content.includes('getApiUrl')) {
    // Add import based on directory depth
    // useSessionStore is in lib/fsm/ (2 dirs deep from src) => @/lib/api
    // We can just use the alias @/lib/api for all since vite.config.ts has it!
    const importStatement = "import { getApiUrl } from '@/lib/api';\n";
    content = importStatement + content;
  }
  
  // Replace fetch('/api/... with fetch(getApiUrl('/api/...
  // Using a regex to catch fetch('/api/ and fetch(`/api/
  content = content.replace(/fetch\(['"](\/api\/[^'"]+)['"]/g, 'fetch(getApiUrl(\'$1\')');
  content = content.replace(/fetch\(`(\/api\/[^`]+)`/g, 'fetch(getApiUrl(`$1`)');
  
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Updated ${file}`);
}

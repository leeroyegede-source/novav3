export async function GET(req: Request) {
  const host = req.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  const cliScript = `#!/usr/bin/env node

/**
 * NovaAI Local Sync CLI
 * This script runs locally and syncs your IDE with the NovaAI browser environment.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const projectId = process.argv[2];
if (!projectId) {
  console.log("\\n\\x1b[31m[ERROR]\\x1b[0m Usage: node nova-sync.js <projectId>");
  console.log("Find your Project ID in the NovaAI Settings panel.\\n");
  process.exit(1);
}

const baseUrl = "${baseUrl}";
const client = baseUrl.startsWith('https') ? https : http;

console.log(\`\\x1b[36m[NovaSync]\\x1b[0m Establishing real-time bridge to \${baseUrl}...\`);
console.log(\`\\x1b[36m[NovaSync]\\x1b[0m Syncing Project ID: \${projectId}\`);
console.log(\`\\x1b[36m[NovaSync]\\x1b[0m Waiting for changes... (Press Ctrl+C to stop)\\n\`);

let lastTimestamp = 0;

setInterval(() => {
  client.get(\`\${baseUrl}/api/sync/bridge?projectId=\${projectId}\`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.files && json.timestamp !== lastTimestamp) {
          lastTimestamp = json.timestamp;
          console.log(\`\\x1b[35m[NovaSync]\\x1b[0m Changes detected from AI. Syncing to local disk...\`);
          
          for (const [filePath, content] of Object.entries(json.files)) {
            const safePath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
            const fullPath = path.join(process.cwd(), safePath);
            const dir = path.dirname(fullPath);
            
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            
            // Avoid unnecessary writes
            if (!fs.existsSync(fullPath) || fs.readFileSync(fullPath, 'utf8') !== content) {
              fs.writeFileSync(fullPath, content);
              console.log(\`  \\x1b[32m+\\x1b[0m \${safePath}\`);
            }
          }
        }
      } catch (err) {}
    });
  }).on('error', (err) => {
    // console.log(\`\\x1b[31m[NovaSync]\\x1b[0m Connection error: \${err.message}\`);
  });
}, 2000);
`;

  return new Response(cliScript, {
    headers: {
      'Content-Type': 'application/javascript',
      'Content-Disposition': 'attachment; filename="nova-sync.js"'
    }
  });
}

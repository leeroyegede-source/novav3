const fetch = require('node-fetch');

async function test() {
  const res = await fetch('http://localhost:3000/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: "Build me a complete SaaS dashboard with auth, database, payments, admin panel, and analytics."
    })
  });
  const data = await res.json();
  console.log(JSON.stringify(data.structuredResponse, null, 2));
}

test();



const prompt = "APP MODE TEST SUCCESS — If you can see this exact message in the preview box, the mode is working correctly.";

const appModes = [
  "Laravel",
  "Static Website",
  "API Only"
];

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTest() {
  for (const mode of appModes) {
    console.log(`\n\n--- Testing App Mode: ${mode} ---`);
    let pass = false;
    
    // Simulate ChatPanel generating files
    console.log("STEP A: Calling AI Generate...");
    let files = {};
    try {
      const generateRes = await fetch('http://localhost:3000/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          currentFiles: {},
          appMode: mode
        })
      });
      const generateData = await generateRes.json();
      if (!generateData.success) {
        console.error("AI Generate Failed:", generateData);
        continue;
      }
      files = generateData.files;
      console.log(`Generated ${Object.keys(files).length} files.`);
    } catch (e) {
      console.error("AI Generate Error:", e);
      continue;
    }

    // Start Preview
    console.log("STEP B: Starting Container...");
    let projectId = `test-mode-${mode.replace(/[^a-zA-Z0-9]/g, '-')}`;
    let previewUrl = "";
    try {
      const startRes = await fetch('http://localhost:3000/api/preview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          files,
          appMode: mode
        })
      });
      const startData = await startRes.json();
      if (startData.error) {
        console.error("Container Start Failed:", startData.error);
        continue;
      }
      previewUrl = startData.previewUrl;
      console.log(`Container started at ${previewUrl}. Waiting for boot...`);
    } catch (e) {
      console.error("Container Start Error:", e);
      continue;
    }

    // Wait for boot
    await delay(10000); 

    // Validate Output
    console.log("Validating Output...");
    let fileContainsText = Object.values(files).some(content => content.includes("APP MODE TEST SUCCESS"));
    if (!fileContainsText) {
        console.log(`❌ FAILED: Message not found in generated files for ${mode}.`);
    }

    for (let i = 0; i < 5; i++) {
      try {
        const checkRes = await fetch(previewUrl);
        if (checkRes.ok && fileContainsText) {
          console.log(`✅ SUCCESS: Message generated and server responded ok for ${mode}`);
          pass = true;
          break;
        } else if (checkRes.ok) {
           console.log(`Server responded but text missing in files...`);
        } else {
          console.log(`Attempt ${i+1}: Server returned ${checkRes.status}. Retrying...`);
        }
      } catch (e) {
        console.log(`Attempt ${i+1}: Could not connect to preview URL. Retrying...`);
      }
      await delay(5000);
    }

    if (!pass) {
      console.log(`❌ FAILED: Message not found for ${mode}.`);
      console.log("Checking logs...");
      const logsRes = await fetch(`http://localhost:3000/api/preview/logs?projectId=${projectId}`);
      const logsData = await logsRes.json();
      console.log("Container Logs:", logsData.logs?.slice(-10).join("\n"));
    }

    // Stop Container
    console.log("Stopping container...");
    await fetch('http://localhost:3000/api/preview/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId })
    });
    
    // Stop the test if it failed according to the instructions
    if (!pass) {
        console.log("STOPPING PROTOCOL AS MODE FAILED.");
        break;
    }
  }
}

runTest();

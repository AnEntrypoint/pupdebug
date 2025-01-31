#!/usr/bin/env node
process.stdout = process.stderr;
console.log = console.error;
const puppeteer = require('puppeteer');

const href = process.argv[2] || 'http://localhost:3000'; // Use argument as href or default to localhost

puppeteer.launch({
  headless: false,
  defaultViewport: null,
  ignoreHTTPSErrors: true
}).then(async browser => {
  const pages = await browser.pages();
  const page = pages[0]; // Use existing first tab instead of creating new one
  
  // Forward console messages from browser to node
  page.on('console', message => {
    const type = message.type();
    const text = message.text();
    const location = message.location(); // Get location of the message
    const timestamp = new Date().toISOString(); // Get current timestamp
    
    // Log all console messages to stdout for full client logs
    console.log(`[${timestamp}] [${type.toUpperCase()}] [${location.url}:${location.lineNumber}:${location.columnNumber}] ${text}`);
    
    // Check for error messages and log detailed error information
    if (type === 'error') {
      console.error(`[${timestamp}] [ERROR] [${location.url}:${location.lineNumber}:${location.columnNumber}] Error loading keypoints data: ${text}`);
    }
  });

  try {
    const startTime = Date.now(); // Start time for navigation
    await page.goto(href, { waitUntil: 'networkidle0' }); // Use the href variable
    await page.waitForSelector('body'); // Wait for basic content
    const loadTime = Date.now() - startTime; // Calculate load time
    console.error(`[${new Date().toISOString()}] [INFO] Page loaded successfully in ${loadTime}ms`);

    // Log the React DevTools download link with bold formatting
    console.error(`[${new Date().toISOString()}] [INFO] %cDownload the React DevTools for a better development experience: https://reactjs.org/link/react-devtools font-weight:bold`);

    // Remove the auto close functionality
    console.error(`[${new Date().toISOString()}] [INFO] Browser will remain open for debugging. Press Ctrl+C to close.`);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] [ERROR] Navigation failed:`, error);
    await browser.close();
    process.exit(1);
  }
 
}).catch(error => {
  console.error(`[${new Date().toISOString()}] [ERROR] Error:`, error);
  process.exit(1);
});

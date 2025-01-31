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
    
    // Log all console messages to stderr
    console.error(text);
  });

  try {
    await page.goto(href, { waitUntil: 'networkidle0' }); // Use the href variable
    await page.waitForSelector('body'); // Wait for basic content
    console.error('Page loaded successfully');

    // Log the React DevTools download link
    console.error('Download the React DevTools for a better development experience: https://reactjs.org/link/react-devtools');

    // Remove the auto close functionality
    console.error('Browser will remain open for debugging. Press Ctrl+C to close.');

  } catch (error) {
    console.error('Navigation failed:', error);
    await browser.close();
    process.exit(1);
  }
 
}).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

#!/usr/bin/env node
const puppeteer = require('puppeteer');

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
    
    switch(type) {
      case 'log':
        console.log(text);
        break;
      case 'warn':
        console.warn(text);
        break;
      case 'error':
        console.error(text);
        break;
      default:
        console.log(`${type}: ${text}`);
    }
  });

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('body', { timeout: 5000 }); // Wait for basic content
    console.log('Page loaded successfully');

    // Keep browser open
    await new Promise(() => {});
  } catch (error) {
    console.error('Navigation failed:', error);
    await browser.close();
    process.exit(1);
  }

}).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

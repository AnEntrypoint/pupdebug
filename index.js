const puppeteer = require('puppeteer');

puppeteer.launch({
  headless: false,
  defaultViewport: null
}).then(async browser => {
  const page = await browser.newPage();
  
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

  await page.goto('http://localhost:3000');
  
  // Keep browser open
  await new Promise(() => {});

}).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

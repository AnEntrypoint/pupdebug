#!/usr/bin/env node
const puppeteer = require('puppeteer');

// Create custom writable stream to capture stderr
const { Writable } = require('stream');
const capturedOutput = {
    stderr: []
};

class CaptureStream extends Writable {
    constructor() {
        super();
    }
    
    _write(chunk, encoding, callback) {
        const output = chunk.toString();
        capturedOutput.stderr.push(output);
        // Avoid recursive debug logging
        if (!output.includes('Captured ')) {
            console.debug(`Captured stderr:`, output);
        }
        process.stderr.write(chunk, encoding, callback);
    }
}

// Override stderr
process.stderr = new CaptureStream();

const href = process.argv[2] || 'http://localhost:3000';

puppeteer.launch({
  headless: false,
  defaultViewport: null,
  ignoreHTTPSErrors: true
}).then(async browser => {
  const pages = await browser.pages();
  const page = pages[0];
  
  // Inject client-side logging capture
  await page.evaluateOnNewDocument(() => {
    // Capture console methods
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug
    };

    let isLogging = false; // Flag to prevent recursive logging

    const sendRawLog = (type, args) => {
      if (isLogging) return;
      isLogging = true;
      
      try {
        // Avoid recursive debug logging
        if (!args.some(arg => String(arg).includes('Preparing to send'))) {
          console.debug(`Preparing to send ${type} log with args:`, args);
        }
        
        window.postMessage({
          type: 'client-log',
          data: {
            type,
            args: args.map(arg => {
              try {
                if (arg instanceof Error) {
                  return `${arg.message}\n${arg.stack}`;
                }
                if (typeof arg === 'object' && arg !== null) {
                  return JSON.stringify(arg);
                }
                return String(arg);
              } catch (e) {
                return `[Error converting log argument: ${e.message}]`;
              }
            })
          }
        }, '*');
      } finally {
        isLogging = false;
      }
    };

    ['log', 'error', 'warn', 'info', 'debug'].forEach(method => {
      console[method] = (...args) => {
        if (isLogging) return;
        isLogging = true;
        
        try {
          // Avoid recursive debug logging
          if (!args.some(arg => String(arg).includes('Intercepted console'))) {
            console.debug(`Intercepted console.${method} with args:`, args);
          }
          sendRawLog(method, args);
          originalConsole[method].apply(console, args);
        } finally {
          isLogging = false;
        }
      };
    });

    window.addEventListener('error', (event) => {
      if (isLogging) return;
      isLogging = true;
      
      try {
        console.debug('Window error event captured:', event);
        sendRawLog('error', [event.error || event.message || event]);
      } finally {
        isLogging = false;
      }
    });

    window.addEventListener('unhandledrejection', (event) => {
      if (isLogging) return;
      isLogging = true;
      
      try {
        console.debug('Unhandled rejection captured:', event);
        sendRawLog('error', [event.reason]);
      } finally {
        isLogging = false;
      }
    });
  });

  // Listen for client messages
  page.on('console', async message => {
    const args = await Promise.all(message.args().map(async arg => {
      const jsonValue = await arg.jsonValue().catch(() => null);
      if (jsonValue !== null) {
        if (typeof jsonValue === 'object' && jsonValue !== null) {
          return JSON.stringify(jsonValue);
        }
        return String(jsonValue);
      }
      return arg.toString();
    }));
    
    // Avoid recursive debug logging
    if (!args.some(arg => String(arg).includes('Received console message'))) {
      console.debug('Received console message from client:', args);
    }
    console.error(...args);
  });

  page.on('pageerror', error => {
    console.debug('Page error captured:', error);
    console.error(`${error.message}\n${error.stack}`);
  });

  page.on('requestfailed', request => {
    console.debug('Request failed:', request);
    console.error(`Request Failed: ${request.url()} - ${request.failure()?.errorText}`);
  });
 
  try {
    const startTime = Date.now();
    await page.goto(href, { waitUntil: 'networkidle0' });
    await page.waitForSelector('body');
    const loadTime = Date.now() - startTime;
    console.error(`Page loaded successfully in ${loadTime}ms`);
    console.error(`Browser will remain open for debugging. Press Ctrl+C to close.`);

  } catch (error) {
    console.error(`Navigation failed: ${error.message}\n${error.stack}`);
    await browser.close();
    process.exit(1);
  }
 
}).catch(error => {
  console.error(`Error: ${error.message}\n${error.stack}`);
  process.exit(1);
});

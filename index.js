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
            process.stderr.write(`Captured stderr: ${output}\n`);
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
          // Removed process.stderr.write since it's not available in browser
          console.log(`Preparing to send ${type} log with args: ${JSON.stringify(args)}`);
        }
        
        window.postMessage({
          type: 'client-log',
          data: {
            type,
            args: args.map(arg => {
              try {
                if (arg instanceof Error) {
                  return `CLIENT ERROR: ${arg.message}\n${arg.stack}`;
                }
                if (typeof arg === 'object' && arg !== null) {
                  return JSON.stringify(arg);
                }
                return String(arg);
              } catch (e) {
                return `CLIENT ERROR: [Error converting log argument: ${e.message}]`;
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
            // Removed process.stderr.write since it's not available in browser
            console.log(`Intercepted console.${method} with args: ${JSON.stringify(args)}`);
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
        // Removed process.stderr.write since it's not available in browser
        console.log(`Window error event captured: ${JSON.stringify(event)}`);
        sendRawLog('error', [`CLIENT ERROR: ${event.error || event.message || event}`]);
      } finally {
        isLogging = false;
      }
    });

    window.addEventListener('unhandledrejection', (event) => {
      if (isLogging) return;
      isLogging = true;
      
      try {
        // Removed process.stderr.write since it's not available in browser
        console.log(`Unhandled rejection captured: ${JSON.stringify(event)}`);
        sendRawLog('error', [`CLIENT ERROR: ${event.reason}`]);
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
      process.stderr.write(`Received console message from client: ${JSON.stringify(args)}\n`);
    }
    const logPrefix = message.type() === 'error' ? 'CLIENT ERROR:' : 'CLIENT LOG:';
    process.stderr.write(`${logPrefix} ${args.join(' ')}\n`);
  });

  page.on('pageerror', error => {
    process.stderr.write(`Page error captured: ${JSON.stringify(error)}\n`);
    process.stderr.write(`CLIENT ERROR: ${error.message}\n${error.stack}\n`);
  });

  page.on('requestfailed', request => {
    process.stderr.write(`Request failed: ${JSON.stringify(request)}\n`);
    process.stderr.write(`CLIENT ERROR: Request Failed: ${request.url()} - ${request.failure()?.errorText}\n`);
  });
 
  try {
    const startTime = Date.now();
    await page.goto(href, { waitUntil: 'networkidle0' });
    await page.waitForSelector('body');
    const loadTime = Date.now() - startTime;
    process.stderr.write(`Page loaded successfully in ${loadTime}ms\n`);
    process.stderr.write(`Browser will remain open for debugging. Press Ctrl+C to close.\n`);

  } catch (error) {
    process.stderr.write(`Navigation failed: ${error.message}\n${error.stack}\n`);
    await browser.close();
    process.exit(1);
  }
 
}).catch(error => {
  process.stderr.write(`Error: ${error.message}\n${error.stack}\n`);
  process.exit(1);
});

#!/usr/bin/env node
const puppeteer = require('puppeteer');

// Create custom writable streams to capture stdout and stderr
const { Writable } = require('stream');
const capturedOutput = {
    stdout: [],
    stderr: []
};

class CaptureStream extends Writable {
    constructor(type) {
        super();
        this.type = type;
    }
    
    _write(chunk, encoding, callback) {
        const output = chunk.toString();
        capturedOutput[this.type].push(output);
        process[this.type].write(chunk, encoding, callback);
    }
}

// Override stdout and stderr
process.stdout = new CaptureStream('stdout');
process.stderr = new CaptureStream('stderr');

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
    // Capture original stdout and stderr
    const originalStdout = process.stdout.write.bind(process.stdout);
    const originalStderr = process.stderr.write.bind(process.stderr);

    // Override stdout and stderr
    process.stdout.write = (chunk, encoding, callback) => {
      window.postMessage({
        type: 'client-stdout',
        data: chunk.toString()
      }, '*');
      originalStdout(chunk, encoding, callback);
    };

    process.stderr.write = (chunk, encoding, callback) => {
      window.postMessage({
        type: 'client-stderr',
        data: chunk.toString()
      }, '*');
      originalStderr(chunk, encoding, callback);
    };

    // Capture console methods
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug
    };

    const sendRawLog = (type, args) => {
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
    };

    ['log', 'error', 'warn', 'info', 'debug'].forEach(method => {
      console[method] = (...args) => {
        sendRawLog(method, args);
        originalConsole[method].apply(console, args);
      };
    });

    window.addEventListener('error', (event) => {
      sendRawLog('error', [event.error || event.message || event]);
    });

    window.addEventListener('unhandledrejection', (event) => {
      sendRawLog('error', [event.reason]);
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
    
    console.log(...args);
  });

  // Listen for stdout/stderr messages
  page.on('message', async (message) => {
    if (message.type() === 'client-stdout') {
      process.stdout.write(message.text());
    } else if (message.type() === 'client-stderr') {
      process.stderr.write(message.text());
    }
  });

  page.on('pageerror', error => {
    console.error(`${error.message}\n${error.stack}`);
  });

  page.on('requestfailed', request => {
    console.error(`Request Failed: ${request.url()} - ${request.failure()?.errorText}`);
  });

  try {
    const startTime = Date.now();
    await page.goto(href, { waitUntil: 'networkidle0' });
    await page.waitForSelector('body');
    const loadTime = Date.now() - startTime;
    console.log(`Page loaded successfully in ${loadTime}ms`);
    console.log(`Browser will remain open for debugging. Press Ctrl+C to close.`);

  } catch (error) {
    console.error(`Navigation failed: ${error.message}\n${error.stack}`);
    await browser.close();
    process.exit(1);
  }
 
}).catch(error => {
  console.error(`Error: ${error.message}\n${error.stack}`);
  process.exit(1);
});

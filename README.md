# PupDebug

`pupdebug` is a lightweight command-line utility that leverages Puppeteer, a powerful browser automation library for Node.js, to open a web page in a non-headless Chrome browser and forward console logs for easier debugging. This tool is especially useful for developers needing to inspect client-side JavaScript logs, warnings, and errors directly in the terminal.

## Features
- Opens a specified URL (defaulting to `http://localhost:3000`).
- Forwards console messages from the webpage to the terminal.
- Remains open after loading, allowing for manual inspection and debugging.
- Ignores HTTPS errors.

## Installation

You can run `pupdebug` directly using `npx`. There's no need for additional installation steps. Just ensure you have Node.js installed.

```bash
npx pupdebug [URL]
```

## Usage

### Command-Line Arguments

- `URL` (optional): The webpage URL to open. If not provided, the tool defaults to `http://localhost:3000`.

### Example

To load a page on your local server:

```bash
npx pupdebug
```

To load a specific address:

```bash
npx pupdebug https://example.com
```

## Functionality

1. **Browser Launch**: The script launches a new instance of Chrome using Puppeteer in non-headless mode, allowing you to see what is happening visually.
2. **Console Message Forwarding**: It captures console messages (logs, warnings, errors) from the webpage and prints them in the terminal in real time. The messages are categorized based on their types for clarity.
3. **Error Handling**: If page navigation fails, an error message is shown and the browser will close.
4. **Debugging**: After the page is loaded, the browser remains open, giving you the opportunity to interact with the page and check the developer tools in Chrome.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contribution

Contributions to `pupdebug` are welcome! If you have suggestions for improvements or features, please feel free to open an issue or submit a pull request.

## Troubleshooting

- **Puppeteer Installation Problems**: Ensure that you have the necessary permissions and a stable internet connection, as Puppeteer will need to download a specific version of Chromium. You may also refer to the [Puppeteer documentation](https://pptr.dev/) for further assistance with installation issues.

## Note

PupDebug automatically redirects `console.log` to `console.error` to keep the terminal output clean and focused, showing all log output as errors. If this behavior does not align with your needs, you can modify the script to suit your preferences.

Enjoy debugging your web applications with `pupdebug`!

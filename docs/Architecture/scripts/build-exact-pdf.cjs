const fs = require('fs');
const path = require('path');

async function build() {
  const mdPath = path.join(__dirname, '..', 'aceolution_finance_architecture.md');
  const mdContent = fs.readFileSync(mdPath, 'utf8');

  // Escape content for embedding into JS string
  const jsonEncodedMd = JSON.stringify(mdContent);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Aceolution Finance — Architecture</title>
  <script src="https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.0/dist/mermaid.min.js"></script>
  <style>
    @page {
      size: A4;
      margin: 12mm 14mm 14mm 14mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    html, body {
      background-color: #1e1e1e !important;
      color: #cccccc !important;
      font-size: 12.5px;
      line-height: 1.6;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .vscode-markdown {
      max-width: 860px;
      margin: 0 auto;
      padding: 10px 14px;
      background-color: #1e1e1e;
    }

    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff !important;
      margin: 18px 0 12px 0;
      padding-bottom: 6px;
      border-bottom: 1px solid #3c3c3c;
    }

    h2 {
      font-size: 16px;
      font-weight: 700;
      color: #ffffff !important;
      margin: 24px 0 10px 0;
      padding-bottom: 5px;
      border-bottom: 1px solid #333333;
      page-break-after: avoid;
    }

    h3 {
      font-size: 13.5px;
      font-weight: 700;
      color: #ffffff !important;
      margin: 16px 0 8px 0;
      page-break-after: avoid;
    }

    h4 {
      font-size: 12.5px;
      font-weight: 700;
      color: #38bdf8 !important;
      margin: 12px 0 6px 0;
      page-break-after: avoid;
    }

    p {
      margin-bottom: 10px;
      color: #cccccc !important;
    }

    strong {
      color: #ffffff !important;
      font-weight: 600;
    }

    hr {
      border: 0;
      height: 1px;
      background: #333333;
      margin: 20px 0;
    }

    a {
      color: #4daafc !important;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0 18px 0;
      font-size: 11.5px;
      background-color: #1e1e1e;
      border: 1px solid #3c3c3c;
      page-break-inside: avoid;
    }

    th {
      background-color: #252526 !important;
      color: #ffffff !important;
      font-weight: 700;
      text-align: left;
      padding: 7px 10px;
      border: 1px solid #3c3c3c;
    }

    td {
      background-color: #1e1e1e !important;
      color: #cccccc !important;
      padding: 7px 10px;
      border: 1px solid #3c3c3c;
    }

    tr:nth-child(even) td {
      background-color: #252526 !important;
    }

    pre {
      background-color: #181818 !important;
      border: 1px solid #333333;
      border-radius: 6px;
      padding: 10px 14px;
      margin: 12px 0 16px 0;
      overflow-x: auto;
      font-family: Consolas, "Courier New", monospace;
      font-size: 11px;
      line-height: 1.45;
      color: #e2e8f0 !important;
      page-break-inside: avoid;
    }

    code {
      background-color: #2b2b2b;
      color: #f87171;
      padding: 2px 4px;
      border-radius: 3px;
      font-family: Consolas, "Courier New", monospace;
      font-size: 11px;
    }

    pre code {
      background-color: transparent !important;
      color: inherit !important;
      padding: 0;
    }

    ul, ol {
      margin: 8px 0 12px 20px;
      color: #cccccc;
    }

    li {
      margin-bottom: 4px;
    }

    /* Mermaid diagrams container */
    .mermaid {
      background-color: #18181b !important;
      border: 1px solid #333333;
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0 20px 0;
      display: flex;
      justify-content: center;
      page-break-inside: avoid;
    }

    .mermaid svg {
      max-width: 100% !important;
      height: auto !important;
    }
  </style>
</head>
<body>
  <div class="vscode-markdown" id="app"></div>

  <script>
    const markdownText = ${jsonEncodedMd};

    // Configure marked to render mermaid blocks as div.mermaid
    const renderer = new marked.Renderer();
    const defaultCode = renderer.code.bind(renderer);

    renderer.code = function(code, lang, escaped) {
      if (lang === 'mermaid') {
        return '<div class="mermaid">' + code + '</div>';
      }
      return defaultCode(code, lang, escaped);
    };

    document.getElementById('app').innerHTML = marked.parse(markdownText, { renderer: renderer });

    // Initialize mermaid with dark theme matching VS Code preview
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        background: '#18181b',
        mainBkg: '#18181b',
        textColor: '#e2e8f0',
        lineColor: '#94a3b8'
      },
      flowchart: {
        useMaxWidth: true,
        curve: 'basis'
      }
    });
  </script>
</body>
</html>`;

  const htmlPath = path.join(__dirname, '..', 'templates', 'architecture_exact_vscode.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('Generated HTML preview at:', htmlPath);

  // Run Playwright
  let playwright;
  try {
    playwright = require(path.join(__dirname, '..', '..', 'ace_finance_frontend', 'node_modules', 'playwright'));
  } catch (e) {
    playwright = require('playwright');
  }

  const { chromium } = playwright;
  console.log('Launching Playwright browser...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.emulateMedia({ colorScheme: 'dark' });

  const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
  console.log('Loading file in browser:', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'load' });

  console.log('Waiting for all Mermaid diagrams to render...');
  await page.waitForSelector('.mermaid svg', { timeout: 15000 });
  // Wait to ensure all fonts and SVG paths are fully settled
  await page.waitForTimeout(3000);

  const pdfPath = path.join(__dirname, '..', 'Aceolution_Finance_Architecture.pdf');
  console.log('Printing to PDF...');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '10mm',
      bottom: '10mm',
      left: '10mm',
      right: '10mm'
    }
  });

  console.log('SUCCESS! Generated exact VS Code dark preview PDF at:', pdfPath);
  await browser.close();
}

build().catch(err => {
  console.error('Error generating exact PDF:', err);
  process.exit(1);
});

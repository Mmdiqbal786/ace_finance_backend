const path = require('path');

async function run() {
  let playwright;
  try {
    playwright = require(path.join(__dirname, '..', '..', 'ace_finance_frontend', 'node_modules', 'playwright'));
  } catch (e) {
    playwright = require('playwright');
  }

  const { chromium } = playwright;
  console.log('Launching browser in dark theme mode...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Emulate dark color scheme so any media queries match dark mode
  await page.emulateMedia({ colorScheme: 'dark' });

  const htmlPath = path.join(__dirname, '..', 'templates', 'architecture_dark_print.html');
  const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');

  console.log('Loading Dark Theme HTML:', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'load' });

  console.log('Waiting for Mermaid diagrams to render...');
  await page.waitForSelector('.mermaid svg', { timeout: 15000 });
  await page.waitForTimeout(3000);

  const outputPath = path.join(__dirname, '..', 'Aceolution_Finance_Architecture.pdf');
  console.log('Generating Dark Theme PDF matching VS Code preview...');
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '10mm',
      bottom: '10mm',
      left: '10mm',
      right: '10mm'
    }
  });

  console.log('SUCCESS! PDF regenerated at:', outputPath);
  await browser.close();
}

run().catch(err => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});

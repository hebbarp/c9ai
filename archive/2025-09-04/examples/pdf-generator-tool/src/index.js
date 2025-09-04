"use strict";

const puppeteer = require("puppeteer");
const MarkdownIt = require("markdown-it");
const fs = require("fs-extra");
const path = require("path");

/**
 * PDF Generator Tool Implementation
 * Converts HTML/Markdown to PDF using Puppeteer
 */
class PDFGenerator {
  constructor(config = {}) {
    this.config = {
      headless: config.headless !== false,
      timeout: config.timeout || 30000,
      ...config
    };
    
    this.markdown = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true
    });
  }

  /**
   * Execute the PDF generation
   */
  async execute(args) {
    const { content, format = "markdown", output = "output.pdf", options = {} } = args;
    
    if (!content) {
      throw new Error("Content is required for PDF generation");
    }
    
    console.log(`📄 Generating PDF: ${output} (${format} input)`);
    
    let browser;
    try {
      // Launch browser
      browser = await puppeteer.launch({
        headless: this.config.headless,
        timeout: this.config.timeout
      });
      
      const page = await browser.newPage();
      
      // Convert content to HTML
      let html = content;
      if (format === "markdown") {
        html = this.convertMarkdownToHTML(content);
      }
      
      // Set page content
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: this.config.timeout
      });
      
      // Generate PDF
      const pdfOptions = this.buildPDFOptions(options);
      const pdfBuffer = await page.pdf(pdfOptions);
      
      // Ensure output directory exists
      const outputPath = path.resolve(output);
      await fs.ensureDir(path.dirname(outputPath));
      
      // Write PDF file
      await fs.writeFile(outputPath, pdfBuffer);
      
      console.log(`✅ PDF generated successfully: ${outputPath}`);
      
      return {
        success: true,
        output: outputPath,
        size: pdfBuffer.length,
        format,
        options: pdfOptions
      };
      
    } catch (error) {
      console.error("❌ PDF generation failed:", error.message);
      
      return {
        success: false,
        error: error.message,
        output
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
  
  /**
   * Convert Markdown to HTML with styling
   */
  convertMarkdownToHTML(markdown) {
    const htmlContent = this.markdown.render(markdown);
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Generated PDF</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
    }
    h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.25em; }
    p { margin-bottom: 16px; }
    code {
      background: #f6f8fa;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-size: 85%;
    }
    pre {
      background: #f6f8fa;
      padding: 16px;
      border-radius: 6px;
      overflow: auto;
    }
    pre code {
      background: none;
      padding: 0;
    }
    blockquote {
      border-left: 4px solid #ddd;
      margin: 0;
      padding: 0 16px;
      color: #666;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    table th, table td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }
    table th {
      background: #f6f8fa;
      font-weight: 600;
    }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
  }
  
  /**
   * Build PDF options from user input
   */
  buildPDFOptions(options = {}) {
    const defaults = {
      format: "A4",
      margin: {
        top: "1cm",
        bottom: "1cm", 
        left: "1cm",
        right: "1cm"
      },
      landscape: false,
      printBackground: true,
      preferCSSPageSize: false
    };
    
    return {
      ...defaults,
      ...options,
      margin: { ...defaults.margin, ...(options.margin || {}) }
    };
  }
}

module.exports = { PDFGenerator };
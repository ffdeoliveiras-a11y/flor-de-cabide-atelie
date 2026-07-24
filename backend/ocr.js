// ============================================================================
//  OCR de notas fiscais escaneadas (foto/CamScanner) — sem dependência nativa:
//  rasteriza o PDF via Python/PyMuPDF e lê o texto com tesseract.js (WASM).
//  O resultado é um RASCUNHO: nomes/códigos saem bem, valores exigem conferência.
// ============================================================================
const { execFile } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

function rasterize(pdfPath, outBase) {
  return new Promise((resolve, reject) => {
    execFile(
      "python",
      [path.join(__dirname, "rasterize_pdf.py"), pdfPath, outBase],
      { timeout: 60000 },
      (err, stdout, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve(stdout))
    );
  });
}

async function ocrPdf(buffer) {
  const tmp = path.join(os.tmpdir(), "fc-nfe-" + crypto.randomBytes(6).toString("hex"));
  fs.mkdirSync(tmp, { recursive: true });
  const pdfPath = path.join(tmp, "nota.pdf");
  fs.writeFileSync(pdfPath, buffer);

  try {
    await rasterize(pdfPath, path.join(tmp, "page"));
    const pngs = fs
      .readdirSync(tmp)
      .filter((f) => f.endsWith(".png"))
      .sort()
      .map((f) => path.join(tmp, f));
    if (!pngs.length) throw new Error("nenhuma página rasterizada");

    const { createWorker } = require("tesseract.js");
    // cachePath = pasta do backend → o dicionário "por" baixa uma vez só
    const worker = await createWorker("por", 1, { cachePath: __dirname });
    let text = "";
    try {
      for (const png of pngs) {
        const { data } = await worker.recognize(png);
        text += data.text + "\n";
      }
    } finally {
      await worker.terminate();
    }
    return text;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

module.exports = { ocrPdf };

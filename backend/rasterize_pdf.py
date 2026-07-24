# -*- coding: utf-8 -*-
"""Converte as paginas de um PDF em PNGs de alta resolucao para OCR.
Uso: python rasterize_pdf.py <entrada.pdf> <prefixo_saida>
Gera <prefixo_saida>_1.png, _2.png... (max 3 paginas)."""
import sys
import fitz

pdf_path, out_base = sys.argv[1], sys.argv[2]
doc = fitz.open(pdf_path)
count = 0
for i, page in enumerate(doc):
    if i >= 3:
        break
    pix = page.get_pixmap(matrix=fitz.Matrix(3.5, 3.5))
    pix.save(f"{out_base}_{i + 1}.png")
    count += 1
print(count)

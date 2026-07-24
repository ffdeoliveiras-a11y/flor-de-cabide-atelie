// ============================================================================
//  Parser de NFe (DANFE) — extrai produtos do texto de uma nota fiscal
//  para registrar no estoque. Funciona com o layout padrão da DANFE, em que
//  cada produto tem: <código> <descrição...> seguidos de uma linha com
//  NCM origem CST CFOP UNID QUANT VALOR_UNIT VALOR_TOTAL ...
//
//  Cobre dois formatos:
//   • O Boticário (distribuidores): código + descrição com "(Desc. X)" no fim,
//     onde "(Desc.)" é o desconto da revendedora em REAIS — ele É o lucro.
//       venda (preço ao cliente) = valor unitário ; custo = valor unitário − desc
//   • Natura/Avon: cada item começa com EAN/código de barras, código colado no
//     nome por hífen ("100605-TODODIA...") e SEM "(Desc.)". Aqui o valor da nota
//     já é o que a revendedora paga: custo = valor unitário e venda fica igual
//     (você ajusta o preço de venda na tela de conferência).
// ============================================================================

function parseBR(s) {
  if (s == null) return 0;
  // remove pontos de milhar, troca vírgula decimal por ponto
  return parseFloat(String(s).replace(/\./g, "").replace(",", ".")) || 0;
}

// Linha de dados fiscais do item: começa com NCM (8 dígitos)
const DATA_RE = /^(\d{8})\s+\d+\s+\d+\s+(\d{4})\s+([A-Za-z]{2,4})\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/;

// Linha que inicia a descrição. Aceita um EAN/código de barras opcional na
// frente (8+ dígitos) e o código separado por espaço OU hífen do nome:
//   "50881 CBEM DES COL..."                  (Boticário)
//   "100605-TODODIA RF DES HID..."           (Natura)
//   "0000000000044821 100605-TODODIA RF..."  (Natura com EAN na frente)
const CODE_RE = /^(?:\d{8,}\s+)?(\d{3,7})\s*[-\s]\s*([A-Za-zÀ-Ú].*)$/;

// Linhas de ruído que não fazem parte do nome do produto
const NOISE_RE = /^(FCI\b|[\d\s.,-]+$)/i;

function detectEmpresa(text) {
  const t = (text || "").toUpperCase();
  if (/BOTICARIO|BOTICÁRIO|EUDORA|BERENICE|QUEM DISSE|\bQDB\b|\bCBEM\b|\bMATCH\b/.test(t))
    return "O BOTICARIO";
  if (/NATURA|\bAVON\b/.test(t)) return "NATURA";
  return "Outros";
}

function detectSupplier(text) {
  const m = (text || "").match(/RECEBEMOS DE\s+(.+?)\s+OS PRODUTOS/i);
  return m ? m[1].trim() : "";
}

function detectNotaNumero(text) {
  const m = (text || "").match(/N[ºo]\s*([\d.]{6,})/);
  return m ? m[1] : "";
}

function parseNFe(text) {
  const lines = (text || "").split(/\r?\n/).map((l) => l.trim());
  const empresa = detectEmpresa(text);
  const supplier = detectSupplier(text);
  const numero = detectNotaNumero(text);

  const items = [];
  let buffer = [];

  for (const line of lines) {
    const m = line.match(DATA_RE);
    if (m) {
      // acha onde a descrição começa (última linha com código no buffer)
      let idx = -1;
      for (let i = buffer.length - 1; i >= 0; i--) {
        if (CODE_RE.test(buffer[i])) {
          idx = i;
          break;
        }
      }
      if (idx >= 0) {
        const descLines = buffer.slice(idx);
        const first = descLines[0].match(CODE_RE);
        const code = first[1];
        // junta as linhas de continuação, ignorando ruído (FCI, EANs soltos)
        const cont = descLines.slice(1).filter((l) => l && !NOISE_RE.test(l));
        let name = (first[2] + " " + cont.join(" ")).replace(/\s+/g, " ").trim();

        // desconto em reais "(Desc. 26.14)" — aqui o ponto é decimal (estilo americano)
        let discount = 0;
        const dm = name.match(/\(Desc\.?\s*([\d.,]+)\)/i);
        if (dm) {
          discount = parseFloat(String(dm[1]).replace(",", ".")) || 0;
          name = name.replace(dm[0], "").trim();
        }

        const ncm = m[1];
        const cfop = m[2];
        const unit = m[3].toUpperCase();
        const quantity = parseBR(m[4]) || 1;
        const unitValue = parseBR(m[5]); // valor unitário na nota

        // Com desconto (Boticário): venda = valor de catálogo, custo = catálogo − desc.
        // Sem desconto (Natura/genérico): o valor da nota já é o custo; venda = custo.
        const cost = Math.max(0, Number((unitValue - discount / quantity).toFixed(2)));
        const sale = Number(unitValue.toFixed(2));

        const isBonus =
          cfop === "5910" ||
          /CAT[ÁA]LOGO|CATALOGO|\bGUIA\b|REVISTA|BRINDE|AMOSTRA/i.test(name);

        items.push({
          code,
          name,
          ncm,
          cfop,
          unit,
          quantity,
          discount,
          cost,
          sale,
          isBonus,
          empresa,
        });
      }
      buffer = [];
    } else {
      buffer.push(line);
    }
  }

  return { empresa, supplier, numero, items };
}

// ---------------------------------------------------------------------------
//  Parser leniente para texto vindo de OCR (nota escaneada/foto).
//  O OCR erra números (come vírgulas), então aqui o objetivo é um RASCUNHO:
//  código + nome + empresa saem confiáveis; quantidade/valores só quando
//  claramente legíveis — o resto fica para a conferência manual na tela.
// ---------------------------------------------------------------------------
const OCR_ITEM_RE = /(\d{3,7})\s*-\s*([A-Za-zÀ-Ú0-9][^|]{2,60}?)\s+VP[NT]\b/i;

function parseNFeOCR(text) {
  const empresa = detectEmpresa(text);
  const supplier = /NATURA\s+COSM/i.test(text)
    ? "NATURA COSMÉTICOS"
    : detectSupplier(text);
  const numero =
    (text.match(/Nr\.?\s*([\d.]{6,})/i) || text.match(/N[ºo]\s*([\d.]{6,})/) || [])[1] || "";

  const items = [];
  const seen = new Set();
  for (const raw of (text || "").split(/\r?\n/)) {
    const line = raw.trim();
    const m = line.match(OCR_ITEM_RE);
    if (!m) continue;

    const code = m[1];
    const name = m[2].replace(/[|[\]*ºj]/g, " ").replace(/\s+/g, " ").trim();
    if (name.length < 4) continue;

    // Quantidade: padrão "PC | 00002" — só aceita quando bem legível
    let quantity = 1;
    const qm = line.match(/\bPC\b\s*[|\s[\]]*[o0]{2,4}(\d{1,2})\b/i);
    if (qm) quantity = Math.max(1, parseInt(qm[1], 10) || 1);

    // Primeiro valor com decimal claro (vírgula ou ponto) depois do nome
    const after = line.slice(line.indexOf(m[0]) + m[0].length);
    const vals = [...after.matchAll(/\b(\d{1,3}[.,]\d{2})\b/g)]
      .map((x) => parseFloat(x[1].replace(",", ".")))
      .filter((v) => v > 0);
    const unit = vals.length ? Number(vals[0].toFixed(2)) : 0;

    // linhas repetidas idênticas (código+qtd+valor) só entram uma vez
    const key = `${code}|${quantity}|${unit}|${name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      code,
      name,
      ncm: "",
      cfop: "",
      unit: "UN",
      quantity,
      discount: 0,
      cost: unit,
      sale: unit,
      isBonus: /CAT[ÁA]LOGO|CATALOGO|\bGUIA\b|REVISTA|BRINDE|AMOSTRA/i.test(name),
      empresa,
    });
  }

  return { empresa, supplier, numero, items };
}

module.exports = { parseNFe, parseNFeOCR, detectEmpresa };

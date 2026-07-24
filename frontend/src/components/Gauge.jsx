// Velocímetro (ponteiro acelerador) — dial semicircular com agulha apontando
// o progresso (0–100% da meta) e um traço marcando "onde você deveria estar hoje".
const R = 80;
const CX = 100;
const CY = 100;
const ARC_LEN = Math.PI * R; // comprimento do semicírculo

// caminho do arco superior (esquerda 0% → direita 100%)
const BASE_PATH = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;

function point(pct, len) {
  const clamped = Math.min(Math.max(pct, 0), 100);
  const ang = ((180 - (clamped / 100) * 180) * Math.PI) / 180;
  return { x: CX + len * Math.cos(ang), y: CY - len * Math.sin(ang) };
}

export function Gauge({ pct = 0, expectedPct = 0, color = "#6B3F2A" }) {
  const frac = Math.min(Math.max(pct, 0), 100) / 100;
  const tip = point(pct, 58);
  const paceOut = point(expectedPct, R + 9);
  const paceIn = point(expectedPct, R - 9);

  return (
    <svg viewBox="0 0 200 118" className="mx-auto w-full max-w-[300px]">
      {/* trilho de fundo */}
      <path
        d={BASE_PATH}
        fill="none"
        stroke="#E8B4BC55"
        strokeWidth="14"
        strokeLinecap="round"
      />
      {/* progresso */}
      <path
        d={BASE_PATH}
        fill="none"
        stroke={color}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${ARC_LEN * frac} ${ARC_LEN * 2}`}
      />
      {/* marcador "onde você deveria estar hoje" */}
      {expectedPct > 1 && expectedPct < 100 && (
        <line
          x1={paceOut.x}
          y1={paceOut.y}
          x2={paceIn.x}
          y2={paceIn.y}
          stroke="#3D2B1F"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      )}
      {/* agulha */}
      <line
        x1={CX}
        y1={CY}
        x2={tip.x}
        y2={tip.y}
        stroke="#3D2B1F"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle cx={CX} cy={CY} r="7" fill="#3D2B1F" />
      <circle cx={CX} cy={CY} r="3" fill="#FDFAF7" />
      {/* rótulos das pontas */}
      <text x={CX - R} y={CY + 16} textAnchor="middle" fontSize="9" fill="#3D2B1F88">
        R$ 0
      </text>
      <text x={CX + R} y={CY + 16} textAnchor="middle" fontSize="9" fill="#3D2B1F88">
        meta
      </text>
    </svg>
  );
}

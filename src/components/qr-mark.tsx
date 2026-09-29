import { encode } from "uqr";
import { useMemo } from "react";

type Props = {
  value: string;
  title?: string;
};

export function QrMark({ value, title = "QR code" }: Props) {
  const { path, size } = useMemo(() => {
    const qr = encode(value || "TECHCLUB", { ecc: "M", border: 1 });
    const parts: string[] = [];
    for (let y = 0; y < qr.size; y++) {
      const row = qr.data[y];
      if (!row) continue;
      for (let x = 0; x < qr.size; x++) {
        if (row[x]) parts.push(`M${x} ${y}h1v1h-1z`);
      }
    }
    return { path: parts.join(""), size: qr.size };
  }, [value]);

  return (
    <svg
      className="access-card__qr-svg"
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <rect width={size} height={size} fill="#ffffff" />
      <path fill="#0b1c48" d={path} />
    </svg>
  );
}

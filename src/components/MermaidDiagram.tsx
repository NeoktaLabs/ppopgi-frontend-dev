// src/components/MermaidDiagram.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import mermaid from "mermaid";

type Props = {
  code: string;
  className?: string;
};

export function MermaidDiagram({ code, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  // unique id per render (mermaid needs unique render ids)
  const renderId = useMemo(() => `mmd-${Math.random().toString(16).slice(2)}`, [code]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setError(null);

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "default",
          flowchart: { curve: "basis" },
        });

        // mermaid.render returns { svg, bindFunctions }
        const { svg } = await mermaid.render(renderId, code);

        if (cancelled) return;

        if (containerRef.current) {
          containerRef.current.innerHTML = svg;

          // Make it responsive + horizontally scrollable
          const svgEl = containerRef.current.querySelector("svg");
          if (svgEl) {
            svgEl.setAttribute("width", "100%");
            svgEl.style.height = "auto";
            svgEl.style.maxWidth = "1100px";
          }
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Mermaid failed to render.");
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [code, renderId]);

  return (
    <div className={className} style={{ overflowX: "auto" }}>
      {error ? (
        <div style={{ padding: 12, color: "#b91c1c", fontWeight: 700 }}>
          Mermaid render error: {error}
        </div>
      ) : (
        <div ref={containerRef} />
      )}
    </div>
  );
}

export default MermaidDiagram;
import { useEffect, useRef } from "react";
import mermaid from "mermaid";

type Props = {
  code: string;
  id?: string;
};

export function MermaidDiagram({ code, id = "mermaid-diagram" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "strict",
      flowchart: {
        curve: "basis",
      },
    });

    if (ref.current) {
      ref.current.innerHTML = "";
      mermaid.render(id, code).then(({ svg }) => {
        if (ref.current) {
          ref.current.innerHTML = svg;
        }
      });
    }
  }, [code, id]);

  return (
    <div
      ref={ref}
      className="mermaid-wrapper"
      aria-label="Raffle lifecycle diagram"
      role="img"
    />
  );
}
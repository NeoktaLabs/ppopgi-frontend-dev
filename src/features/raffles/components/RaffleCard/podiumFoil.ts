// Shiny podium “foil” backgrounds (only for top 3 cards)
export function podiumFoil(kind: "gold" | "silver" | "bronze") {
  if (kind === "gold") {
    return {
      bg:
        "radial-gradient(900px 280px at 20% 20%, rgba(255,255,255,0.85), rgba(255,255,255,0) 55%)," +
        "radial-gradient(700px 240px at 80% 25%, rgba(255,255,255,0.55), rgba(255,255,255,0) 60%)," +
        "linear-gradient(135deg, rgba(255,216,154,0.98), rgba(255,190,120,0.90) 40%, rgba(255,232,190,0.92))",
      ink: "#4A2A00",
      inkStrong: "#3A1F00",
      tear: "rgba(150,88,0,0.55)",
    };
  }
  if (kind === "silver") {
    return {
      bg:
        "radial-gradient(900px 280px at 20% 20%, rgba(255,255,255,0.85), rgba(255,255,255,0) 55%)," +
        "radial-gradient(700px 240px at 80% 25%, rgba(255,255,255,0.55), rgba(255,255,255,0) 60%)," +
        "linear-gradient(135deg, rgba(236,241,250,0.98), rgba(218,226,238,0.92) 45%, rgba(245,248,255,0.92))",
      ink: "#1F2A3A",
      inkStrong: "#121B29",
      tear: "rgba(40,60,90,0.40)",
    };
  }
  // bronze
  return {
    bg:
      "radial-gradient(900px 280px at 20% 20%, rgba(255,255,255,0.82), rgba(255,255,255,0) 55%)," +
      "radial-gradient(700px 240px at 80% 25%, rgba(255,255,255,0.52), rgba(255,255,255,0) 60%)," +
      "linear-gradient(135deg, rgba(246,182,200,0.98), rgba(206,130,105,0.92) 45%, rgba(255,220,205,0.92))",
    ink: "#4A1A12",
    inkStrong: "#35110B",
    tear: "rgba(120,55,40,0.45)",
  };
}

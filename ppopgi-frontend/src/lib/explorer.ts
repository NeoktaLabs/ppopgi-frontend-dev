export function friendlyStatus(status?: string) {
  switch ((status ?? "").toUpperCase()) {
    case "OPEN":
      return "Open";
    case "DRAWING":
      return "Drawing";
    case "COMPLETED":
      return "Settled";
    case "CANCELED":
    case "CANCELLED":
      return "Cancelled";
    default:
      return status ? status : "Unknown";
  }
}
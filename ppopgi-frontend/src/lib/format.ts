import { GraphQLClient } from "graphql-request";

export function getSubgraphClient() {
  const url = import.meta.env.VITE_SUBGRAPH_URL as string;

  if (!url) {
    throw new Error("Missing VITE_SUBGRAPH_URL");
  }

  return new GraphQLClient(url);
}
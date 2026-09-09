import type { ContractRouterClient } from "@orpc/contract";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { searchContract } from "./contract";

const link = new RPCLink({
  url: "/api/rpc",
});

export const searchClient: ContractRouterClient<typeof searchContract> = createORPCClient(link);

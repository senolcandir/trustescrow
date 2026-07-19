import { createConfig, fallback, http } from "wagmi";
import { injected } from "@wagmi/core";
import { arcTestnet } from "./chains";

// Arc's public testnet RPC gets heavy hackathon traffic and rate-limits
// aggressively. We chain it with alternate public RPC providers (listed by
// Circle in the arc-node docs) as a fallback - if one is busy, viem tries
// the next automatically instead of failing outright.
const rpcOptions = { retryCount: 3, retryDelay: 1200, timeout: 15000 };

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: fallback([
      http("https://rpc.testnet.arc.network", rpcOptions),
      http("https://arc-testnet.drpc.org", rpcOptions),
      http("https://rpc.drpc.testnet.arc.network", rpcOptions),
      http("https://rpc.quicknode.testnet.arc.network", rpcOptions),
      http("https://rpc.blockdaemon.testnet.arc.network", rpcOptions),
    ]),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

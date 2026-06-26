import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";
import { rpcFor, type Network } from "@/lib/og";
import { walletFor, type UserRow } from "@/lib/server/users";

const og = (v: unknown): number => {
  try {
    return Number(ethers.formatEther(String(v ?? "0")));
  } catch {
    return 0;
  }
};

export type FundedModel = { model: string; provider: string; balance: number };
export type FundingState = {
  walletAddress: string;
  network: Network;
  native: number;
  ledger: { total: number; available: number; locked: number };
  models: FundedModel[];
};

function brokerFor(user: UserRow, net: Network) {
  const wallet = walletFor(user, new ethers.JsonRpcProvider(rpcFor(net)));
  return { wallet, broker: createZGComputeNetworkBroker(wallet) };
}

// Read the user's full funding picture: native balance, the 0G Compute ledger,
// and every model sub-account that currently holds funds.
export async function fundingState(user: UserRow, net: Network): Promise<FundingState> {
  const { wallet, broker: brokerP } = brokerFor(user, net);
  const broker = await brokerP;

  const native = og(await wallet.provider!.getBalance(wallet.address));

  let total = 0;
  let available = 0;
  try {
    const led = (await broker.ledger.getLedger()) as unknown as unknown[];
    available = og(led?.[1]);
    total = og(led?.[2]);
  } catch {
    // no ledger created yet
  }

  const models: FundedModel[] = [];
  try {
    const svcs = await broker.inference.listService();
    const chat = (svcs || []).filter(
      (s) => String(s.serviceType || "").toLowerCase().includes("chat") || !s.serviceType,
    );
    for (const s of chat) {
      try {
        const a = (await broker.inference.getAccount(String(s.provider))) as unknown as Record<string, unknown> & unknown[];
        const balance = og(a?.balance ?? a?.[2] ?? a?.[1]);
        if (balance > 0) models.push({ model: String(s.model || ""), provider: String(s.provider), balance });
      } catch {
        // no sub-account for this provider — skip
      }
    }
  } catch {
    // marketplace unavailable
  }

  const locked = Math.max(0, total - available);
  return { walletAddress: wallet.address, network: net, native, ledger: { total, available, locked }, models };
}

// Pull every inference sub-account's balance back to the ledger's main (available)
// balance. Note: 0G time-locks retrieved funds before they become spendable.
export async function reclaimAll(user: UserRow, net: Network): Promise<void> {
  const { broker: brokerP } = brokerFor(user, net);
  const broker = await brokerP;
  await broker.ledger.retrieveFund("inference");
}

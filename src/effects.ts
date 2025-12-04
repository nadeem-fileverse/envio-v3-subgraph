import { createEffect, S } from "envio";
import { createPublicClient, fallback, http, zeroAddress } from "viem";
import { gnosis } from "viem/chains";
import AppABI from "../abis/App.json";
import AppRegistryABI from "../abis/AppRegistry.json";
import { retryOnError } from "./utils";
import { OnChainAppInfo, OnChainFile } from "./type";

const publicClient = createPublicClient({
  chain: gnosis,
  transport: fallback([
    http(process.env.ENVIO_RPC_URL as string),
    http(process.env.ENVIO_RPC_URL_2 as string),
  ]),
  batch: { multicall: true },
});

export const getAppMetadataIPFSHash = createEffect(
  {
    name: "getAppMetadataIPFSHash",
    input: S.string,
    output: S.string,
    rateLimit: false,
    cache: true,
  },
  async ({ input: appAddress, context }) => {
    try {
      const appMetadata = (await publicClient.readContract({
        address: appAddress as `0x${string}`,
        abi: AppABI,
        functionName: "metadataIPFSHash",
      })) as string;

      return appMetadata;
    } catch (error) {
      context.log.error(
        `Error getting app metadata IPFSHash for ${appAddress}: ${error}`
      );
      return "";
    }
  }
);

export const getCollaboratorKeys = createEffect(
  {
    name: "getCollaboratorKeys",
    input: {
      appAddress: S.string,
      account: S.string,
    },
    output: S.string,
    rateLimit: false,
    cache: true,
  },
  async ({ input: { appAddress, account }, context }) => {
    try {
      const collaboratorKeys = (await publicClient.readContract({
        address: appAddress as `0x${string}`,
        abi: AppABI,
        functionName: "collaboratorKeys",
        args: [account as `0x${string}`],
      })) as string;

      return collaboratorKeys;
    } catch (error) {
      context.log.error(
        `Error getting collaborator keys for ${appAddress} and ${account}: ${error}`
      );
      return "";
    }
  }
);

export const getFileByFileId = createEffect(
  {
    name: "getFileByFileId",
    input: {
      fileId: S.bigint,
      appAddress: S.string,
    },
    output: {
      appFileId: S.string,
      fileType: S.number,
      metadataIPFSHash: S.string,
      contentIPFSHash: S.string,
      gateIPFSHash: S.string,
      version: S.bigint,
      owner: S.string,
    },
    rateLimit: false,
    cache: false,
  },
  async ({ input: { fileId, appAddress }, context }) => {
    const values = (await retryOnError(
      async () => {
        return await publicClient.readContract({
          address: appAddress as `0x${string}`,
          abi: AppABI,
          functionName: "files",
          args: [fileId],
        });
      },
      { maxAttempts: 3, delayMs: 1000 },
      context
    )) as OnChainFile;

    return {
      appFileId: values?.appFileId || "appFileId",
      fileType: values?.fileType || 0,
      metadataIPFSHash: values?.metadataIPFSHash || "metadataIPFSHash",
      contentIPFSHash: values?.contentIPFSHash || "contentIPFSHash",
      gateIPFSHash: values?.gateIPFSHash || "gateIPFSHash",
      version: values?.version || 0n,
      owner: values?.owner || zeroAddress,
    };
  }
);

export const getAppInfo = createEffect(
  {
    name: "getAppInfo",
    input: S.string,
    output: {
      app: S.string,
      index: S.bigint,
      tokenId: S.bigint,
      owner: S.string,
    },
    rateLimit: false,
    cache: true,
  },
  async ({ input: appAddress, context }) => {
    const { app, index, tokenId, owner } = (await retryOnError(
      async () => {
        return await publicClient.readContract({
          address: "0xdb0def9f0992e68d7170e15c4788ff62a0210ca1",
          abi: AppRegistryABI,
          functionName: "appInfo",
          args: [appAddress as `0x${string}`],
        });
      },
      { maxAttempts: 3, delayMs: 1000 },
      context
    )) as OnChainAppInfo;

    return {
      app,
      index,
      tokenId,
      owner,
    };
  }
);

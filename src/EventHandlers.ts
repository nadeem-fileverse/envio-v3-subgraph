import { AppRegistry, App } from "generated";
import {
  getAppInfo,
  getAppMetadataIPFSHash,
  getCollaboratorKeys,
  getFileByFileId,
} from "./effects";
import { keccak256, stringToBytes } from "viem";

const APP_REGISTRY_ADDRESS = process.env.ENVIO_APP_REGISTRY_ADDRESS as string;

AppRegistry.Mint.contractRegister(async ({ event, context }) => {
  const appAddress = event.params.app;
  context.addApp(appAddress);
});

AppRegistry.Mint.handler(async ({ event, context }) => {
  const appAddress = event.params.app;
  const tokenId = event.params.tokenId;
  const account = event.params.account;

  const metadataIPFSHash = await context.effect(
    getAppMetadataIPFSHash,
    appAddress
  );

  const appRegistryAddress = event.srcAddress;

  context.App.set({
    appAddress: appAddress as string,
    by: account as string,
    id: appAddress,
    lastTransactionBlockNumber: BigInt(event.block.number),
    lastTransactionBlockTimestamp: BigInt(event.block.timestamp),
    lastTransactionHash: event.transaction.hash as string,
    registryAddress: appRegistryAddress as string,
    tokenId: tokenId as bigint,
    metadataIPFSHash: metadataIPFSHash || "",
    owner: account as string,
  });

  const collaboratorKey = await context.effect(getCollaboratorKeys, {
    appAddress: appAddress as string,
    account: account as string,
  });

  context.CollaboratorEvent.set({
    appAddress: appAddress as string,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    by: account as string,
    eventType: "AddedCollaborator",
    account: account as string,
    did: collaboratorKey || "",
    registryAddress: appRegistryAddress as string,
    tokenId: tokenId as bigint,
    transactionHash: event.transaction.hash as string,
    id: account,
  });

  context.Collaborator.set({
    account: account as string,
    appAddress: appAddress as string,
    by: account as string,
    did: collaboratorKey || "",
    isDeleted: false,
    deletedBy: undefined,
    id: account,
    lastTransactionBlockNumber: BigInt(event.block.number),
    lastTransactionBlockTimestamp: BigInt(event.block.timestamp),
    lastTransactionHash: event.transaction.hash as string,
    registryAddress: appRegistryAddress as string,
    tokenId: tokenId as bigint,
  });
});

App.UpdatedAppMetadata.handler(async ({ event, context }) => {
  const metadataIPFSHash = event.params.metadataIPFSHash;
  const by = event.params.by;
  const appAddress = event.srcAddress;
  const currentApp = await context.App.get(appAddress);

  const registryAddress = currentApp?.registryAddress;
  const tokenId = currentApp
    ? currentApp.tokenId
    : (await context.effect(getAppInfo, appAddress)).tokenId;

  context.AppEvent.set({
    appAddress: event.srcAddress as string,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    by: by,
    eventType: "UpdatedAppMetadata",
    metadataIPFSHash: event.params.metadataIPFSHash,
    registryAddress: registryAddress as string,
    tokenId: tokenId as bigint,
    transactionHash: event.transaction.hash as string,
    owner: by as string,
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
  });

  if (currentApp) {
    context.App.set({
      ...currentApp,
      metadataIPFSHash: metadataIPFSHash as string,
      lastTransactionBlockNumber: BigInt(event.block.number),
      lastTransactionBlockTimestamp: BigInt(event.block.timestamp),
      lastTransactionHash: event.transaction.hash as string,
    });
  }
});

App.OwnershipTransferStarted.handler(async ({ event, context }) => {
  const previousOwner = event.params.previousOwner;
  const newOwner = event.params.newOwner;
  const appAddress = event.srcAddress;
  const currentApp = await context.App.get(appAddress);
  const registryAddress = currentApp?.registryAddress || APP_REGISTRY_ADDRESS;
  const tokenId = currentApp
    ? currentApp.tokenId
    : (await context.effect(getAppInfo, appAddress)).tokenId;

  const metadataIPFSHash = currentApp
    ? currentApp.metadataIPFSHash
    : await context.effect(getAppMetadataIPFSHash, appAddress);

  context.AppEvent.set({
    appAddress: event.srcAddress as string,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    by: previousOwner as string,
    eventType: "OwnershipTransferStarted",
    transactionHash: event.transaction.hash as string,
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    metadataIPFSHash: metadataIPFSHash as string,
    owner: newOwner as string,
    registryAddress: registryAddress as string,
    tokenId: tokenId as bigint,
  });

  if (currentApp) {
    context.App.set({
      ...currentApp,
      owner: newOwner as string,
      lastTransactionBlockNumber: BigInt(event.block.number),
      lastTransactionBlockTimestamp: BigInt(event.block.timestamp),
      lastTransactionHash: event.transaction.hash as string,
    });
  }
});

App.OwnershipTransferred.handler(async ({ event, context }) => {
  const previousOwner = event.params.previousOwner;
  const newOwner = event.params.newOwner;
  const appAddress = event.srcAddress;
  const currentApp = await context.App.get(appAddress);
  const registryAddress = currentApp?.registryAddress || APP_REGISTRY_ADDRESS;
  const tokenId = currentApp
    ? currentApp.tokenId
    : (await context.effect(getAppInfo, appAddress)).tokenId;
  const metadataIPFSHash = currentApp
    ? currentApp.metadataIPFSHash
    : await context.effect(getAppMetadataIPFSHash, appAddress);

  context.AppEvent.set({
    appAddress: event.srcAddress as string,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    by: previousOwner as string,
    eventType: "OwnershipTransferred",
    transactionHash: event.transaction.hash as string,
    id: appAddress,
    metadataIPFSHash: metadataIPFSHash as string,
    owner: newOwner as string,
    registryAddress: registryAddress as string,
    tokenId: tokenId as bigint,
  });
  if (currentApp) {
    context.App.set({
      ...currentApp,
      owner: newOwner as string,
      lastTransactionBlockNumber: BigInt(event.block.number),
      lastTransactionBlockTimestamp: BigInt(event.block.timestamp),
      lastTransactionHash: event.transaction.hash as string,
    });
  }
});

App.AddedFile.handler(async ({ event, context }) => {
  const fileId = event.params.fileId;
  const rawAppFileId = event.params.rawAppFileId;
  const fileType = event.params.fileType;
  const metadataIPFSHash = event.params.metadataIPFSHash;
  const contentIPFSHash = event.params.contentIPFSHash;
  const gateIPFSHash = event.params.gateIPFSHash;
  const tokenId = event.params.tokenId;
  const by = event.params.by;

  const currentApp = await context.App.get(event.srcAddress);
  const registryAddress = currentApp?.registryAddress || APP_REGISTRY_ADDRESS;

  context.FileEvent.set({
    appAddress: event.srcAddress,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    by: by,
    eventType: "AddedFile",
    fileId: fileId as bigint,
    rawAppFileId: rawAppFileId,
    fileType: fileType.toString(),
    metadataIPFSHash: metadataIPFSHash,
    contentIPFSHash: contentIPFSHash,
    gateIPFSHash: gateIPFSHash,
    tokenId: tokenId,
    transactionHash: event.transaction.hash,
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    appFileId: keccak256(stringToBytes(rawAppFileId)),
    registryAddress: registryAddress,
  });

  context.File.set({
    appAddress: event.srcAddress,
    appFileId: keccak256(stringToBytes(rawAppFileId)),
    by: by,
    contentIPFSHash: contentIPFSHash,
    editedBy: by,
    fileId: fileId,
    fileType: fileType.toString(),
    gateIPFSHash: gateIPFSHash,
    metadataIPFSHash: metadataIPFSHash,
    rawAppFileId: rawAppFileId,
    registryAddress: registryAddress as string,
    tokenId: tokenId,
    lastTransactionBlockNumber: BigInt(event.block.number),
    lastTransactionBlockTimestamp: BigInt(event.block.timestamp),
    lastTransactionHash: event.transaction.hash,
    id: event.params.fileId.toString(),
    isDeleted: false,
  });
});

App.EditedFile.handler(async ({ event, context }) => {
  const fileId = event.params.fileId;
  const rawAppFileId = event.params.rawAppFileId;
  const fileType = event.params.fileType;
  const metadataIPFSHash = event.params.metadataIPFSHash;
  const contentIPFSHash = event.params.contentIPFSHash;
  const gateIPFSHash = event.params.gateIPFSHash;
  const tokenId = event.params.tokenId;
  const by = event.params.by;

  const currentApp = await context.App.get(event.srcAddress);
  const registryAddress = currentApp?.registryAddress || APP_REGISTRY_ADDRESS;

  context.FileEvent.set({
    appAddress: event.srcAddress,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    by: by,
    eventType: "EditedFile",
    fileId: fileId,
    rawAppFileId: rawAppFileId,
    fileType: fileType.toString(),
    metadataIPFSHash: metadataIPFSHash,
    contentIPFSHash: contentIPFSHash,
    gateIPFSHash: gateIPFSHash,
    tokenId: tokenId,
    transactionHash: event.transaction.hash,
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    appFileId: keccak256(stringToBytes(rawAppFileId)),
    registryAddress: registryAddress,
  });

  const existingFile = await context.File.get(fileId.toString());
  if (existingFile) {
    context.File.set({
      ...existingFile,
      metadataIPFSHash: metadataIPFSHash,
      contentIPFSHash: contentIPFSHash,
      gateIPFSHash: gateIPFSHash,
      lastTransactionBlockNumber: BigInt(event.block.number),
      lastTransactionBlockTimestamp: BigInt(event.block.timestamp),
      lastTransactionHash: event.transaction.hash,
      editedBy: by,
      fileType: fileType.toString(),
    });
  }
});

App.DeletedFile.handler(async ({ event, context }) => {
  const fileId = event.params.fileId;
  const rawAppFileId = event.params.rawAppFileId;
  const by = event.params.by;
  const appAddress = event.srcAddress;
  const app = await context.App.get(appAddress);
  const registryAddress = app?.registryAddress || APP_REGISTRY_ADDRESS;
  const tokenId = app
    ? app.tokenId
    : (await context.effect(getAppInfo, appAddress)).tokenId;

  const file = await context.effect(getFileByFileId, {
    fileId: fileId,
    appAddress: appAddress,
  });
  // const fileEventEntity = await context.FileEvent.get(fileId.toString());

  const fileType = file.fileType?.toString() || "0";

  context.FileEvent.set({
    appAddress: event.srcAddress,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    by: by,
    eventType: "DeletedFile",
    fileId: fileId,
    rawAppFileId: rawAppFileId,
    fileType: fileType,
    metadataIPFSHash: file.metadataIPFSHash,
    contentIPFSHash: file.contentIPFSHash,
    gateIPFSHash: file.gateIPFSHash,
    tokenId: tokenId as bigint,
    transactionHash: event.transaction.hash,
    id: `${event.chainId}-${event.transaction.hash}-${event.logIndex}`,
    appFileId: keccak256(stringToBytes(rawAppFileId)),
    registryAddress: registryAddress as string,
  });

  const existingFile = await context.File.get(fileId.toString());
  if (existingFile) {
    context.File.set({
      ...existingFile,
      isDeleted: true,
      lastTransactionBlockNumber: BigInt(event.block.number),
      lastTransactionBlockTimestamp: BigInt(event.block.timestamp),
      lastTransactionHash: event.transaction.hash,
      fileType: file.fileType.toString(),
      editedBy: by,
    });
  }
});

App.AddedCollaborator.handler(async ({ event, context }) => {
  const account = event.params.account;
  const by = event.params.by;
  const appAddress = event.srcAddress;
  const app = await context.App.get(appAddress);
  const registryAddress = app?.registryAddress || APP_REGISTRY_ADDRESS;
  const tokenId = app
    ? app.tokenId
    : (await context.effect(getAppInfo, appAddress)).tokenId;

  const did = await context.effect(getCollaboratorKeys, {
    appAddress: appAddress,
    account: account as string,
  });

  context.CollaboratorEvent.set({
    appAddress: event.srcAddress,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    by: by,
    eventType: "AddedCollaborator",
    account: account,
    registryAddress: registryAddress as string,
    tokenId: tokenId as bigint,
    transactionHash: event.transaction.hash,
    id: account,
    did: did,
  });

  context.Collaborator.set({
    account: account,
    appAddress: appAddress as string,
    by: by,
    did: did,
    isDeleted: false,
    deletedBy: undefined,
    id: account,
    lastTransactionBlockNumber: BigInt(event.block.number),
    lastTransactionBlockTimestamp: BigInt(event.block.timestamp),
    lastTransactionHash: event.transaction.hash,
    registryAddress: registryAddress as string,
    tokenId: tokenId as bigint,
  });
});

App.RegisteredCollaboratorKeys.handler(async ({ event, context }) => {
  const account = event.params.account;
  const did = event.params.did;
  const appAddress = event.srcAddress;
  const app = await context.App.get(appAddress);
  const registryAddress = app?.registryAddress || APP_REGISTRY_ADDRESS;
  const tokenId = app
    ? app.tokenId
    : (await context.effect(getAppInfo, appAddress)).tokenId;

  const existingCollaborator = await context.Collaborator.get(account);

  context.CollaboratorEvent.set({
    appAddress: event.srcAddress,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    by: account,
    eventType: "RegisteredCollaboratorKeys",
    account: account,
    did: did,
    registryAddress: registryAddress as string,
    tokenId: tokenId as bigint,
    transactionHash: event.transaction.hash,
    id: account,
  });

  if (existingCollaborator) {
    context.Collaborator.set({
      ...existingCollaborator,
      did: did,
      lastTransactionBlockNumber: BigInt(event.block.number),
      lastTransactionBlockTimestamp: BigInt(event.block.timestamp),
      lastTransactionHash: event.transaction.hash,
    });
  }
});

App.RemovedCollaboratorKeys.handler(async ({ event, context }) => {
  const account = event.params.account;

  const appAddress = event.srcAddress;
  const app = await context.App.get(appAddress);
  const registryAddress = app?.registryAddress || APP_REGISTRY_ADDRESS;
  const tokenId = app
    ? app.tokenId
    : (await context.effect(getAppInfo, appAddress)).tokenId;

  context.CollaboratorEvent.set({
    appAddress: event.srcAddress,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    by: account,
    eventType: "RemovedCollaboratorKeys",
    account: account,
    registryAddress: registryAddress as string,
    tokenId: tokenId as bigint,
    transactionHash: event.transaction.hash,
    id: account,
    did: "",
  });

  const existingCollaborator = await context.Collaborator.get(account);
  if (existingCollaborator) {
    context.Collaborator.set({
      ...existingCollaborator,
      did: "",
      lastTransactionBlockNumber: BigInt(event.block.number),
      lastTransactionBlockTimestamp: BigInt(event.block.timestamp),
      lastTransactionHash: event.transaction.hash,
    });
  }
});

App.RemovedCollaborator.handler(async ({ event, context }) => {
  const account = event.params.account;
  const by = event.params.by;
  const appAddress = event.srcAddress;
  const app = await context.App.get(appAddress);
  const registryAddress = app?.registryAddress || APP_REGISTRY_ADDRESS;
  const tokenId = app
    ? app.tokenId
    : (await context.effect(getAppInfo, appAddress)).tokenId;

  context.CollaboratorEvent.set({
    appAddress: event.srcAddress,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    by: by,
    eventType: "RemovedCollaborator",
    account: account,
    registryAddress: registryAddress as string,
    tokenId: tokenId as bigint,
    transactionHash: event.transaction.hash,
    id: account,
    did: "",
  });

  const existingCollaborator = await context.Collaborator.get(account);
  if (existingCollaborator) {
    context.Collaborator.set({
      ...existingCollaborator,
      did: "",
      isDeleted: true,
      deletedBy: by,
      lastTransactionBlockNumber: BigInt(event.block.number),
      lastTransactionBlockTimestamp: BigInt(event.block.timestamp),
      lastTransactionHash: event.transaction.hash,
    });
  }
});

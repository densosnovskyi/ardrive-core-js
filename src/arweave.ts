/* eslint-disable import/prefer-default-export */
// arweave.js
import * as fs from 'fs';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { getWinston, appName, appVersion, asyncForEach, cipher } from './common';
import { FileToUpload, Wallet } from './types';
import { updateFileMetaDataSyncStatus, updateFileDataSyncStatus, getDriveInfoFromSyncTable, setFileUploaderObject, updateUserPublicArDriveTx } from './db';
import Community from 'community-js';
import Arweave from 'arweave';


const arweave = Arweave.init({
  // host: 'perma.online', // ARCA Community Gateway
  host: 'arweave.net', // Arweave Gateway
  port: 443,
  protocol: 'https',
  timeout: 600000,
});

// ArDrive Profit Sharing Community Smart Contract
const communityTxId = '-8A6RexFkpfWwuyVO98wzSFZh0d6VJuI-buTJvlwOJQ';

// eslint-disable-next-line new-cap
const community = new Community(arweave);

const getAddressForWallet = async (walletPrivateKey: JWKInterface) => {
  return arweave.wallets.jwkToAddress(walletPrivateKey);
};

// Creates a new Arweave wallet
const generateWallet = async (): Promise<Wallet> => {
  const walletPrivateKey = await arweave.wallets.generate();
  const walletPublicKey = await getAddressForWallet(walletPrivateKey);
  return { walletPrivateKey, walletPublicKey };
};

// Imports an existing wallet on a local drive
const getLocalWallet = async (existingWalletPath: string) => {
  const walletPrivateKey : JWKInterface = JSON.parse(fs.readFileSync(existingWalletPath).toString());
  const walletPublicKey = await getAddressForWallet(walletPrivateKey);
  return { walletPrivateKey, walletPublicKey };
};

// Gets all of the ardrive IDs from a user's wallet
// Uses the Entity type to only search for Drive tags
const getAllMyPublicArDriveIds = async (walletPublicKey: any) => {
  try {
    const arDriveIds = new Array(1000);
    let x = 0;

    const query = {
      query: `query {
      transactions(
        first: 1000
        sort: HEIGHT_ASC
        owners: ["${walletPublicKey}"]
        tags: [
          { name: "App-Name", values: "${appName}" }
          { name: "App-Version", values: "${appVersion}" }
          { name: "Entity-Type", values: "drive" }
        ]
      ) {
        edges {
          node {
            id
            tags {
              name
              value
            }
          }
        }
      }
    }`,
    };

    // Call the Arweave Graphql Endpoint
    const response = await arweave.api
      .request()
      // .post('http://arca.arweave.io/graphql', query);
      .post('https://arweave.dev/graphql', query);  // This must be updated to production when available
    const { data } = response.data;
    const { transactions } = data;
    const { edges } = transactions;

    // Iterate through each returned transaction and pull out the public drives
    await asyncForEach(edges, async (edge: any) => {
      const { node } = edge;
      const { tags } = node;
      let drivePrivacy : string = "";
      let driveId : string = "";

      // Iterate through each tag and pull out each drive ID as well the drives privacy status
      tags.forEach((tag: any) => {
        const key = tag.name;
        if ((key === 'Drive-Privacy') && (tag.value === 'private')) {
          drivePrivacy = 'private';
        }
        if (key === 'Drive-Id') {
          driveId = tag.value;
        }
      });
      if (drivePrivacy !== 'private') {
        arDriveIds[x] = driveId;
        x += 1;
      }
    });

    // Eliminate any duplicates
    const uniqueArDriveIds = arDriveIds.filter((item, i, ar) => ar.indexOf(item) === i);
    return uniqueArDriveIds;
  } catch (err) {
    return Promise.reject(err);
  }
};

// Gets all of the private ardrive IDs from a user's wallet
// Uses the Entity type to only search for Drive tags
// Only returns Private drives from graphql
const getAllMyPrivateArDriveIds = async (walletPublicKey: any) => {
  try {
    const arDriveIds = new Array(1000);
    let x = 0;

    const query = {
      query: `query {
      transactions(
        first: 1000
        sort: HEIGHT_ASC
        owners: ["${walletPublicKey}"]
        tags: [
          { name: "App-Name", values: "${appName}" }
          { name: "App-Version", values: "${appVersion}" }
          { name: "Entity-Type", values: "drive" }
          { name: "Drive-Privacy" values: "private" }
        ]
      ) {
        edges {
          node {
            id
            tags {
              name
              value
            }
          }
        }
      }
    }`,
    };

    // Call the Arweave Graphql Endpoint
    const response = await arweave.api
      .request()
      // .post('http://arca.arweave.io/graphql', query);
      .post('https://arweave.dev/graphql', query);
    const { data } = response.data;
    const { transactions } = data;
    const { edges } = transactions;

    // Iterate through each returned transaction and pull out the private drive IDs
    await asyncForEach(edges, async (edge: any) => {
      const { node } = edge;
      const { tags } = node;
      let driveId : string = "";

      // Iterate through each tag and pull out each drive ID as well the drives privacy status
      tags.forEach((tag: any) => {
        const key = tag.name;
        if (key === 'Drive-Id') {
          arDriveIds[x] = driveId;
        }
      });
      x += 1;
    });

    // Eliminate any duplicates
    const uniqueArDriveIds = arDriveIds.filter((item, i, ar) => ar.indexOf(item) === i);
    return uniqueArDriveIds;
  } catch (err) {
    return Promise.reject(err);
  }
};

// Gets all of the transactions from a user's wallet, filtered by owner and ardrive version.
const getAllMyDataFileTxs = async (walletPublicKey: any, arDriveId: any) => {
  try {
    const query = {
      query: `query {
      transactions(
        first: 50
        sort: HEIGHT_ASC
        owners: ["${walletPublicKey}"]
        tags: [
          { name: "App-Name", values: "${appName}" }
          { name: "App-Version", values: "${appVersion}" }
          { name: "Drive-Id", values: "${arDriveId}" }
        ]
      ) {
        edges {
          node {
            id
            block {
              id
              timestamp
              height
              previous
            }
            tags {
              name
              value
            }
          }
        }
      }
    }`,
    };
    const response = await arweave.api
      .request()
      // .post('http://arca.arweave.io/graphql', query);
      .post('https://arweave.dev/graphql', query);
    const { data } = response.data;
    const { transactions } = data;
    const { edges } = transactions;
    return edges;
  } catch (err) {
    // console.log(err);
    return Promise.reject(err);
  }
};

// Gets only the transaction information, with no data
const getTransaction = async (txid: string): Promise<any> => {
  try {
    const tx = await arweave.transactions.get(txid);
    return tx;
  } catch (err) {
    // console.error(err);
    return Promise.reject(err);
  }
};

// Gets only the data of a given ArDrive Data transaction
const getTransactionData = async (txid: string) => {
  try {
    const data = await arweave.transactions.getData(txid, { decode: true });
    return data;
  } catch (err) {
    console.log(err);
    return Promise.reject(err);
  }
};

// Gets only the JSON data of a given ArDrive MetaData transaction
const getTransactionMetaData = async (txid: string) => {
  try {
    const data = await arweave.transactions.getData(txid, { decode: true });
    return data;
  } catch (err) {
    console.log(err);
    return Promise.reject(err);
  }
};

// Get the latest status of a transaction
const getTransactionStatus = async (txid: string) => {
  try {
    const response = await arweave.transactions.getStatus(txid);
    return response.status;
  } catch (err) {
    // console.log(err);
    return 0;
  }
};

// Get the balance of an Arweave wallet
const getWalletBalance = async (walletPublicKey: string) => {
  try {
    let balance = await arweave.wallets.getBalance(walletPublicKey);
    balance = await arweave.ar.winstonToAr(balance);
    return balance;
  } catch (err) {
    console.log(err);
    return 0;
  }
};

// Creates an arweave transaction to upload file data (and no metadata) to arweave
// Saves the upload chunk of the object in case the upload has to be restarted
const createArDrivePublicDataTransaction = async (
  walletPrivateKey: string,
  filePath: string,
  contentType: string,
  id: any,
) : Promise<string> => {
  try {
    const fileToUpload = fs.readFileSync(filePath);
    const transaction = await arweave.createTransaction(
      { data: arweave.utils.concatBuffers([fileToUpload]) }, // How to replace this?
      JSON.parse(walletPrivateKey),
    );
    // Tag file
    transaction.addTag('Content-Type', contentType);

    // Sign file
    await arweave.transactions.sign(transaction, JSON.parse(walletPrivateKey));
    const uploader = await arweave.transactions.getUploader(transaction);
    await setFileUploaderObject(JSON.stringify(uploader), id)
    const fileToUpdate = {
      fileDataSyncStatus: '2',
      dataTxId: transaction.id,
      id,
    };
    // Update the queue since the file is now being uploaded
    await updateFileDataSyncStatus(fileToUpdate);
    while (!uploader.isComplete) {
      // eslint-disable-next-line no-await-in-loop
      await uploader.uploadChunk();
      await setFileUploaderObject(JSON.stringify(uploader), id)
      console.log(`${uploader.pctComplete}% complete, ${uploader.uploadedChunks}/${uploader.totalChunks}`);
    }
    console.log('SUCCESS %s was submitted with TX %s', filePath, transaction.id);
    return transaction.id;
  } catch (err) {
    console.log(err);
    return "Transaction failed";
  }
};

// Creates an arweave transaction to encrypt and upload file data (and no metadata) to arweave
const createArDrivePrivateDataTransaction = async (
  walletPrivateKey: string,
  filePath: string,
  contentType: string,
  id: any,
) => {
  try {
    const fileToUpload = fs.readFileSync(filePath);
    const transaction = await arweave.createTransaction(
      { data: arweave.utils.concatBuffers([fileToUpload]) },
      JSON.parse(walletPrivateKey),
    );
    // Tag file with Content-Type, Cipher and Cipher-IV
    transaction.addTag('Content-Type', contentType);
    transaction.addTag('Cipher', cipher);
    // transaction.addTag('Cipher-IV', cipherIV)

    // Sign file
    await arweave.transactions.sign(transaction, JSON.parse(walletPrivateKey));
    const uploader = await arweave.transactions.getUploader(transaction);
    const fileToUpdate = {
      fileDataSyncStatus: '2',
      dataTxId: transaction.id,
      id,
    };
    // Update the queue since the file is now being uploaded
    await updateFileDataSyncStatus(fileToUpdate);
    while (!uploader.isComplete) {
      // eslint-disable-next-line no-await-in-loop
      await uploader.uploadChunk();
      console.log(`${uploader.pctComplete}% complete, ${uploader.uploadedChunks}/${uploader.totalChunks}`);
    }
    console.log('SUCCESS %s was submitted with TX %s', filePath, transaction.id);
    return transaction.id;
  } catch (err) {
    console.log(err);
    return 0;
  }
};

// Creates an arweave transaction to upload file data (and no metadata) to arweave
// OLD AND WILL BE DELETED
const createArDriveDataTransaction = async (
  walletPrivateKey: string,
  filePath: string,
  contentType: string,
  id: any,
) => {
  try {
    const fileToUpload = fs.readFileSync(filePath);
    const transaction = await arweave.createTransaction(
      { data: arweave.utils.concatBuffers([fileToUpload]) },
      JSON.parse(walletPrivateKey),
    );
    // Tag file
    transaction.addTag('Content-Type', contentType);

    // Sign file
    await arweave.transactions.sign(transaction, JSON.parse(walletPrivateKey));
    const uploader = await arweave.transactions.getUploader(transaction);
    const fileToUpdate = {
      fileDataSyncStatus: '2',
      dataTxId: transaction.id,
      id,
    };
    // Update the queue since the file is now being uploaded
    await updateFileDataSyncStatus(fileToUpdate);
    while (!uploader.isComplete) {
      // eslint-disable-next-line no-await-in-loop
      await uploader.uploadChunk();
      console.log(`${uploader.pctComplete}% complete, ${uploader.uploadedChunks}/${uploader.totalChunks}`);
    }
    console.log('SUCCESS %s was submitted with TX %s', filePath, transaction.id);
    return transaction.id;
  } catch (err) {
    console.log(err);
    return "Error submitting TX";
  }
};

// Creates an arweave transaction to upload only file metadata to arweave
// OLD AND WILL BE DELETED
const createArDriveMetaDataTransaction = async (
  user: { jwk: string; owner: string },
  primaryFileMetaDataTags: {
    appName: any;
    appVersion: any;
    unixTime: any;
    contentType: any;
    entityType: any;
    arDriveId: any;
    parentFolderId: any;
    fileId: any;
  },
  secondaryFileMetaDataJSON: any,
  filePath: any,
  id: any,
) => {
  try {
    const transaction = await arweave.createTransaction({ data: secondaryFileMetaDataJSON }, JSON.parse(user.jwk));
    const txSize = transaction.get('data_size');
    const winston = await getWinston(txSize);
    const arPrice = +winston * 0.000000000001;
    console.log('Uploading %s (%d bytes) at %s to the Permaweb', filePath, txSize, arPrice);

    // Tag file
    transaction.addTag('App-Name', primaryFileMetaDataTags.appName);
    transaction.addTag('App-Version', primaryFileMetaDataTags.appVersion);
    transaction.addTag('Unix-Time', primaryFileMetaDataTags.unixTime);
    transaction.addTag('Content-Type', primaryFileMetaDataTags.contentType);
    transaction.addTag('Entity-Type', primaryFileMetaDataTags.entityType);
    transaction.addTag('Drive-Id', primaryFileMetaDataTags.arDriveId);
    transaction.addTag('Parent-Folder-Id', primaryFileMetaDataTags.parentFolderId);
    transaction.addTag('File-Id', primaryFileMetaDataTags.fileId);

    // Sign file
    await arweave.transactions.sign(transaction, JSON.parse(user.jwk));
    const uploader = await arweave.transactions.getUploader(transaction);
    const fileMetaDataToUpdate = {
      id,
      fileMetaDataSyncStatus: '2',
      metaDataTxId: transaction.id,
    };
    // Update the queue since the file metadata is now being uploaded
    await updateFileMetaDataSyncStatus(fileMetaDataToUpdate);
    while (!uploader.isComplete) {
      // eslint-disable-next-line no-await-in-loop
      await uploader.uploadChunk();
    }
    console.log('SUCCESS %s metadata was submitted with TX %s', filePath, transaction.id);
    return arPrice;
  } catch (err) {
    console.log(err);
    return 0;
  }
};

// Creates an arweave transaction to upload only file metadata to arweave
const createArDrivePublicMetaDataTransaction = async (
  walletPrivateKey: string,
  fileToUpload: FileToUpload,
  secondaryFileMetaDataJSON: any,
) => {
  try {
    const transaction = await arweave.createTransaction({ data: secondaryFileMetaDataJSON }, JSON.parse(walletPrivateKey));
    const txSize = transaction.get('data_size');
    const winston = await getWinston(txSize);
    const arPrice = +winston * 0.000000000001;
    console.log('Uploading %s (%d bytes) at %s to the Permaweb', fileToUpload.fileName, txSize, arPrice);

    // Tag file
    transaction.addTag('App-Name', appName);
    transaction.addTag('App-Version', appVersion);
    transaction.addTag('Unix-Time', fileToUpload.unixTime);
    transaction.addTag('Content-Type', 'application/json');
    transaction.addTag('Entity-Type', fileToUpload.entityType);
    transaction.addTag('Drive-Id', fileToUpload.arDriveId);
    transaction.addTag('Parent-Folder-Id', fileToUpload.parentFolderId);
    transaction.addTag('File-Id', fileToUpload.fileId);

    // Sign file
    await arweave.transactions.sign(transaction, JSON.parse(walletPrivateKey));
    const uploader = await arweave.transactions.getUploader(transaction);
    const fileMetaDataToUpdate = {
      id: fileToUpload.id,
      fileMetaDataSyncStatus: '2',
      metaDataTxId: transaction.id,
    };
    // Update the queue since the file metadata is now being uploaded
    await updateFileMetaDataSyncStatus(fileMetaDataToUpdate);
    while (!uploader.isComplete) {
      // eslint-disable-next-line no-await-in-loop
      await uploader.uploadChunk();
    }
    console.log('SUCCESS %s metadata was submitted with TX %s', fileToUpload.filePath, transaction.id);
    return arPrice;
  } catch (err) {
    console.log(err);
    return 0;
  }
};

// Creates an arweave transaction to encrypt and upload only file metadata to arweave
const createArDrivePrivateMetaDataTransaction = async (
  user: { jwk: string; owner: string },
  primaryFileMetaDataTags: {
    appName: any;
    appVersion: any;
    unixTime: any;
    contentType: any;
    entityType: any;
    arDriveId: any;
    parentFolderId: any;
    fileId: any;
  },
  secondaryFileMetaDataJSON: any,
  filePath: any,
  id: any,
) => {
  try {
    const transaction = await arweave.createTransaction({ data: secondaryFileMetaDataJSON }, JSON.parse(user.jwk));
    const txSize = transaction.get('data_size');
    const winston = await getWinston(txSize);
    const arPrice = +winston * 0.000000000001;
    console.log('Uploading %s (%d bytes) at %s to the Permaweb', filePath, txSize, arPrice);

    // Tag file
    transaction.addTag('App-Name', primaryFileMetaDataTags.appName);
    transaction.addTag('App-Version', primaryFileMetaDataTags.appVersion);
    transaction.addTag('Unix-Time', primaryFileMetaDataTags.unixTime);
    transaction.addTag('Content-Type', primaryFileMetaDataTags.contentType);
    transaction.addTag('Entity-Type', primaryFileMetaDataTags.entityType);
    transaction.addTag('Drive-Id', primaryFileMetaDataTags.arDriveId);
    transaction.addTag('Parent-Folder-Id', primaryFileMetaDataTags.parentFolderId);
    transaction.addTag('File-Id', primaryFileMetaDataTags.fileId);

    // Sign file
    await arweave.transactions.sign(transaction, JSON.parse(user.jwk));
    const uploader = await arweave.transactions.getUploader(transaction);
    const fileMetaDataToUpdate = {
      id,
      fileMetaDataSyncStatus: '2',
      metaDataTxId: transaction.id,
    };
    // Update the queue since the file metadata is now being uploaded
    await updateFileMetaDataSyncStatus(fileMetaDataToUpdate);
    while (!uploader.isComplete) {
      // eslint-disable-next-line no-await-in-loop
      await uploader.uploadChunk();
    }
    console.log('SUCCESS %s metadata was submitted with TX %s', filePath, transaction.id);
    return arPrice;
  } catch (err) {
    console.log(err);
    return 0;
  }
};

// Creates an arweave transaction to upload public ardrive metadata
const createPublicArDriveTransaction = async (
  walletPrivateKey: string,
  id: string,
) : Promise<number> => {
  try {

    // Create a JSON file, containing necessary drive metadata
    const driveInfo = await getDriveInfoFromSyncTable(id);
    const arDriveMetadataJSON = {
      rootFolderId: driveInfo.fileId,
    }
    const arDriveMetaData = JSON.stringify(arDriveMetadataJSON);

    // Create transaction
    const transaction = await arweave.createTransaction({ data: arDriveMetaData }, JSON.parse(walletPrivateKey));
    const txSize = transaction.get('data_size');
    const winston = await getWinston(txSize);
    const arPrice = +winston * 0.000000000001;
    console.log('Uploading Public ArDrive Metadata (%d bytes) at %s to the Permaweb', txSize, arPrice);

    // Tag file
    transaction.addTag('App-Name', appName);
    transaction.addTag('App-Version', appVersion);
    transaction.addTag('Unix-Time', (Math.round(new Date().getTime() / 1000)).toString());
    transaction.addTag('Content-Type', 'application/json');
    transaction.addTag('Entity-Type', "drive");
    transaction.addTag('Drive-Id', driveInfo.arDriveId);

    // Sign file
    await arweave.transactions.sign(transaction, JSON.parse(walletPrivateKey));
    const uploader = await arweave.transactions.getUploader(transaction);

    const fileMetaDataToUpdate = {
      id,
      fileMetaDataSyncStatus: '2',
      metaDataTxId: transaction.id,
    };

    // Update the Sync Table record for the default /Public/ ArDrive since the metadata is now being uploaded
    await updateFileMetaDataSyncStatus(fileMetaDataToUpdate);

    // Update the Profile table to include the default /Public/ ArDrive
    await updateUserPublicArDriveTx(transaction.id, driveInfo.arDriveId)

    while (!uploader.isComplete) {
      // eslint-disable-next-line no-await-in-loop
      await uploader.uploadChunk();
    }
    console.log('SUCCESS Public ArDrive metadata was submitted with TX %s', transaction.id);
    return arPrice;
  } catch (err) {
    console.log(err);
    return 0;
  }
};

// Creates an arweave transaction to upload encrypted private ardrive metadata
const createPrivateArDriveTransaction = async (
  walletPrivateKey: JWKInterface,
  id: string,
) : Promise<number> => {
  try {
    const driveInfo = await getDriveInfoFromSyncTable(id);
    // Create a JSON file, containing necessary drive metadata
    const arDriveMetadataJSON = {
      rootFolderId: driveInfo.fileId,
    }

    const arDriveMetaData = JSON.stringify(arDriveMetadataJSON);

    // Create transaction
    const transaction = await arweave.createTransaction({ data: arDriveMetaData }, walletPrivateKey);
    const txSize = transaction.get('data_size');
    const winston = await getWinston(txSize);
    const arPrice = +winston * 0.000000000001;
    // console.log('Uploading Public ArDrive Metadata (%d bytes) at %s to the Permaweb', txSize, arPrice);

    // Tag file
    transaction.addTag('App-Name', appName);
    transaction.addTag('App-Version', appVersion);
    transaction.addTag('Unix-Time', (Math.round(new Date().getTime() / 1000)).toString());
    transaction.addTag('Content-Type', 'application/json');
    transaction.addTag('Entity-Type', "drive");
    transaction.addTag('Drive-Id', driveInfo.arDriveId);

    // Sign file
    await arweave.transactions.sign(transaction, walletPrivateKey);
    const uploader = await arweave.transactions.getUploader(transaction);

    const fileMetaDataToUpdate = {
      id,
      fileMetaDataSyncStatus: '2',
      metaDataTxId: transaction.id,
    };

    // Update the queue since the file metadata is now being uploaded
    await updateFileMetaDataSyncStatus(fileMetaDataToUpdate);
    while (!uploader.isComplete) {
      // eslint-disable-next-line no-await-in-loop
      await uploader.uploadChunk();
    }
    // console.log('SUCCESS Public ArDrive metadata was submitted with TX %s', transaction.id);
    return arPrice;
  } catch (err) {
    console.log(err);
    return 0;
  }
};

// Create a wallet and return the key and address
const createArDriveWallet = async (): Promise<Wallet> => {
  try {
    const wallet = await generateWallet();
    // TODO: logging is useless we need to store this somewhere.  It is stored in the database - Phil
    console.log('SUCCESS! Your new wallet public address is %s', wallet.walletPublicKey);
    return wallet;
  } catch (err) {
    console.error('Cannot create Wallet');
    console.error(err);
    return Promise.reject(err);
  }
};

// Sends a fee (15% of transaction price) to ArDrive Profit Sharing Community holders
const sendArDriveFee = async (walletPrivateKey: string, arPrice: number) => {
  try {
    await community.setCommunityTx(communityTxId);
    // Fee for all data submitted to ArDrive is 15%
    let fee = arPrice * 0.15;

    if (fee < 0.00001) {
      fee = 0.00001;
    }

    // Probabilistically select the PST token holder
    const holder = await community.selectWeightedHolder();

    // send a fee. You should inform the user about this fee and amount.
    const transaction = await arweave.createTransaction(
      { target: holder, quantity: arweave.ar.arToWinston(fee.toString()) },
      JSON.parse(walletPrivateKey),
    );

    // Sign file
    await arweave.transactions.sign(transaction, JSON.parse(walletPrivateKey));

    // Submit the transaction
    const response = await arweave.transactions.post(transaction);
    if (response.status === 200 || response.status === 202) {
      console.log('SUCCESS ArDrive fee of %s was submitted with TX %s', fee.toFixed(9), transaction.id);
    } else {
      console.log('ERROR submitting ArDrive fee with TX %s', transaction.id);
    }
    return transaction.id;
  } catch (err) {
    console.log(err);
    return 'ERROR sending ArDrive fee';
  }
};

export {
  getAddressForWallet,
  sendArDriveFee,
  createArDriveWallet,
  createArDriveMetaDataTransaction,
  createArDrivePublicMetaDataTransaction,
  createArDrivePrivateMetaDataTransaction,
  createArDriveDataTransaction,
  createArDrivePrivateDataTransaction,
  createArDrivePublicDataTransaction,
  createPublicArDriveTransaction,
  createPrivateArDriveTransaction,
  getWalletBalance,
  getTransactionStatus,
  getTransactionMetaData,
  getTransactionData,
  getTransaction,
  getAllMyDataFileTxs,
  getAllMyPrivateArDriveIds,
  getAllMyPublicArDriveIds,
  getLocalWallet,
  generateWallet,
};

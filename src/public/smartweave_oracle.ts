import { ContractOracle } from './contract_oracle';
import { readContract } from 'smartweave';
import { arweave } from './arweave';
import { communityTxId } from '../constants';

export interface CommunityContractData {
	votes: [Record<string, unknown>];
	settings: [string, unknown][];
}
export class SmartWeaveContractOracle implements ContractOracle {
	async readContract(txId: string, blockHeight?: number): Promise<CommunityContractData> {
		return readContract(arweave, txId, blockHeight);
	}

	/* Grabs last vote from block height of community vote setting the community fee value */
	getTipSettingFromContractVotes(contract: CommunityContractData): number {
		const arDriveCommTipFromVotes = contract.votes[contract.votes.length - 1].value;

		if (!arDriveCommTipFromVotes) {
			throw new Error('Fee does not exist on the smart contract community fee vote');
		}

		if (typeof arDriveCommTipFromVotes !== 'number') {
			throw new Error('Fee on smart contract community fee vote is not a number');
		}

		return arDriveCommTipFromVotes;
	}

	/* Grabs fee directly from the settings at the bottom of the contract */
	getTipSettingFromContractSettings(contract: CommunityContractData): number {
		const arDriveCommTipFromSettings = contract.settings.find((setting) => setting[0] === 'fee');

		if (!arDriveCommTipFromSettings) {
			throw new Error('Fee does not exist on smart contract settings');
		}

		if (typeof arDriveCommTipFromSettings[1] !== 'number') {
			throw new Error('Fee on smart contract settings is not a number');
		}

		return arDriveCommTipFromSettings[1];
	}

	/**
	 * Gets community tip setting from the ArDrive SmartWeave contract
	 *
	 * If a block height is provided, it will read the contract at that height
	 * and derive the value from the last vote on that version of the SmartWeave
	 * contract. Otherwise, it will read the full length of the contract (currently 35-50 seconds)
	 *
	 * @example
	 * ```ts
	 * await new SmartWeaveContractOracle().getCommunityTipSetting(communityTipBlockHeight)
	 * ```
	 */
	async getCommunityTipSetting(height?: number): Promise<number> {
		const contract = await this.readContract(communityTxId, height);

		if (height) {
			return this.getTipSettingFromContractVotes(contract);
		} else {
			return this.getTipSettingFromContractSettings(contract);
		}
	}
}

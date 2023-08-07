import { DataItem } from 'arbundles';
import axios from 'axios';

interface TurboParams {
	turboUrl: URL;
	isDryRun: boolean;
}

export interface TurboCachesResponse {
	dataCaches?: string[];
	fastFinalityIndexes?: string[];
}

export interface SendDataItemsResponse extends TurboCachesResponse {
	id: string;
	owner: string;
}

export class Turbo {
	private turboUrl: URL;
	private isDryRun: boolean;

	constructor({ turboUrl, isDryRun }: TurboParams) {
		this.turboUrl = turboUrl;
		this.isDryRun = isDryRun;
	}

	private get dataItemEndpoint(): string {
		return `${this.turboUrl.href}v1/tx`;
	}

	async sendDataItem(dataItem: DataItem): Promise<SendDataItemsResponse> {
		if (this.isDryRun) {
			return {
				id: dataItem.id,
				owner: dataItem.owner
			};
		}
		const { data } = await axios.post<SendDataItemsResponse>(this.dataItemEndpoint, dataItem.getRaw(), {
			headers: {
				'Content-Type': 'application/octet-stream'
			},
			maxBodyLength: Infinity,
			validateStatus: (status) => (status > 200 && status < 300) || status !== 402
		});
		return data;
	}
}

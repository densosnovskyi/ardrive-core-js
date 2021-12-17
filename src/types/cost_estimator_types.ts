import { FeeMultiple, Winston, RewardSettings } from '.';
import {
	ArFSDriveMetaDataPrototype,
	ArFSFileMetaDataPrototype,
	ArFSFolderMetaDataPrototype
} from '../arfs/arfs_prototypes';
import { ArFSTagSettings } from '../arfs/arfs_tag_settings';
import { CommunityOracle } from '../community/community_oracle';
import { ARDataPriceEstimator } from '../pricing/ar_data_price_estimator';
import { ByteCount } from './byte_count';
import { GQLTagInterface } from './gql_Types';

export interface ArFSUploadPlannerConstructorParams {
	priceEstimator: ARDataPriceEstimator;
	arFSTagSettings: ArFSTagSettings;
	communityOracle: CommunityOracle;
	feeMultiple?: FeeMultiple;
	shouldBundle?: boolean;
}

export interface EstimateCreateDriveParams {
	rootFolderMetaDataPrototype: ArFSFolderMetaDataPrototype;
	driveMetaDataPrototype: ArFSDriveMetaDataPrototype;
}

export interface EstimateUploadFileParams {
	fileMetaDataPrototype: ArFSFileMetaDataPrototype;
	fileDataSize: ByteCount;
	contentTypeTag: GQLTagInterface;
}

export interface EstimateResult<T> {
	totalWinstonPrice: Winston;
	rewardSettings: T;
	// TODO: Add Bundle Plan { numOfBundles: number , ... }
}

export interface EstimateUploadResult<T> extends EstimateResult<T> {
	communityWinstonTip: Winston;
}

export interface BundleRewardSettings {
	bundleRewardSettings: RewardSettings;
}

export function isBundleRewardSetting(
	rewardSettings: BundleRewardSettings | unknown
): rewardSettings is BundleRewardSettings {
	return Object.keys(rewardSettings as BundleRewardSettings).includes('bundleRewardSettings');
}

export interface CreateDriveV2TxRewardSettings {
	rootFolderRewardSettings: RewardSettings;
	driveRewardSettings: RewardSettings;
}
export type CreateDriveRewardSettings = CreateDriveV2TxRewardSettings | BundleRewardSettings;

export interface UploadFileV2TxRewardSettings {
	dataTxRewardSettings: RewardSettings;
	metaDataRewardSettings: RewardSettings;
}
export type UploadFileRewardSettings = UploadFileV2TxRewardSettings | BundleRewardSettings;

export type EstimateCreateDriveResult = EstimateResult<CreateDriveRewardSettings>;

export type EstimateUploadFileResult = EstimateUploadResult<UploadFileRewardSettings>;

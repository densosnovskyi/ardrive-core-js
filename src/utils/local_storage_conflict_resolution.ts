import { stat, Stats } from 'fs';
import { promisify } from 'util';
import { ArFSPrivateFile, ArFSPublicFile } from '../arfs/arfs_entities';
import { FileNameConflictResolution, replaceOnConflicts, upsertOnConflicts } from '../types';

const statPromise = promisify(stat);

export async function proceedWritingFile(
	destinationPath: string,
	remoteFile: ArFSPrivateFile | ArFSPublicFile,
	conflictResolutionStrategy: FileNameConflictResolution
): Promise<boolean> {
	const remoteFileLastModifiedDate = Math.ceil(+remoteFile.lastModifiedDate / 1000);
	return await statPromise(destinationPath)
		.catch(() => {
			// file does not exist
			return true;
		})
		.then((value: Stats | boolean) => {
			if (typeof value === 'boolean') {
				// early return the same boolean value that came from catch()
				return value;
			}
			const fileStat = value;
			// file exist with the same name...
			if (fileStat.isDirectory()) {
				if ([upsertOnConflicts, replaceOnConflicts].includes(conflictResolutionStrategy)) {
					throw new Error(`Cannot override the directory "${destinationPath}" with a file!`);
				}
				return false;
			}
			const localFileLastModifiedDate = fileStat.mtime.getTime() / 1000;
			if (localFileLastModifiedDate === remoteFileLastModifiedDate) {
				// ... and has the same last-modified-date
				if (conflictResolutionStrategy === replaceOnConflicts) {
					return true;
				}
				return false;
			} else {
				// ... but the last-modified-dates differ
				if ([upsertOnConflicts, replaceOnConflicts].includes(conflictResolutionStrategy)) {
					return true;
				}
				return false;
			}
		});
}

export async function proceedWritingFolder(
	destinationPath: string,
	conflictResolutionStrategy: FileNameConflictResolution
): Promise<boolean> {
	return await statPromise(destinationPath)
		.catch(() => {
			// directory does not exist
			return true;
		})
		.then((value: Stats | boolean) => {
			// file exist with the same name...
			if (typeof value === 'boolean') {
				// early return the same boolean value that came from catch()
				return value;
			}
			const fileStat = value;
			if (fileStat.isDirectory()) {
				// ... and is an actual directory
				return false;
			} else {
				// ... but is not a directory
				if ([upsertOnConflicts, replaceOnConflicts].includes(conflictResolutionStrategy)) {
					throw new Error(`Cannot override the file "${destinationPath}" with a folder!`);
				}
				return false;
			}
		});
}

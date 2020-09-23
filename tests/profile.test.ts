import { getLocalWallet } from '../src/arweave';
import { setupDatabase, getUserIdFromProfile } from '../src/db';
import { getUser, addNewUser, setupArDriveSyncFolder} from '../src/profile';
import { ArDriveUser } from '../src/types';

async function main() {
    // Setup database if it doesnt exist
    try {
        await setupDatabase('./.ardrive-test.db');
    } catch (err) {
        console.error(err);
        return;
    }

    // Sample user profile
    const wallet = await getLocalWallet("C:\\Stuff\\ardrive_test_key.json")
    const loginPassword: string = "dudeworduppasword"
    const testUser: ArDriveUser = {
        login: "Vilenarios",
        privateArDriveId: "d87da4e4-76f9-4872-9a14-94e10ba73e1d",
        privateArDriveTx: "FsrovoXaV7U-IMfJOAr1Fiv8iXwTwJTdL9lSUDr2WQg",
        publicArDriveId: "81a73abd-2aff-4989-9b57-4e7fbf8ce825",
        publicArDriveTx: "sjZV344k9BxPw1xjI1meZgCjm73tM5Ac86uN5Pwtxog",
        dataProtectionKey: "aSUPERstr0ngZOOM1023(",
        walletPrivateKey: wallet.walletPrivateKey,
        walletPublicKey: wallet.walletPublicKey,
        syncFolderPath: "C:\\ArDriveSyncFolder_Test\\"
      };

    // Testing Sync Folder Creation
    console.log ("Testing setupArDriveSyncFolder using %s", testUser.syncFolderPath);
    console.log ("Sync Folder Setup Results: %s", await setupArDriveSyncFolder(testUser.syncFolderPath));

    // Testing Setting New User Profile
    console.log ("Set New User results are: %s", await addNewUser(loginPassword, testUser))

    // Testing Getting Existing User Profile
    const userId = await getUserIdFromProfile(testUser.login)
    console.log ("User Id is %s", userId.id)
    const newUser = await getUser(loginPassword, userId.id)
    console.log ("Get User Profile results are")
    console.log (newUser);
}
main();
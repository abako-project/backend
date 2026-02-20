import { createClient } from 'polkadot-api';
import { getWsProvider } from 'polkadot-api/ws-provider/node';
import { local } from '@polkadot-api/descriptors';
import { Keyring } from '@polkadot/keyring';
import { getPolkadotSigner } from '@polkadot-api/signer';
import { cryptoWaitReady } from '@polkadot/util-crypto';

async function main() {
    await cryptoWaitReady();
    console.log('🚀 Funding LP (Bob)...');

    const providerUrl = process.env.PROVIDER_URL || 'ws://zombienet:21000';
    const client = createClient(getWsProvider(providerUrl));
    const api = client.getTypedApi(local);

    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');
    const bob = keyring.addFromUri('//Bob');

    console.log(`Alice: ${alice.address}`);
    console.log(`Bob: ${bob.address}`);

    const aliceSigner = getPolkadotSigner(alice.publicKey, 'Sr25519', (input) => alice.sign(input));

    // Check Bob's balance
    const bobAccount = await api.query.Assets.Account.getValue(
        { type: 'Here', value: 1 },
        bob.address
    );

    const currentBalance = bobAccount ? bobAccount.balance : 0n;
    console.log(`Bob Current Asset 1 Balance: ${currentBalance}`);

    if (currentBalance < 100000n) {
        console.log('💰 Transferring 100,000 Asset 1 from Alice to Bob...');
        await new Promise<void>((resolve, reject) => {
            api.tx.Assets.transfer({
                id: { type: 'Here', value: 1 },
                target: { type: 'Id', value: bob.address },
                amount: 100000000000n
            })
                .signSubmitAndWatch(aliceSigner)
                .subscribe({
                    next: (event) => {
                        console.log(`Tx Status: ${event.type}`);
                        if (event.type === 'finalized') resolve();
                    },
                    error: (err) => reject(err)
                });
        });
        console.log('✅ Funding Complete.');
    } else {
        console.log('✅ Bob already has sufficient funds.');
    }

    client.destroy();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

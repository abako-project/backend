import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient, TypedApi } from 'polkadot-api';
import { getWsProvider } from 'polkadot-api/ws-provider/node';
import { local } from '@polkadot-api/descriptors';

@Injectable()
export class PapiService implements OnModuleInit, OnModuleDestroy {
    public client: ReturnType<typeof createClient>;
    public api: TypedApi<typeof local>;
    private readonly providerUrl: string;

    constructor() {
        this.providerUrl = process.env.PROVIDER_URL || 'ws://localhost:21000';
    }

    async onModuleInit() {
        this.client = createClient(
            getWsProvider({
                endpoints: [this.providerUrl],
                heartbeatTimeout: 300000,
            })
        );
        this.api = this.client.getTypedApi(local);
        console.log(`PAPI Client Connected to ${this.providerUrl}`);
    }

    async onModuleDestroy() {
        this.client.destroy();
    }
}

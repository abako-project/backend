import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { Binary, createClient } from 'polkadot-api'
import { withPolkadotSdkCompat } from 'polkadot-api/polkadot-sdk-compat'
import { getWsProvider } from 'polkadot-api/ws-provider/node'
import { createInkV5Sdk, createReviveSdk } from '@polkadot-api/sdk-ink'
import { contracts, kreivo } from '@polkadot-api/descriptors'
import { alicePolkadotSigner, alicePublicAddress } from './util/signer'

export interface DeployConfig {
  inkVersion: '5' | '6'
  contractType: string
  wasmPath: string
}

export type DeployParams = Record<string, any> // Generic params for any contract

export interface DeployResult {
  success: boolean
  address?: string
  encodedData?: string
  inkVersion: string
  contractType: string
  transactionHash?: string
  blockHash?: string
  blockNumber?: number
  error?: string
}

export class DeployService {
  private client: any
  private typedApi: any

  constructor() {
    this.client = createClient(
      withPolkadotSdkCompat(getWsProvider(process.env.KREIVO_PROVIDER || "ws://localhost:21000"))
    )
    this.typedApi = this.client.getTypedApi(kreivo)
  }

  private getAppId(contractType: string): number {
    const envVarMap: Record<string, string> = {
      'calendar': 'CALENDAR_APP_ID',
      'ratings': 'RATINGS_APP_ID',
      'projects': 'PROJECTS_APP_ID'
    }
    
    const envVarName = envVarMap[contractType] || 'PROJECTS_APP_ID'
    const appId = process.env[envVarName]
    
    if (!appId) {
      throw new Error(`${envVarName} environment variable is not set`)
    }
    
    const parsedAppId = Number(appId)
    if (isNaN(parsedAppId)) {
      throw new Error(`${envVarName} environment variable must be a valid number, got: ${appId}`)
    }
    
    return parsedAppId
  }

  private getSdk(inkVersion: '5' | '6', contractType: string = 'projects') {
    if (inkVersion === '6') {
      return createReviveSdk(this.typedApi, contracts.projects_v6)
    } else {
      if (contractType === 'calendar') {
        return createInkV5Sdk(this.typedApi, contracts.calendar_v5)
      } else if (contractType === 'ratings') {
        return createInkV5Sdk(this.typedApi, contracts.ratings_v5)
      }
      return createInkV5Sdk(this.typedApi, contracts.projects_v5)
    }
  }

  private loadWasmFile(wasmPath: string): Binary {
    const wasmBuffer = fs.readFileSync(wasmPath)
    return Binary.fromBytes(new Uint8Array(wasmBuffer))
  }

  private generateSalt(): Binary {
    return Binary.fromHex(crypto.randomBytes(32).toString("hex"))
  }

  private buildConstructorData(config: DeployConfig, params: DeployParams): any {
    if (config.contractType === 'projects') {
      if (config.inkVersion === '6') {
        return {
          name: params.name,
          dao_address: Binary.fromHex(params.dao_address),
          calendar_contract: params.calendar_contract ? Binary.fromHex(params.calendar_contract) : undefined,
          ratings_contract: params.ratings_contract ? Binary.fromHex(params.ratings_contract) : undefined
        }
      } else {
        return {
          name: params.name,
          dao_address: params.dao_address,
          calendar_contract: params.calendar_contract || undefined,
          ratings_contract: params.ratings_contract || undefined
        }
      }
    }
    
    if (config.contractType === 'calendar') {
      return {
        ratings_contract: params.ratings_contract || undefined
      }
    }
    
    // ratings contract has no constructor params
    if (config.contractType === 'ratings') {
      return {}
    }
    
    return params
  }

  async deployContract(config: DeployConfig, params: DeployParams = {}): Promise<DeployResult> {
    try {
      console.log(`Starting deployment with ink v${config.inkVersion}`)
      console.log(`Contract type: ${config.contractType}`)
      console.log(`Constructor params:`, params)

      const sdk = this.getSdk(config.inkVersion, config.contractType)
      const wasmBytes = this.loadWasmFile(config.wasmPath)
      const deployer = sdk.getDeployer(wasmBytes)
      const salt = this.generateSalt()

      const constructorData = this.buildConstructorData(config, params)
      console.log("Constructor data:", constructorData)
      
      const appId = this.getAppId(config.contractType)
      console.log(`Using APP_ID: ${appId} for contract type: ${config.contractType}`)

      let instantiateData: Binary

      const tx = deployer.deploy("new", {
        data: constructorData,
        origin: alicePublicAddress,
        options: { salt }
      })
      
      const txDecodedCall = await tx.decodedCall
      console.log("Tx decoded call", txDecodedCall)
      instantiateData = txDecodedCall.value.value.data

      console.log("Has constructor data", txDecodedCall.value.value.data)

      const license = await this.typedApi.tx.ContractsStore.request_license({
        app_id: appId,
      })

      const licenseResult = await new Promise((resolve, reject) => {
        license.signSubmitAndWatch(alicePolkadotSigner)
          .subscribe({
            next: (event: any) => {
              console.info('License transaction event:', event);
              if (event.type === 'txBestBlocksState') {
                resolve({ ok: true, txHash: event.txHash, blockHash: event.found, events: event.events });
              }
            },
            error: (error: any) => {
              console.error('License transaction error:', error);
              reject(error);
            }
          });
      });

      const licenseResponse = licenseResult as { ok: boolean; txHash: string; blockHash: string; events: any[] };
      const contractsStoreEvent = licenseResponse.events.find((event: any) => event.type === 'ContractsStore')
      let licenseId = contractsStoreEvent?.value?.value?.license_id
      
      if (licenseId === undefined || licenseId === null) {
        licenseId = contractsStoreEvent?.value?.license_id || 
                   contractsStoreEvent?.license_id
        if (licenseId !== undefined && licenseId !== null) {
          console.log("License ID found via alternative path:", licenseId)
        } else {
          console.error("Full contractsStoreEvent:", contractsStoreEvent)
          throw new Error("License ID not found in ContractsStore event")
        }
      }
      
      console.log("License ID:", licenseId)

      const encodedLicense = await license.getEncodedData()
      console.log("Encoded License", encodedLicense.asHex())

      const instantiate = this.typedApi.tx.ContractsStore.instantiate({
        app_id: appId,
        license_id: licenseId,
        value: 0n,
        data: instantiateData,
        salt: salt,
      })
      const encoded = await instantiate.getEncodedData()
      console.log("Encoded instantiate", encoded.asHex())

      const encodedBatch = await instantiate.signAndSubmit(alicePolkadotSigner)

      console.log(encodedBatch)
      
      const contractEvent = encodedBatch.events.find((event: any) => event.type === 'Contracts')
      console.log(contractEvent)
      const contractAddress = contractEvent?.value?.value?.contract

      if (!contractAddress) {
        throw new Error("Contract address not found, deploy failed")
      }
      
      console.log("Contract Address:", contractAddress)
      console.log("Transaction created successfully")

      return {
        success: true,
        address: contractAddress,
        inkVersion: config.inkVersion,
        contractType: config.contractType
      }
    } catch (error) {
      console.error(`Error deploying contract with ink v${config.inkVersion}:`, error)
      return {
        success: false,
        inkVersion: config.inkVersion,
        contractType: config.contractType,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  getDeployConfigs() {
    return {
      v6: {
        inkVersion: '6' as const,
        contractType: 'projects',
        wasmPath: './contracts/v6/projects/projects.polkavm',
      },
      v5: {
        inkVersion: '5' as const,
        contractType: 'projects',
        wasmPath: path.resolve(process.cwd(), 'contracts/v5/projects/projects.wasm'),
      },
      calendar_v5: {
        inkVersion: '5' as const,
        contractType: 'calendar',
        wasmPath: path.resolve(process.cwd(), 'contracts/v5/calendar/calendar.wasm'),
      },
      ratings_v5: {
        inkVersion: '5' as const,
        contractType: 'ratings',
        wasmPath: path.resolve(process.cwd(), 'contracts/v5/ratings/ratings.wasm'),
      }
    }
  }
}

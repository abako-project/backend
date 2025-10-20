import { contracts, kreivo, pop } from "@polkadot-api/descriptors"
import { createInkV5Sdk } from "@polkadot-api/sdk-ink"
import { createClient, Binary } from "polkadot-api"
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat"
import { getWsProvider } from "polkadot-api/ws-provider/node"
import { ADDRESS } from "./util/address"
import contractMetadata from '../.papi/contracts/projects_v5.json'
import { polkadotSigner, publicAddress } from "./util/signer"

export class ProjectsService {
  private client: any
  private typedApi: any
  private projectsSdk: any
  private contracts: Map<string, any> = new Map()
  private availableMethods: string[]

  constructor() {
    this.availableMethods = contractMetadata.spec.messages.map((message: any) => message.label)
    console.log("Available methods", this.availableMethods)
  }

  async initialize() {
    this.client = createClient(
      withPolkadotSdkCompat(getWsProvider(process.env.KREIVO_PROVIDER || "ws://localhost:21000")),
    )
    this.typedApi = this.client.getTypedApi(kreivo)
    this.projectsSdk = createInkV5Sdk(this.typedApi, contracts.projects_v5)

    console.log("ProjectsService initialized")
    
    return this
  }

  private getContract(contractAddress: string) {
    if (!this.contracts.has(contractAddress)) {
      const contract = this.projectsSdk.getContract(contractAddress)
      this.contracts.set(contractAddress, contract)
    }
    return this.contracts.get(contractAddress)
  }

  getAvailableMethods(): string[] {
    return this.availableMethods
  }

  getAvailableConstructors(): string[] {
    return contractMetadata.spec.constructors.map((constructor: any) => constructor.label)
  }

  validateMethod(methodName: string): boolean {
    return this.availableMethods.includes(methodName)
  }

  validateConstructor(constructorName: string): boolean {
    return this.getAvailableConstructors().includes(constructorName)
  }

  private serializeBigInt(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj
    }
    
    if (typeof obj === 'bigint') {
      return obj.toString()
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.serializeBigInt(item))
    }
    
    if (typeof obj === 'object') {
      const serialized: any = {}
      for (const [key, value] of Object.entries(obj)) {
        serialized[key] = this.serializeBigInt(value)
      }
      return serialized
    }
    
    return obj
  }

  async queryMethod(contractAddress: string, methodName: string, data: any = {}) {
    if (!this.validateMethod(methodName)) {
      throw new Error(`Method "${methodName}" not found in contract. Available methods: ${this.availableMethods.join(", ")}`)
    }

    console.log(`Querying method: ${methodName} on contract: ${contractAddress}`)
    console.log(data)

    try {
      const contract = this.getContract(contractAddress)
      const response = await contract.query(methodName as any, {
        origin: publicAddress,
        data: data,
      })

      console.log(response)

      const serializedResponse = response.success ? this.serializeBigInt(response.value.response) : null

      return {
        success: response.success,
        method: methodName,
        contractAddress: contractAddress,
        response: serializedResponse,
      }
    } catch (error) {
      console.error(`Error querying method ${methodName} on contract ${contractAddress}:`, error)
      throw new Error(`Failed to query method ${methodName} on contract ${contractAddress}: ${error}`)
    }
  }

  async callMethod(contractAddress: string, methodName: string, data: any = {}) {
    if (!this.validateMethod(methodName)) {
      throw new Error(`Method "${methodName}" not found in contract. Available methods: ${this.availableMethods.join(", ")}`)
    }

    console.log(`Calling method: ${methodName} on contract: ${contractAddress}`)

    console.log("Data:", data)

    // Methods that only return encodedData to be signed by the user
    const encodedDataMethods = [
      'approve_scope',
      'complete_task',
      'mark_completed',
      'set_calendar_contract',
      'assign_team',
      'propose_scope'
    ]

    try {
      const contract = this.getContract(contractAddress)

      const { caller, ...rest } = data;

      console.log("Caller:", caller)
      console.log("Rest:", rest)

      if (encodedDataMethods.includes(methodName)) {
        const tx = await contract.send(methodName as any, {
          origin: caller || publicAddress,
          data: rest.data || rest,
          gas_limit: {
            ref_time: 10000000000n,
            proof_size: 1000000n
          },
          storage_deposit_limit: 100000000000n,
        })

        const encodedData = await tx.getEncodedData()
        return {
          method: methodName,
          encodedData: encodedData.asHex(),
        }
      }

      // Normal flow for other methods
      const tx = await contract.send(methodName as any, {
        origin: publicAddress,
        data: data,
      })

      console.log(`Signing and submitting method: ${methodName}`)
      const result = await tx.signAndSubmit(polkadotSigner)

      return {
        method: methodName,
        success: result.ok,
        transactionHash: result.txHash,
        blockHash: result.block?.hash,
        blockNumber: result.block?.number,
      }
    } catch (error) {
      console.error(`Error calling method ${methodName} on contract ${contractAddress}:`, error)
      throw new Error(`Failed to call method ${methodName} on contract ${contractAddress}: ${error}`)
    }
  }

  async destroy() {
    if (this.client) {
      this.client.destroy()
      console.log("ProjectsService client destroyed")
    }
  }
}

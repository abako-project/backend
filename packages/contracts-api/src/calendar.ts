import { contracts, kreivo } from "@polkadot-api/descriptors"
import { createInkV5Sdk } from "@polkadot-api/sdk-ink"
import { createClient, Binary } from "polkadot-api"
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat"
import { getWsProvider } from "polkadot-api/ws-provider/node"
import { ADDRESS } from "./util/address"
import contractMetadata from '../.papi/contracts/calendar_v5.json'
import { publicAddress, polkadotSigner } from "./util/signer"

export class CalendarService {
  private client: any
  private typedApi: any
  private calendarSdk: any
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
    this.calendarSdk = createInkV5Sdk(this.typedApi, contracts.calendar_v5)

    console.log("CalendarService initialized")

    return this
  }

  private getContract(contractAddress: string) {
    if (!this.contracts.has(contractAddress)) {
      const contract = this.calendarSdk.getContract(contractAddress)
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
    console.log({data})

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

    try {
      const contract = this.getContract(contractAddress)

      const { caller, ...rest } = data;

      console.log("Caller:", caller)
      console.log("Rest:", rest)

      const tx = methodName === 'set_availability' ?
        await contract.send("set_availability", {
          origin: caller,
          data: { 
            availability: { type: "PartTime", value: undefined } 
          },
          gas_limit: {
            ref_time: 10000000000n,
            proof_size: 1000000n
          },
          storage_deposit_limit: 100000000000n,
        })
        : await contract.send(methodName as any, { 
          origin: publicAddress, 
          data: rest.data 
        });

      if (methodName === 'set_availability') {
        const encodedData = await tx.getEncodedData()
        return {
          method: methodName,
          encodedData: encodedData.asHex(),
        }
      }

      const callData = await tx.decodedCall
      const callDataHex = callData.value.value.data.asHex()

      console.log("Data to send:", callDataHex)
      console.log("Gas limit:", callData.value.value.gas_limit)

      const dispatchTx = this.typedApi.tx.Communities.dispatch_as_account({
        call: {
          type: "Contracts",
          value: {
            type: "call",
            value: {
              dest: {
                type: "Id",
                value: contractAddress
              },
              value: 0n,
              gas_limit: {
                ref_time: 10000000000n,  
                proof_size: 1000000n
              },
              storage_deposit_limit: 100000000000n, 
              data: Binary.fromHex(callDataHex)
            }
          }
        }
      })

      console.log(`Signing and submitting method: ${methodName}`)
      const result = await dispatchTx.signAndSubmit(polkadotSigner)

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
      console.log("CalendarService client destroyed")
    }
  }
}


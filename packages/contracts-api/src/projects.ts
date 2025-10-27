import { contracts, kreivo, pop } from "@polkadot-api/descriptors"
import { createInkV5Sdk } from "@polkadot-api/sdk-ink"
import { createClient, Binary } from "polkadot-api"
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat"
import { getWsProvider } from "polkadot-api/ws-provider/node"
import { ADDRESS } from "./util/address"
import contractMetadata from '../.papi/contracts/projects_v5.json'
import { alicePolkadotSigner, alicePublicAddress, charliePolkadotSigner, charliePublicAddress } from "./util/signer"

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

  private convertNumbersToBigInt(data: any, methodName: string): any {
    console.log(`[convertNumbersToBigInt] Method: ${methodName}`)
    console.log(`[convertNumbersToBigInt] Input data:`, data)

    // For propose_scope, we need to convert the task costs (u128) to BigInt and dependencies to Binary
    if (methodName === 'propose_scope' && data.tasks) {
      const convertedData = {
        ...data,
        tasks: data.tasks.map((task: any, index: number) => {
          // task is [id, complexity, cost, dependencies]
          if (Array.isArray(task) && task.length >= 4) {
            const [id, complexity, cost, dependencies] = task

            // Keep complexity as-is (should be { type: 'Days', value: 5 } format)
            console.log(`[convertNumbersToBigInt] Task ${index}: complexity =`, complexity)

            // Convert cost to BigInt
            const costType = typeof cost
            const convertedCost = typeof cost === 'number' || typeof cost === 'string' ? BigInt(cost) : cost
            console.log(`[convertNumbersToBigInt] Task ${index}: cost=${cost} (${costType}) -> ${convertedCost}n`)

            // Convert dependencies to Binary
            let convertedDependencies
            if (Array.isArray(dependencies)) {
              // Convert array of numbers to Uint8Array
              convertedDependencies = Binary.fromBytes(new Uint8Array(dependencies))
              console.log(`[convertNumbersToBigInt] Task ${index}: dependencies array converted to Binary`)
            } else if (dependencies instanceof Uint8Array) {
              convertedDependencies = Binary.fromBytes(dependencies)
              console.log(`[convertNumbersToBigInt] Task ${index}: dependencies Uint8Array converted to Binary`)
            } else {
              // Assume it's already Binary or similar
              convertedDependencies = dependencies
              console.log(`[convertNumbersToBigInt] Task ${index}: dependencies kept as-is`)
            }

            console.log(`[convertNumbersToBigInt] Task ${index}: convertedCost =`, convertedCost)

            return [
              id,
              complexity,
              convertedCost,
              convertedDependencies
            ]
          }
          return task
        })
      }

      // Convert document_hash from hex string to Binary
      if (data.document_hash && typeof data.document_hash === 'string') {
        console.log(`[convertNumbersToBigInt] Converting document_hash from string to Binary`)
        console.log(`[convertNumbersToBigInt] Original hash: ${data.document_hash}`)

        // Use Binary.fromHex to convert the hex string to Binary type
        const hexString = data.document_hash.startsWith('0x')
          ? data.document_hash
          : `0x${data.document_hash}`

        convertedData.document_hash = Binary.fromHex(hexString)

        console.log(`[convertNumbersToBigInt] Converted hash to Binary: ${hexString}`)
      }

      console.log(`[convertNumbersToBigInt] Output data:`, convertedData)

      return convertedData
    }

    // For approve_scope, convert approved_task_ids array to Binary
    if (methodName === 'approve_scope' && data.approved_task_ids) {
      const convertedData = { ...data }

      if (Array.isArray(data.approved_task_ids)) {
        console.log(`[convertNumbersToBigInt] Converting approved_task_ids array to Binary`)
        convertedData.approved_task_ids = Binary.fromBytes(new Uint8Array(data.approved_task_ids))
        console.log(`[convertNumbersToBigInt] Converted approved_task_ids:`, convertedData.approved_task_ids)
      } else if (data.approved_task_ids instanceof Uint8Array) {
        console.log(`[convertNumbersToBigInt] Converting approved_task_ids Uint8Array to Binary`)
        convertedData.approved_task_ids = Binary.fromBytes(data.approved_task_ids)
      } else {
        console.log(`[convertNumbersToBigInt] approved_task_ids kept as-is`)
      }

      return convertedData
    }

    console.log(`[convertNumbersToBigInt] No conversion needed, returning original data`)
    return data
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
        origin: alicePublicAddress,
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
      'assign_team',
      'set_calendar_contract',
      'propose_scope',
    ]

    try {
      const contract = this.getContract(contractAddress)

      const { caller, ...rest } = data;

      console.log(`[callMethod] ========== START ${methodName} ==========`)
      console.log(`[callMethod] Caller:`, caller)
      console.log(`[callMethod] Rest data:`, rest)

      if (encodedDataMethods.includes(methodName)) {
        console.log(`[callMethod] Method ${methodName} is in encodedDataMethods list`)

        // Convert numbers to BigInt for methods that need it
        let contractData = rest.data || rest
        console.log(`[callMethod] Initial contract data:`, contractData)

        if (methodName === 'propose_scope' || methodName === 'approve_scope') {
          console.log(`[callMethod] Starting data conversion for ${methodName}`)
          contractData = this.convertNumbersToBigInt(contractData, methodName)
          console.log(`[callMethod] Final contract data after conversion:`, contractData)
        }

        console.log(`[callMethod] Preparing to send transaction to contract`)
        const tx = await contract.send(methodName as any, {
          origin: caller || alicePublicAddress,
          data: contractData,
          gas_limit: {
            ref_time: 10000000000n,
            proof_size: 1000000n
          },
          storage_deposit_limit: 100000000000n,
        })

        console.log(`[callMethod] Transaction prepared successfully`)

        const callData = await tx.decodedCall
        const callDataHex = callData.value.value.data.asHex()

        console.log(`[callMethod] Decoded call data (hex):`, callDataHex)
        console.log(`[callMethod] Gas limit:`, callData.value.value.gas_limit)

        console.log(`[callMethod] Creating encoded transaction for Contracts.call`)
        const encodedDataTx = this.typedApi.tx.Contracts.call({
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
        })

        const encodedData = await encodedDataTx.getEncodedData()
        console.log(`[callMethod] Final encoded data (hex):`, encodedData.asHex())
        console.log(`[callMethod] ========== END ${methodName} SUCCESS ==========`)

        return {
          method: methodName,
          encodedData: encodedData.asHex(),
        }
      }

      let contractData = rest.data || rest
      if (methodName === 'approve_scope' || methodName === 'complete_task' || methodName === 'mark_completed') {
        try {
          let dataToSend;
          // const dataToSend = methodName === 'approve_scope' ? {
          //   approved_task_ids: Binary.fromBytes(new Uint8Array([1]))
          // } : contractData

          if (methodName === 'approve_scope') {
            dataToSend = {
              approved_task_ids: Binary.fromBytes(contractData.approved_task_ids)
            }
          } else if (methodName === 'complete_task') {
            dataToSend = contractData
          } else if (methodName === 'mark_completed') {
            dataToSend = {
              ratings: contractData.ratings
            }
          }

          console.log(`[callMethod] Preparing to send transaction to contract`)
          const tx = await contract.send(methodName as any, {
            origin: caller || alicePublicAddress,
            data: dataToSend,
            gas_limit: {
              ref_time: 10000000000n,
              proof_size: 1000000n
            },
            storage_deposit_limit: 100000000000n,
          })

          console.log(`[callMethod] Transaction prepared successfully`)

          const callData = await tx.decodedCall
          const callDataHex = callData.value.value.data.asHex()

          console.log(`[callMethod] Decoded call data (hex):`, callDataHex)
          console.log(`[callMethod] Gas limit:`, callData.value.value.gas_limit)

          console.log(`[callMethod] Creating encoded transaction for Contracts.call`)
          const encodedDataTx = this.typedApi.tx.Communities.dispatch_as_account({
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

          const result = await encodedDataTx.signAndSubmit(alicePolkadotSigner);
          console.log('Result:', result);

          return {
            method: methodName,
            success: result.ok,
            transactionHash: result.txHash,
            blockHash: result.blockHash,
            blockNumber: result.blockNumber,
            dispatchError: result.dispatchError,
          }
        } catch (error) {
          return {
            method: methodName,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }

      // Normal flow for other methods
      const tx = await contract.send(methodName as any, {
        origin: alicePublicAddress,
        data: data,
      })

      console.log(`Signing and submitting method: ${methodName}`)

      const result = await tx.signAndSubmit(alicePolkadotSigner);

      return {
        method: methodName,
        success: result.ok,
        transactionHash: result.txHash,
        blockHash: result.blockHash,
        blockNumber: result.blockNumber,
      }
    } catch (error) {
      console.error(`[callMethod] ========== END ${methodName} ERROR ==========`)
      console.error(`[callMethod] Error:`, error)
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

import {
  
  Agent,
  WsOutboundTransport,
  HttpOutboundTransport,
  
  
  DidExchangeState,
  AutoAcceptCredential,
  CredentialEventTypes,
  CredentialState,
  
  OutOfBandRecord,
} from '@aries-framework/core'
import { agentDependencies, HttpInboundTransport } from '@aries-framework/node'
import ConnectionEventTypes from '@aries-framework/core'
import ConnectionStateChangedEvent from '@aries-framework/core'
import InitConfig from '@aries-framework/core'
import CredentialStateChangedEvent from '@aries-framework/core'

import Schema  from 'indy-sdk'
import fetch from 'node-fetch'

const getGenesisTransaction = async (url) => {
  const response = await fetch(url)

  return await response.text()
}


const initializeHolderAgent = async () => {
  const genesisTransactionsBCovrinTestNet = await getGenesisTransaction('http://test.bcovrin.vonx.io/genesis')
  console.log(`genesisTransactionsBCovrinTestNet holder= ${genesisTransactionsBCovrinTestNet}`)
  // Simple agent configuration. This sets some basic fields like the wallet
  // configuration and the label. It also sets the mediator invitation url,
  // because this is most likely required in a mobile environment.
  const config = {
    label: 'demo-agent-holder',
    walletConfig: {
      id: 'demo-agent-holder',
      key: 'demoagentholder00000000000000000',
    },
    indyLedgers: [
      {
        id: 'bcovrin-test-net',
        isProduction: false,
        indyNamespace: 'bcovrin:test',
        genesisTransactions: genesisTransactionsBCovrinTestNet,
      },
    ],
    autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
    autoAcceptConnections: true,
    endpoints: ['http://localhost:3002'],
  }

  // A new instance of an agent is created here
  const agent = new Agent({ config, dependencies: agentDependencies })

  // Register a simple `WebSocket` outbound transport
  agent.registerOutboundTransport(new WsOutboundTransport())

  // Register a simple `Http` outbound transport
  agent.registerOutboundTransport(new HttpOutboundTransport())

  // Register a simple `Http` inbound transport
  agent.registerInboundTransport(new HttpInboundTransport({ port: 3002 }))

  // Initialize the agent
  await agent.initialize()

  return agent
}

const initializeIssuerAgent = async () => {
  const genesisTransactionsBCovrinTestNet = await getGenesisTransaction('http://test.bcovrin.vonx.io/genesis')
  console.log(`genesisTransactionsBCovrinTestNet issuer= ${genesisTransactionsBCovrinTestNet}`)
  // Simple agent configuration. This sets some basic fields like the wallet
  // configuration and the label.
  const config= {
    label: 'demo-agent-issuer',
    walletConfig: {
      id: 'demo-agent-issuer',
      key: 'demoagentissuer00000000000000000',
    },
    publicDidSeed: 'demoissuerdidseed000000000000000',
    indyLedgers: [
      {
        id: 'bcovrin-test-net',
        isProduction: false,
        indyNamespace: 'bcovrin:test',
        genesisTransactions: genesisTransactionsBCovrinTestNet,
      },
    ],
    autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
    autoAcceptConnections: true,
    endpoints: ['http://localhost:3001'],
  }

  // A new instance of an agent is created here
  const agent = new Agent({ config, dependencies: agentDependencies })

  // Register a simple `WebSocket` outbound transport
  agent.registerOutboundTransport(new WsOutboundTransport())

  // Register a simple `Http` outbound transport
  agent.registerOutboundTransport(new HttpOutboundTransport())

  // Register a simple `Http` inbound transport
  agent.registerInboundTransport(new HttpInboundTransport({ port: 3001 }))

  // Initialize the agent
  await agent.initialize()

  return agent
}

const registerSchema = async (issuer) =>
  issuer.ledger.registerSchema({ attributes: ['name', 'age'], name: 'Identity', version: '1.0' })


  const registerCredentialDefinition = async (issuer, schema) =>
  issuer.ledger.registerCredentialDefinition({ schema, supportRevocation: false, tag: 'default' })

  const setupCredentialListener = (holder) => {
    holder.events.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, async ({ payload }) => {
      switch (payload.credentialRecord.state) {
        case CredentialState.OfferReceived:
          console.log('received a credential')
          // custom logic here
          await holder.credentials.acceptOffer({ credentialRecordId: payload.credentialRecord.id })
        case CredentialState.Done:
          console.log(`Credential for credential id ${payload.credentialRecord.id} is accepted`)
          // For demo purposes we exit the program here.
          process.exit(0)
      }
    })
  }


  const issueCredential = async (issuer, credentialDefinitionId, connectionId) =>
  issuer.credentials.offerCredential({
    protocolVersion: 'v1',
    connectionId,
    credentialFormats: {
      indy: {
        credentialDefinitionId,
        attributes: [
          { name: 'name', value: 'Jane Doe' },
          { name: 'age', value: '23' },
        ],
      },
    },
  })


  const createNewInvitation = async (issuer) => {
    const outOfBandRecord = await issuer.oob.createInvitation()
  
    return {
      invitationUrl: outOfBandRecord.outOfBandInvitation.toUrl({ domain: 'https://example.org' }),
      outOfBandRecord,
    }
  }

  const receiveInvitation = async (holder, invitationUrl) => {
    console.log(`Functin entry receive invitaion`)
    const { outOfBandRecord } = await holder.oob.receiveInvitationFromUrl(invitationUrl)
    console.log(`Functin exit receive invitaion`)
    return outOfBandRecord
  }


const setupConnectionListener = (issuer, outOfBandRecord, cb) => {
  console.log(`Function entry setupConnectionListener`)
  issuer.events.on(
    ConnectionEventTypes.ConnectionStateChanged,
    async ({ payload }) => {
      console.log(`pay load= ${payload}`)
      if (payload.connectionRecord.outOfBandId !== outOfBandRecord.id) return
      if (payload.connectionRecord.state === DidExchangeState.Completed) {
        // the connection is now ready for usage in other protocols!
        console.log(
          `Connection for out-of-band id ${outOfBandRecord.id} completed`
        )

        // Custom business logic can be included here
        // In this example we can send a basic message to the connection, but
        // anything is possible
        console.log(`calling cb`)
        await cb(payload.connectionRecord.id)
        console.log(`calling cb finished`)
      }
    }
  )
}


  const flow = (issuer) => async (connectionId) => {
    console.log('Registering the schema...')
    const schema = await registerSchema(issuer)
    console.log('Registering the credential definition...')
    const credentialDefinition = await registerCredentialDefinition(issuer, schema)
    console.log('Issuing the credential...')
    await issueCredential(issuer, credentialDefinition.id, connectionId)
  }


  const run = async () => {
    console.log('Initializing the holder...')
    const holder = await initializeHolderAgent()
    console.log('Initializing the issuer...')
    const issuer = await initializeIssuerAgent()
  
    console.log('Initializing the credential listener...')
    setupCredentialListener(holder)
  
    console.log('Initializing the connection...')
    const { outOfBandRecord, invitationUrl } = await createNewInvitation(issuer)
    console.log('createNewInvitation the connection...')
    setupConnectionListener(issuer, outOfBandRecord, flow(issuer))
    console.log('setupConnectionListener the connection...')
    await receiveInvitation(holder, invitationUrl)
    console.log('await receiveInvitation the connection...')
  }
  
  void run()

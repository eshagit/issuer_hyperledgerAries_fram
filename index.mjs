import {getAgent} from "./agents.mjs"
import qrcode from "qrcode-terminal"
import {Agent} from "@aries-framework/core"
import ConnectionEventTypes from '@aries-framework/core'
import ConnectionStateChangedEvent from '@aries-framework/core'

const run = async() => {
    const agent = await getAgent("hyperledger-issuer-demo")
    const schema = await agent.ledger.registerSchema({
        attributes: ["name","age"],
        name: "hl-issuer-demo-schema17",
        version: "1.0"
    })

    const credentialDefinition = await agent.ledger.registerCredentialDefinition({
        schema,
        supportRevocation: false,
        tag: "default",
    })

    const {outofBandRecord,invitation} = await agent.oob.createLegacyInvitation()

    const url = invitation.toUrl({domain: "https://example.org"})
    

    qrcode.generate(url)

    const connectionListener = (agent,id) => {
        return new Promise((resolve)=>{
            agent.events.on<ConnectionStateChangedEvent>(ConnectionEventTypes.ConnectionStateChanged,({payload})=>{
                if(payload.connectionRecord.outofBandId !== id) return
                if(payload.connectionRecord.isReady){
                    resolve(payload.connectionRecord.id)
                }
            })

        })
    }

    //const connectionId = connectionListener(agent,outofBandRecord.id)
    const connectionId = await connectionListener(agent,'8bcf6141-3731-4bd3-be4b-dfc07e5c191d')

    await agent.credentials.offerCredential({
        connectionId,
        protocolVersion: "v1",
        credentialFormats: {
            indy: {
                credentialDefinitionId: credentialDefinition.id,
                attributes: [
                    {name: "name", value: "Berend"},
                    {name: "age", value: "23"},
                ]
            }
        }

    })

    
}

void run()
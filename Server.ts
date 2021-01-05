import { Collection } from "discord.js";
import { DEDICATED_COMPRESSOR_3KB, SHARED_COMPRESSOR, SSLApp } from "uWebSockets.js";

import { IMessageTypeEnum, IBotMessage, IMessagePayload } from "../DiscordBotJS/src/Interfaces";

import { DiscordBotJS } from "../DiscordBotJS/ProtoOutput/compiled";
import { performance } from "perf_hooks";

const ChannelIDRegex = /(id) (\w{16,20})/
const RegexIsMessage = /message/

const BotIPV6Adress = new Set<string>(['0000:0000:0000:0000:0000:ffff:1284:278e'])


SSLApp({
	cert_file_name: "/etc/letsencrypt/live/patrykstyla.com/fullchain.pem",
	key_file_name: "/etc/letsencrypt/live/patrykstyla.com/privkey.pem",
}).ws('/*', {
	idleTimeout: 30,
	maxBackpressure: 1024 * 1024,
	maxPayloadLength: 5012,
	compression: SHARED_COMPRESSOR,

	upgrade: (res, req, context) => { 
		res.upgrade({
			url: req.getUrl()
		},
			req.getHeader('sec-websocket-key'),
			req.getHeader('sec-websocket-protocol'),
			req.getHeader('sec-websocket-extensions'),
			context
		)
	},
	open: (ws) => {
		if (BotIPV6Adress.has(Buffer.from(ws.getRemoteAddressAsText()).toString())) {
			// console.log(ctx.blueBright("Bot connected"))
			console.log("bot connected")

			// This client is our bot
			ws.bot = true;
		}
	},
	message: (ws, message, isBinary) => {
		// Keep alive messages. Ignore	
		console.log('MEssage lengh', message.byteLength)
		if(!message.byteLength){
			return
		}
		const DecMessage = Buffer.from(message).toString()
		if (ws.bot) {
			if (isBinary) {
				const binaryPerf = performance.now()
				// Binary messages
				const ff = Buffer.from(message)
				console.log(ff)
				const decodedMessage = DiscordBotJS.BotResponse.decode(ff)
				console.log(decodedMessage)
				ws.publish(decodedMessage.guild_id!, message, true)
				console.log("Binary", performance.now() - binaryPerf)
			} else {
				// JSON Messages
				const jsonPerf = performance.now()
				const JsonMessage = JSON.parse(DecMessage) as IBotMessage

				if ((JsonMessage.p as IMessagePayload).channel_id) {
					ws.publish((JsonMessage.p as IMessagePayload).guild_id, message)
					console.log("JSON", performance.now() - jsonPerf)
				}
			}
			
		} else {
			const [, id, guild_id] = ChannelIDRegex.exec(DecMessage) || ['', '', '']
			// INDEX 0: whole string, 1: 'id', 2: id string
			if (guild_id) {
				ws.subscribe(guild_id);
			}
		}

		// ws.send((ws as any).uuid)
		// console.log(`Message: ${enc.decode(message)}`);
	},
	drain: (ws) => {
		console.log('WebSocket backpressure: ' + ws.getBufferedAmount());
	},
	close: (ws, code, message) => {
	},
}).listen(9001, (listenSocket) => {
	if (listenSocket) {
		console.log('Listening to port 9001');
	}
})

function reviver(key, value) {
	if(typeof value === 'object' && value !== null) {
	  if (value.dataType === 'Collection') {
		return new Collection(value.value);
	  } else if (value.dataType === 'map') {
		return new Map(value.value);
	  }
	}
	return value;
}
# Pulse Alexa Custom Skill

The Alexa endpoint is hosted by the local Pulse MCP process.

1. Start the aggregator backend and run `npm run dev:mcp`.
2. Expose `http://127.0.0.1:4011/alexa` through a public HTTPS endpoint.
3. In the Alexa Developer Console, create a Custom Skill named `Pulse`.
4. Import `alexa/interaction-model.json` into the JSON editor and build the model.
5. Set the skill endpoint to the public HTTPS URL ending in `/alexa`.
6. Set `PULSE_ALEXA_SKILL_ID` to the skill ID before starting MCP.

Alexa request signature and timestamp verification are enabled by default. Set
`PULSE_ALEXA_VERIFY_SIGNATURE=0` only for local automated tests.

Example: `Alexa, ask Pulse show all devices`.
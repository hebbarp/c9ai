"use strict";
/**
 * Generic provider interface used by the agent router.
 * Implement this via a thin shim over your existing local/cloud providers.
 */
module.exports.ChatProvider = {};
// JSDoc typing (CommonJS friendly)
/**
 * @typedef {{ role: "system"|"user"|"assistant", content: string }} Msg
 * @typedef {{ name: string, description: string, schema: object }} ToolSpec
 * @typedef {Object} ProviderCallOpts
 * @property {string} model
 * @property {Msg[]} messages
 * @property {number} [temperature]
 * @property {number} [top_p]
 * @property {number} [max_tokens]
 * @property {string} [grammar]
 * @property {ToolSpec[]} [tools]
 * @property {(chunk:string)=>void} [onToken]
 */
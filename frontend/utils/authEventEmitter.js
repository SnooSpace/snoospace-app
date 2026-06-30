import EventEmitter from "eventemitter3";

const authEventEmitter = new EventEmitter();
authEventEmitter._traceId = 'auth-emitter-singleton-' + Math.random().toString(36).slice(2);

export default authEventEmitter;

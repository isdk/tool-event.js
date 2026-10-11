// No global EventSource install: `eventsource` is a peer dependency and is
// environment-agnostic, so `SseClientPubSubTransport` imports it directly and
// tests that need the class import it themselves.

// can not use the `--no-file-parallelism` to test
// ERR_DLOPEN_FAILED
// Module did not self-register: '~/node_modules/.pnpm/onnxruntime-node@1.14.0/node_modules/onnxruntime-node/bin/napi-v3/linux/x64/onnxruntime_binding.node'.
// import './test/transformers'

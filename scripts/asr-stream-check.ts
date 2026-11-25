import { StreamASRClient } from '../lib/asrStream';
async function main() {
  const client = new StreamASRClient({
    url: 'ws://127.0.0.1:8761',
    lang: '中文',
    silenceMs: 900,
    handlers: {
      onReady: (m) => console.log('ready:', m),
      onPartial: (t) => console.log('partial:', t),
      onFinal: (t) => console.log('final:', t),
      onError: (m) => console.log('error:', m),
      onClose: (u) => console.log('close unexpected=', u),
    },
  });
  try {
    const mode = await client.connect(2500);
    console.log('connected mode =', mode);
    await new Promise((r) => setTimeout(r, 300));
  } catch (e: any) {
    console.error('FAILED', e.message);
    process.exitCode = 1;
  } finally {
    client.stop(100);
    setTimeout(() => process.exit(process.exitCode ?? 0), 500);
  }
}
void main();

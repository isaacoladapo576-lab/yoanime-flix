// Test VidSrc.to resolver with longer timeout and more aggressive clicking
const resolver = require('./resolver');

async function test() {
    console.log('Testing VidSrc.to resolver — please wait up to 35s...');
    const result = await resolver.resolve('VidSrc.to', '155', 'movie', '1', '1');
    console.log('Result:', JSON.stringify(result, null, 2));
}
test().catch(console.error);

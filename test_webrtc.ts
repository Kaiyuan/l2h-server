import * as datachannel from 'node-datachannel';
console.log('Testing node-datachannel...');
try {
    const pc = new datachannel.PeerConnection("test", { iceServers: [] });
    console.log('PC created');
    pc.close();
    console.log('PC closed');
} catch (e) {
    console.error('Error:', e);
}

const fetch = require('node-fetch');
async function test() {
    const resp = await fetch('http://localhost:52331/api/webrtc/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            api_key: 'oujxyexcqljq2drv6fh55m',
            type: 'offer',
            sdp: 'v=0\r\no=- 42 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00\r\na=group:BUNDLE 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\na=mid:0\r\na=setup:actpass\r\na=sctp-port:5000\r\n'
        })
    });
    console.log(await resp.json());
}
test();

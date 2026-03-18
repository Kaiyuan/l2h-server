import * as datachannel from 'node-datachannel';

class WebRTCManager {
    // Map API Key or a unique session ID to PeerConnection
    private connections = new Map<string, datachannel.PeerConnection>();
    private dataChannels = new Map<string, datachannel.DataChannel>();
    private pendingRequests = new Map<string, (response: any) => void>();

    addConnection(id: string, pc: datachannel.PeerConnection) {
        this.connections.set(id, pc);
        pc.onDataChannel((dc) => {
            console.log(`DataChannel opened for session ${id}`);
            this.handleDataChannel(id, dc);
        });
    }

    private handleDataChannel(sessionId: string, dc: datachannel.DataChannel) {
        this.dataChannels.set(sessionId, dc);
        dc.onMessage((msg) => {
            try {
                const data = JSON.parse(msg.toString());
                if (data.requestId && this.pendingRequests.has(data.requestId)) {
                    const resolve = this.pendingRequests.get(data.requestId);
                    resolve!(data);
                    this.pendingRequests.delete(data.requestId);
                }
            } catch (e) {
                console.error('Failed to parse DC message:', e);
            }
        });
    }

    async sendRequest(sessionId: string, request: any): Promise<any> {
        const dc = this.dataChannels.get(sessionId);
        if (!dc) throw new Error('DataChannel not established for this session');

        const requestId = Math.random().toString(36).substring(7);
        request.requestId = requestId;

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, resolve);
            dc.sendMessage(JSON.stringify(request));
            
            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Gateway Timeout'));
                }
            }, 30000);
        });
    }

    // Temporary helper to get the first active session for testing
    // In production, we'd look up by the Path mapping's user_id or similar
    getFirstSessionId(): string | undefined {
        return this.connections.keys().next().value;
    }
}

export const webrtcManager = new WebRTCManager();

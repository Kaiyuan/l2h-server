// 定义通用接口，屏蔽 node-datachannel 和原生 WebRTC 的差异
interface IDataChannel {
    sendMessage(msg: string): void;
    onMessage(cb: (msg: any) => void): void;
    onClosed(cb: () => void): void;
}

interface IPeerConnection {
    close(): void;
    onDataChannel(cb: (dc: IDataChannel) => void): void;
    onStateChange(cb: (state: string) => void): void;
}

class WebRTCManager {
    private connections = new Map<string, IPeerConnection>();
    private dataChannels = new Map<string, IDataChannel>();
    private pendingRequests = new Map<string, (response: any) => void>();

    addConnection(apiKey: string, pc: any) {
        // 适配 node-datachannel 和 原生 RTCPeerConnection
        const icedPC: IPeerConnection = this.wrapPC(pc);
        
        const existing = this.connections.get(apiKey);
        if (existing) {
            try { existing.close(); } catch {}
        }
        this.connections.set(apiKey, icedPC);

        icedPC.onDataChannel((dc) => {
            console.log(`API Key 的 DataChannel 已打开: ${apiKey}`);
            this.handleDataChannel(apiKey, dc);
        });

        icedPC.onStateChange((state) => {
            console.log(`连接状态 [${apiKey}]: ${state}`);
            if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                this.connections.delete(apiKey);
                this.dataChannels.delete(apiKey);
            }
        });
    }

    private wrapPC(pc: any): IPeerConnection {
        // 如果是 node-datachannel 对象
        if (pc.onDataChannel && !pc.createDataChannel) {
            return {
                close: () => pc.close(),
                onDataChannel: (cb) => pc.onDataChannel((dc: any) => cb({
                    sendMessage: (msg) => dc.sendMessage(msg),
                    onMessage: (msgCb) => dc.onMessage(msgCb),
                    onClosed: (closeCb) => dc.onClosed(closeCb)
                })),
                onStateChange: (cb) => pc.onStateChange(cb)
            };
        }
        // 如果是标准 RTCPeerConnection (Cloudflare)
        return {
            close: () => pc.close(),
            onDataChannel: (cb) => {
                pc.ondatachannel = (ev: any) => {
                    const dc = ev.channel;
                    cb({
                        sendMessage: (msg) => dc.send(msg),
                        onMessage: (msgCb) => dc.onmessage = (e: any) => msgCb(e.data),
                        onClosed: (closeCb) => dc.onclose = closeCb
                    });
                };
            },
            onStateChange: (cb) => pc.onconnectionstatechange = () => cb(pc.connectionState)
        };
    }

    private handleDataChannel(apiKey: string, dc: IDataChannel) {
        this.dataChannels.set(apiKey, dc);
        dc.onMessage((msg) => {
            try {
                const data = JSON.parse(msg.toString());
                if (data.requestId && this.pendingRequests.has(data.requestId)) {
                    const resolve = this.pendingRequests.get(data.requestId)!;
                    resolve(data);
                    this.pendingRequests.delete(data.requestId);
                }
            } catch (e) {
                console.error('解析 DataChannel 消息失败:', e);
            }
        });
        dc.onClosed(() => {
            if (this.dataChannels.get(apiKey) === dc) {
                this.dataChannels.delete(apiKey);
            }
        });
    }

    async sendRequest(apiKey: string, request: any): Promise<any> {
        const dc = this.dataChannels.get(apiKey);
        if (!dc) throw new Error(`API Key 没有活跃的 DataChannel: ${apiKey}`);

        const requestId = Math.random().toString(36).substring(2, 9);
        request.requestId = requestId;

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, resolve);
            dc.sendMessage(JSON.stringify(request));

            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Gateway Timeout'));
                }
            }, 30000);
        });
    }

    getSessionByApiKey(apiKey: string): string | undefined {
        return this.dataChannels.has(apiKey) ? apiKey : undefined;
    }

    getActiveSessionCount(): number {
        return this.dataChannels.size;
    }
}

export const webrtcManager = new WebRTCManager();

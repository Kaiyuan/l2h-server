import * as datachannel from 'node-datachannel';

class WebRTCManager {
    // 映射: API Key -> PeerConnection
    private connections = new Map<string, datachannel.PeerConnection>();
    // 映射: API Key -> DataChannel
    private dataChannels = new Map<string, datachannel.DataChannel>();
    // 映射: requestId -> resolve 回调
    private pendingRequests = new Map<string, (response: any) => void>();

    addConnection(apiKey: string, pc: datachannel.PeerConnection) {
        // 清理过期的连接
        const existing = this.connections.get(apiKey);
        if (existing) {
            try { existing.close(); } catch {}
        }
        this.connections.set(apiKey, pc);

        pc.onDataChannel((dc) => {
            console.log(`API Key 的 DataChannel 已打开: ${apiKey}`);
            this.handleDataChannel(apiKey, dc);
        });

        pc.onStateChange((state) => {
            console.log(`连接状态 [${apiKey}]: ${state}`);
            if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                this.connections.delete(apiKey);
                this.dataChannels.delete(apiKey);
                console.log(`已移除 API Key 的会话: ${apiKey}`);
            }
        });
    }

    private handleDataChannel(apiKey: string, dc: datachannel.DataChannel) {
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
            console.log(`API Key 的 DataChannel 已关闭: ${apiKey}`);
            this.dataChannels.delete(apiKey);
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

            // 30 秒超时
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Gateway Timeout'));
                }
            }, 30000);
        });
    }

    /** 如果会话有已打开的 DataChannel，返回其 API Key */
    getSessionByApiKey(apiKey: string): string | undefined {
        return this.dataChannels.has(apiKey) ? apiKey : undefined;
    }

    /** 当前活跃（DataChannel 已就绪）的会话数量 */
    getActiveSessionCount(): number {
        return this.dataChannels.size;
    }

    /** 列出所有已连接的 API Key（用于统计） */
    getConnectedApiKeys(): string[] {
        return Array.from(this.dataChannels.keys());
    }

    /** @deprecated use getSessionByApiKey */
    getFirstSessionId(): string | undefined {
        return this.dataChannels.keys().next().value;
    }
}

export const webrtcManager = new WebRTCManager();

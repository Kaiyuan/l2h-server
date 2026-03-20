import * as datachannel from 'node-datachannel';
import db from './src/db/index.js';
import { webrtcManager } from './src/webrtc/manager.js';

async function setupTestData() {
    console.log('--- 正在设置测试数据 ---');
    try {
        db.prepare("DELETE FROM paths WHERE name LIKE 'test_%'").run();
        db.prepare("DELETE FROM users WHERE username LIKE 'test_user_%'").run();

        const userA = { username: 'test_user_a', password: 'password', api_key: 'key_a', role: 'user' };
        const userB = { username: 'test_user_b', password: 'password', api_key: 'key_b', role: 'user' };

        db.prepare('INSERT INTO users (username, password, api_key, role) VALUES (?, ?, ?, ?)').run(userA.username, userA.password, userA.api_key, userA.role);
        db.prepare('INSERT INTO users (username, password, api_key, role) VALUES (?, ?, ?, ?)').run(userB.username, userB.password, userB.api_key, userB.role);

        const idA = (db.prepare('SELECT id FROM users WHERE username = ?').get('test_user_a') as any).id;
        const idB = (db.prepare('SELECT id FROM users WHERE username = ?').get('test_user_b') as any).id;

        db.prepare('INSERT INTO paths (name, port, user_id) VALUES (?, ?, ?)').run('test_path_a', 8080, idA);
        db.prepare('INSERT INTO paths (name, port, user_id) VALUES (?, ?, ?)').run('test_path_b', 9090, idB);

        return { userA, userB };
    } catch (e: any) {
        console.error('设置失败:', e.message);
        throw e;
    }
}

async function runTest() {
    try {
        const { userA, userB } = await setupTestData();

        console.log('--- 正在连接模拟客户端 ---');
        
        const pcA = new datachannel.PeerConnection("client-a", { iceServers: [] });
        const pcB = new datachannel.PeerConnection("client-b", { iceServers: [] });

        const dcA = pcA.createDataChannel("data");
        const dcB = pcB.createDataChannel("data");

        // 手动触发 node-datachannel 的本地连接以“打开”通道
        // 在真实场景中，这发生在 SDP 交换之后。
        // 对于没有信令的纯本地测试，我们可能需要更复杂的设置
        // 或者直接完全模拟 DC 对象。
        
        // 实际上，node-datachannel 需要远程描述才能打开。
        // 让我们为管理器模拟 dc 对象，而不是使用真实的 libdatachannel pc。
        console.log('--- 正在为管理器模拟 DataChannel ---');
        
        const mockDCA = {
            sendMessage: (msg: string) => {
                const req = JSON.parse(msg);
                console.log(`[模拟 DC A] 收到请求: ${req.requestId}`);
                // 模拟异步响应
                setTimeout(() => {
                    const resolve = (webrtcManager as any).pendingRequests.get(req.requestId);
                    if (resolve) {
                        resolve({
                            requestId: req.requestId,
                            status: 200,
                            body: "Response from A"
                        });
                        (webrtcManager as any).pendingRequests.delete(req.requestId);
                    }
                }, 10);
            }
        };

        const mockDCB = {
            sendMessage: (msg: string) => {
                const req = JSON.parse(msg);
                console.log(`[模拟 DC B] 收到请求: ${req.requestId}`);
                setTimeout(() => {
                    const resolve = (webrtcManager as any).pendingRequests.get(req.requestId);
                    if (resolve) {
                        resolve({
                            requestId: req.requestId,
                            status: 200,
                            body: "Response from B"
                        });
                        (webrtcManager as any).pendingRequests.delete(req.requestId);
                    }
                }, 10);
            }
        };

        // 向管理器注入模拟对象
        (webrtcManager as any).dataChannels.set(userA.api_key, mockDCA);
        (webrtcManager as any).dataChannels.set(userB.api_key, mockDCB);

        console.log('活跃会话数：', webrtcManager.getActiveSessionCount());

        // 测试请求 A
        console.log('正在为用户 A 发送请求...');
        const respA = await webrtcManager.sendRequest(userA.api_key, { path: '/', targetPort: 8080 });
        console.log('响应 A:', respA.body);
        if (respA.body !== "Response from A") throw new Error("隔离失败：A 收到错误响应");

        // 测试请求 B
        console.log('正在为用户 B 发送请求...');
        const respB = await webrtcManager.sendRequest(userB.api_key, { path: '/', targetPort: 9090 });
        console.log('响应 B:', respB.body);
        if (respB.body !== "Response from B") throw new Error("隔离失败：B 收到错误响应");

        console.log('--- 成功：多用户隔离已验证 ---');
    } catch (e: any) {
        console.error('测试失败:', e.message);
    } finally {
        console.log('--- 清理 ---');
        try {
            db.prepare("DELETE FROM paths WHERE name LIKE 'test_%'").run();
            db.prepare("DELETE FROM users WHERE username LIKE 'test_user_%'").run();
        } catch (err) {
            console.error('清理失败:', err);
        }
        process.exit(0);
    }
}

runTest();

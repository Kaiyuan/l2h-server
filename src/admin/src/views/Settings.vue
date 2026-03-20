<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../utils/api';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Message from 'primevue/message';
import { Save, ShieldCheck, Copy, Lock } from 'lucide-vue-next';

const apiKey = ref('');
const adminPath = ref('dashboard');
const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const couponCode = ref('');
const message = ref({ text: '', severity: '' as 'success' | 'error' | 'info' | 'secondary' | 'warn' | undefined });

const fetchUser = async () => {
    try {
        const resp = await api.get('/api/user/me');
        apiKey.value = resp.data.api_key;
    } catch (e) {
        console.error('获取用户信息失败');
    }
};

const fetchSettings = async () => {
    try {
        const resp = await api.get('/admin-api/settings');
        if (resp.data.admin_path) adminPath.value = resp.data.admin_path;
    } catch (e) {
        console.error('获取设置失败');
    }
};

const saveSettings = async () => {
    loading.value = true;
    try {
        await api.post('/admin-api/settings', {
            admin_path: adminPath.value,
            // 根据需要添加更多
        });
        message.value = { text: '全局配置已保存', severity: 'success' };
    } catch (e) {
        message.value = { text: '保存失败', severity: 'error' };
    } finally {
        loading.value = false;
    }
};

const generateKey = async () => {
    if (!confirm('确定重新生成 API KEY 吗？旧的 KEY 将立即失效。')) return;
    try {
        const resp = await api.post('/api/user/api-key');
        apiKey.value = resp.data.api_key;
        message.value = { text: 'API KEY 已重新生成', severity: 'success' };
    } catch (e) {
        message.value = { text: '生成失败', severity: 'error' };
    }
};

const changePassword = async () => {
    if (newPassword.value !== confirmPassword.value) {
        message.value = { text: '两次输入的新密码不一致', severity: 'error' };
        return;
    }
    loading.value = true;
    try {
        await api.post('/api/user/update-password', {
            oldPassword: oldPassword.value,
            newPassword: newPassword.value
        });
        message.value = { text: '密码修改成功', severity: 'success' };
        oldPassword.value = '';
        newPassword.value = '';
        confirmPassword.value = '';
    } catch (e: any) {
        message.value = { text: e.response?.data?.error || '密码修改失败', severity: 'error' };
    } finally {
        loading.value = false;
    }
};

const copyKey = () => {
    navigator.clipboard.writeText(apiKey.value);
    message.value = { text: 'API KEY 已复制到剪贴板', severity: 'info' };
};

const handleRedeem = async () => {
    if (!couponCode.value) return;
    loading.value = true;
    try {
        const resp = await api.post('/api/user/redeem', { code: couponCode.value });
        message.value = { text: resp.data.message || '兑换成功', severity: 'success' };
        couponCode.value = '';
    } catch (e: any) {
        message.value = { text: e.response?.data?.error || '兑换失败', severity: 'error' };
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    fetchUser();
    fetchSettings();
});
</script>

<template>
  <div class="space-y-12">
    <div>
        <h1 class="text-4xl font-extrabold text-slate-100 tracking-tight mb-2">网站设置</h1>
        <p class="text-slate-400 text-lg font-medium">配置全局参数与安全策略</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <!-- Security Section -->
        <div class="bg-[#1e293b] border border-white/5 rounded-3xl p-10 glass space-y-8 flex flex-col justify-between">
            <div class="space-y-6">
                <div class="flex items-center gap-4 mb-4">
                    <div class="bg-blue-500/10 p-4 rounded-2xl text-blue-400"><ShieldCheck :size="24" /></div>
                    <h2 class="text-2xl font-black text-slate-100 tracking-tight">安全与授权</h2>
                </div>
                
                <div class="space-y-4">
                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-bold text-slate-400">管理后台路径 (ADMIN_PATH)</label>
                        <div class="flex gap-2">
                            <span class="bg-slate-800 text-slate-500 px-4 py-3 rounded-xl border border-white/5 font-mono text-xs flex items-center">/</span>
                            <InputText v-model="adminPath" class="flex-grow bg-slate-800 border-white/5 rounded-xl px-4 py-3 text-sm" />
                        </div>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-bold text-slate-400">客户端 API KEY</label>
                        <div class="flex gap-2">
                            <InputText v-model="apiKey" readonly class="flex-grow bg-slate-800 border-white/5 rounded-xl px-4 py-3 text-sm font-mono text-blue-400" />
                            <button @click="copyKey" class="p-3 rounded-xl bg-slate-700 hover:bg-slate-600 transition-all active:scale-95"><Copy :size="20" /></button>
                        </div>
                        <p class="text-xs text-slate-500 italic mt-1 font-medium">* 客户端连接服务端时需提供此密钥</p>
                    </div>
                </div>
            </div>

            <Button label="重新生成密钥" class="w-full py-4 rounded-xl font-bold bg-slate-700 hover:bg-slate-600 border-none transition-all active:scale-95 text-slate-300 mt-6" @click="generateKey" />
        </div>

        <!-- SMTP Section -->
        <div class="bg-[#1e293b] border border-white/5 rounded-3xl p-10 glass space-y-8">
            <div class="flex items-center gap-4 mb-4">
                <div class="bg-purple-500/10 p-4 rounded-2xl text-purple-400"><Lock :size="24" /></div>
                <h2 class="text-2xl font-black text-slate-100 tracking-tight">账户安全 (管理员)</h2>
            </div>

            <div class="space-y-6">
                <div class="grid grid-cols-1 gap-4">
                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-bold text-slate-400">目前管理员旧密码</label>
                        <InputText v-model="oldPassword" type="password" class="bg-slate-800 border-white/5 rounded-xl px-4 py-3 text-sm" placeholder="请输入旧密码" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-bold text-slate-400">设置新密码</label>
                        <InputText v-model="newPassword" type="password" class="bg-slate-800 border-white/5 rounded-xl px-4 py-3 text-sm" placeholder="请输入新密码" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-bold text-slate-400">确认新密码</label>
                        <InputText v-model="confirmPassword" type="password" class="bg-slate-800 border-white/5 rounded-xl px-4 py-3 text-sm" placeholder="请再次输入新密码" />
                    </div>
                </div>
                <Button label="修改管理员密码" :loading="loading" class="w-full py-4 rounded-xl font-bold bg-purple-500 hover:bg-purple-600 border-none transition-all active:scale-95 text-white mt-4 shadow-lg shadow-purple-500/20" @click="changePassword" />
            </div>
        </div>

        <!-- Redeem Section -->
        <div class="bg-[#1e293b] border border-white/5 rounded-3xl p-10 glass space-y-8">
            <div class="flex items-center gap-4 mb-4">
                <div class="bg-indigo-500/10 p-4 rounded-2xl text-indigo-400"><Lock :size="24" /></div>
                <h2 class="text-2xl font-black text-slate-100 tracking-tight">专属配额兑换</h2>
            </div>
            <div class="space-y-6 flex flex-col justify-between h-[calc(100%-80px)]">
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-bold text-slate-400">兑换码</label>
                    <InputText v-model="couponCode" class="bg-slate-800 border-white/5 rounded-xl px-4 py-3 text-sm font-mono text-indigo-400 uppercase" placeholder="请输入您的兑换码" />
                    <p class="text-xs text-slate-500 italic mt-1 font-medium">* 兑换码可用于提升映射数量上限或其他专属权益。</p>
                </div>
                <Button label="立 即 兑 换" :loading="loading" class="w-full py-4 rounded-xl font-bold bg-indigo-500 hover:bg-indigo-600 border-none transition-all active:scale-95 text-white shadow-lg shadow-indigo-500/20" @click="handleRedeem" />
            </div>
        </div>
    </div>

    <!-- Global Message Display -->
    <div v-if="message.text" class="fixed top-24 left-1/2 -translate-x-1/2 z-[60] w-full max-w-md px-4 animate-in fade-in slide-in-from-top-4 duration-300">
        <Message :severity="message.severity" closable @close="message.text = ''">{{ message.text }}</Message>
    </div>

    <!-- Save Overlay Button -->
    <div class="fixed bottom-10 right-10 z-50">
        <Button :loading="loading" class="bg-blue-500 hover:bg-blue-600 border-none px-10 py-5 rounded-3xl font-black text-xl transition-all shadow-2xl shadow-blue-500/40 active:scale-90 flex items-center gap-4 group" @click="saveSettings">
            <Save :size="24" class="group-hover:translate-y-[-2px] transition-transform" />
            <span>保存全局配置</span>
        </Button>
    </div>
  </div>
</template>

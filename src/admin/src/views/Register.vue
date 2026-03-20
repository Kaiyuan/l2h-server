<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Message from 'primevue/message';

import api from '../utils/api';

const router = useRouter();
const username = ref('');
const password = ref('');
const invitation_code = ref('');
const error = ref('');
const loading = ref(false);

const handleRegister = async () => {
    error.value = '';
    loading.value = true;
    try {
        await api.post('/api/register', {
            username: username.value,
            password: password.value,
            invitation_code: invitation_code.value
        });
        alert('注册成功，请登录！');
        router.push('/login');
    } catch (e: any) {
        error.value = e.response?.data?.error || '注册失败，请检查填写信息或邀请码';
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <div class="min-h-screen bg-surface-900 flex items-center justify-center p-4">
        <div class="glass p-8 rounded-3xl w-full max-w-md border border-surface-700 shadow-2xl relative overflow-hidden">
            <!-- Background Decoration -->
            <div class="absolute -top-32 -left-32 w-64 h-64 bg-primary-500/20 rounded-full blur-3xl mix-blend-screen"></div>
            <div class="absolute -bottom-32 -right-32 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl mix-blend-screen"></div>

            <div class="relative z-10">
                <div class="text-center mb-10">
                    <h1 class="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-400 tracking-tight mb-2">l2h Admin</h1>
                    <p class="text-surface-400 font-medium">Link to Host - 账号注册</p>
                </div>

                <div class="flex flex-col gap-6">
                    <Message v-if="error" severity="error" :closable="false" class="mb-2 text-sm">{{ error }}</Message>

                    <div class="flex flex-col gap-2">
                        <label for="username" class="text-sm font-semibold text-surface-300 ml-1">用户名</label>
                        <InputText id="username" v-model="username" class="w-full bg-surface-800/50 border-surface-700 text-white rounded-xl focus:ring-primary-500" placeholder="例如: user123" />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="password" class="text-sm font-semibold text-surface-300 ml-1">密码</label>
                        <Password id="password" v-model="password" class="w-full" inputClass="w-full bg-surface-800/50 border-surface-700 text-white rounded-xl focus:ring-primary-500" :feedback="false" toggleMask placeholder="••••••••" />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label for="invite" class="text-sm font-semibold text-surface-300 ml-1">邀请码</label>
                        <InputText id="invite" v-model="invitation_code" class="w-full bg-surface-800/50 border-surface-700 text-white rounded-xl focus:ring-primary-500" placeholder="必需的邀请码" />
                    </div>

                    <Button :loading="loading" @click="handleRegister" class="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 border-none py-3 mt-4 rounded-xl font-bold text-lg shadow-lg shadow-primary-500/30 transition-all active:scale-[0.98]">
                        注 册
                    </Button>

                    <div class="text-center mt-4 text-surface-400 text-sm">
                        已有账号？
                        <router-link to="/login" class="text-primary-400 hover:text-primary-300 transition-colors font-medium">去登录</router-link>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

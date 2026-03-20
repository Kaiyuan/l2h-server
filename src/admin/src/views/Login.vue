<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Message from 'primevue/message';

import api from '../utils/api';

const router = useRouter();
const username = ref('l2hadmin');
const password = ref('l2hpassword');
const error = ref('');
const loading = ref(false);

const handleLogin = async () => {
    loading.value = true;
    error.value = '';
    try {
        const resp = await api.post('/api/login', {
            username: username.value,
            password: password.value
        });
        localStorage.setItem('token', resp.data.token);
        localStorage.setItem('user', JSON.stringify(resp.data.user));
        router.push('/');
    } catch (e: any) {
        error.value = e.response?.data?.error || '登录失败，请检查用户名和密码';
    } finally {
        loading.value = false;
    }
};
</script>

<template>
  <div class="h-screen flex items-center justify-center bg-[#090e1a]">
    <div class="w-full max-w-md p-8 bg-[#151c2c] border border-white/5 rounded-3xl shadow-2xl space-y-8 glass">
      <div class="text-center">
        <h1 class="text-4xl font-extrabold text-blue-400 mb-2">l2h</h1>
        <p class="text-slate-400 font-medium">Link to Host Admin Panel</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-6">
        <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-slate-400 ml-1">用户名</label>
            <InputText v-model="username" class="w-full bg-[#1e293b] border-white/10 rounded-xl px-4 py-3" placeholder="Enter username" />
        </div>

        <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-slate-400 ml-1">密码</label>
            <Password v-model="password" class="w-full" :feedback="false" inputClass="w-full bg-[#1e293b] border-white/10 rounded-xl px-4 py-3" toggleMask placeholder="Enter password" />
        </div>

        <Message v-if="error" severity="error" variant="simple">{{ error }}</Message>

        <Button :loading="loading" @click="handleLogin" class="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 border-none py-3 mt-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98]">
            登 录
        </Button>

        <div class="text-center mt-4 text-slate-400 text-sm">
            没有账号？
            <router-link to="/register" class="text-blue-400 hover:text-blue-300 transition-colors font-medium">去注册</router-link>
        </div>
      </form>

      <div class="text-center text-xs text-slate-500 mt-10">
          Powered by l2h & PrimeVue
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.p-password-input) {
    width: 100% !important;
}
</style>

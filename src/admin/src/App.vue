<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { LayoutDashboard, Globe, Settings as SettingsIcon, LogOut, Menu, Tag } from 'lucide-vue-next';

const router = useRouter();
const visible = ref(true);

const userStr = localStorage.getItem('user');
const user = userStr ? JSON.parse(userStr) : null;
const isAdmin = user?.role === 'admin';

const menuItems = [
  { label: '仪表盘', icon: LayoutDashboard, to: '/' },
  { label: 'Path 管理', icon: Globe, to: '/paths' },
  { label: '设置', icon: SettingsIcon, to: '/settings' },
];

if (isAdmin) {
  menuItems.push({ label: '邀请 & 兑换', icon: Tag, to: '/codes' });
}

const logout = () => {
  localStorage.removeItem('token');
  router.push('/login');
};
</script>

<template>
  <div class="min-h-screen bg-surface-900 text-white font-sans flex flex-col md:flex-row">
    <!-- Mobile Header -->
    <div class="md:hidden flex items-center justify-between p-4 bg-surface-800 border-b border-surface-700">
      <div class="text-xl font-bold text-primary-400">l2h Admin</div>
      <Menu class="cursor-pointer" @click="visible = !visible" />
    </div>

    <!-- Sidebar -->
    <aside v-if="visible" class="fixed inset-y-0 left-0 z-50 w-64 bg-surface-800 border-r border-surface-700 transform md:relative md:translate-x-0 transition-transform duration-200">
      <div class="h-full flex flex-col p-6">
        <div class="text-2xl font-black mb-10 text-primary-400 tracking-tight">l2h</div>
        
        <nav class="flex-grow space-y-2">
          <router-link
            v-for="item in menuItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-surface-700 text-surface-300 hover:text-white"
            active-class="bg-primary-500/10 text-primary-400 border border-primary-500/20 shadow-lg shadow-primary-500/5"
          >
            <component :is="item.icon" :size="20" />
            <span class="font-medium">{{ item.label }}</span>
          </router-link>
        </nav>

        <button @click="logout" class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-red-500/10 text-surface-400 hover:text-red-400 mt-auto border border-transparent hover:border-red-500/20">
          <LogOut :size="20" />
          <span class="font-medium">退出登录</span>
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-grow p-6 md:p-10 bg-surface-900 overflow-auto">
      <router-view />
    </main>
  </div>
</template>

<style>
/* Custom Global Styles */
:root {
  color-scheme: dark;
}

body {
  margin: 0;
  overflow-x: hidden;
}

/* Glassmorphism utility */
.glass {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.text-primary-400 { color: #60a5fa; }
.bg-primary-500\/10 { background-color: rgba(96, 165, 250, 0.1); }
.border-primary-500\/20 { border-color: rgba(96, 165, 250, 0.2); }
.bg-surface-900 { background-color: #0f172a; }
.bg-surface-800 { background-color: #1e293b; }
.bg-surface-700 { background-color: #334155; }
.border-surface-700 { border-color: #334155; }
.text-surface-300 { color: #cbd5e1; }
.text-surface-400 { color: #94a3b8; }
</style>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../utils/api';
import { LayoutDashboard, Globe, Users, Ticket } from 'lucide-vue-next';

const stats = ref([
    { label: '活跃 Paths', value: '0', icon: Globe, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: '在线客户端', value: '0', icon: LayoutDashboard, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: '总用户数', value: '0', icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: '待处理工单', value: '0', icon: Ticket, color: 'text-orange-400', bg: 'bg-orange-500/10' },
]);

const fetchStats = async () => {
    try {
        const resp = await api.get('/admin-api/stats');
        const data = resp.data;
        stats.value[0].value = data.total_paths.toString();
        stats.value[1].value = data.active_sessions.toString();
        stats.value[2].value = data.total_users.toString();
    } catch (e) {
        console.error('Failed to fetch stats:', e);
    }
};

onMounted(fetchStats);
</script>

<template>
  <div class="space-y-12">
    <div class="flex items-end justify-between">
      <div>
        <h1 class="text-4xl font-extrabold text-slate-100 tracking-tight mb-2">欢迎回来, Admin!</h1>
        <p class="text-slate-400 text-lg font-medium">概览您的 l2h 网络状态</p>
      </div>
      <div class="text-slate-500 font-mono text-sm bg-slate-800/50 px-4 py-2 rounded-lg border border-white/5">
        Server IP: 127.0.0.1
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div v-for="stat in stats" :key="stat.label" class="p-8 rounded-3xl bg-[#1e293b] border border-white/5 shadow-xl hover:scale-[1.03] transition-transform duration-300 glass group cursor-default">
        <div class="flex items-center gap-6">
          <div :class="[stat.bg, 'p-4 rounded-2xl group-hover:rotate-12 transition-transform duration-500']">
            <component :is="stat.icon" :class="stat.color" :size="32" />
          </div>
          <div>
            <div class="text-slate-400 font-bold uppercase tracking-wider text-xs mb-1">{{ stat.label }}</div>
            <div class="text-4xl font-black text-white lining-nums">{{ stat.value }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Chart or recent activity (Placeholder) -->
    <div class="bg-[#1e293b] border border-white/5 rounded-3xl p-10 glass">
        <div class="flex items-center justify-between mb-8">
            <h2 class="text-2xl font-bold text-slate-200">全站流量统计</h2>
            <div class="flex gap-2">
                <button class="px-4 py-2 rounded-lg bg-blue-500 text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all">本月</button>
                <button class="px-4 py-2 rounded-lg bg-slate-800 text-sm font-bold hover:bg-slate-700 transition-all">上月</button>
            </div>
        </div>
        <div class="h-64 w-full bg-slate-800/20 rounded-2xl flex items-center justify-center border-2 border-dashed border-white/5">
            <span class="text-slate-500 font-mono italic">正在接入 Chart.js 数据可视化...</span>
        </div>
    </div>
  </div>
</template>

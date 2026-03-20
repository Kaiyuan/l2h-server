<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../utils/api';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import { Plus, Trash2, Edit3, Globe, ExternalLink } from 'lucide-vue-next';

const paths = ref<any[]>([]);
const visible = ref(false);
const editVisible = ref(false);
const newPath = ref({ name: '', port: '' });
const currentPath = ref<any>(null);

const fetchPaths = async () => {
    try {
        const resp = await api.get('/api/paths');
        paths.value = resp.data;
    } catch (e) {
        console.error('获取路径失败:', e);
    }
};

const addPath = async () => {
    try {
        // 目前假设 user_id = 1 (管理员)
        await api.post('/api/paths', { ...newPath.value, user_id: JSON.parse(localStorage.getItem('user') || '{}').id || 1 });
        visible.value = false;
        newPath.value = { name: '', port: '' };
        await fetchPaths();
    } catch (e) {
        alert('添加路径失败');
    }
};

const deletePath = async (id: number) => {
    if (!confirm('确定删除此映射吗？')) return;
    try {
        await api.delete(`/api/paths/${id}`);
        await fetchPaths();
    } catch (e) {
        alert('删除路径失败');
    }
};

const editPath = (path: any) => {
    currentPath.value = { ...path };
    editVisible.value = true;
};

const updatePath = async () => {
    try {
        await api.put(`/currentPath.value.id`, currentPath.value);
        editVisible.value = false;
        await fetchPaths();
    } catch (e) {
        alert('更新路径失败');
    }
};

const openLink = (name: string) => {
    window.open(`/${name}/`, '_blank');
};

onMounted(fetchPaths);
</script>

<template>
  <div class="space-y-12">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-4xl font-extrabold text-slate-100 tracking-tight mb-2">Path 管理</h1>
        <p class="text-slate-400 text-lg font-medium">配置网站路径与本地端口的映射关系</p>
      </div>
      <Button icon-pos="left" class="bg-blue-500 hover:bg-blue-600 border-none px-6 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-blue-500/10 active:scale-95 flex items-center gap-2" @click="visible = true">
          <Plus :size="20" />
          <span>添加新映射</span>
      </Button>
    </div>

    <!-- Data Table Container -->
    <div class="bg-[#1e293b] border border-white/5 rounded-3xl overflow-hidden glass shadow-2xl">
      <DataTable :value="paths" tableStyle="min-width: 50rem" :rowHover="true" class="p-4 custom-datatable">
        <Column field="name" header="映射路径">
            <template #body="slotProps">
                <div class="flex items-center gap-3">
                    <div class="bg-blue-500/10 p-2 rounded-xl text-blue-400">
                        <Globe :size="18" />
                    </div>
                    <span class="font-bold text-slate-100 italic">/{{ slotProps.data.name }}</span>
                </div>
            </template>
        </Column>
        <Column field="port" header="本地端口">
            <template #body="slotProps">
                <Tag :value="slotProps.data.port" severity="secondary" class="font-mono bg-slate-700/50 text-slate-300 border-white/5" />
            </template>
        </Column>
        <Column field="status" header="状态">
            <template #body="slotProps">
                <Tag :value="slotProps.data.status.toUpperCase()" :severity="slotProps.data.status === 'online' ? 'success' : 'warn'" class="rounded-lg px-3 py-1 font-bold text-[10px] tracking-widest shadow-sm" />
            </template>
        </Column>
        <Column field="user" header="所属账号" class="text-slate-400"></Column>
        <Column header="操作">
            <template #body="slotProps">
                <div class="flex gap-2">
                    <button @click="editPath(slotProps.data)" class="bg-slate-700 hover:bg-slate-600 text-slate-300 p-3 rounded-xl transition-all active:scale-90"><Edit3 :size="16" /></button>
                    <button @click="deletePath(slotProps.data.id)" class="bg-red-500/10 hover:bg-red-500/20 text-red-500 p-3 rounded-xl transition-all active:scale-90"><Trash2 :size="16" /></button>
                    <button class="bg-green-500/10 hover:bg-green-500/20 text-green-500 p-3 rounded-xl transition-all active:scale-90" @click="openLink(slotProps.data.name)"><ExternalLink :size="16" /></button>
                </div>
            </template>
        </Column>
      </DataTable>
    </div>

    <!-- Add Dialog -->
    <Dialog v-model:visible="visible" modal header="添加本地映射" class="w-[30rem] bg-[#1e293b] border-white/5 rounded-3xl glass shadow-2xl overflow-hidden custom-dialog">
        <div class="p-6 space-y-6">
            <div class="flex flex-col gap-2">
                <label class="text-sm font-bold text-slate-400 ml-1">Path 名称 (例如: blog)</label>
                <InputText v-model="newPath.name" class="bg-slate-800 border-white/5 rounded-xl px-4 py-3 text-sm focus:ring-blue-500/40" />
            </div>
            <div class="flex flex-col gap-2">
                <label class="text-sm font-bold text-slate-400 ml-1">本地端口 (例如: 8080)</label>
                <InputText v-model="newPath.port" type="number" class="bg-slate-800 border-white/5 rounded-xl px-4 py-3 text-sm focus:ring-blue-500/40" />
            </div>
            <div class="flex justify-end gap-3 pt-4">
                <button @click="visible = false" class="px-6 py-3 rounded-xl font-bold text-slate-400 hover:bg-white/5 transition-all">取消</button>
                <button @click="addPath" class="px-6 py-3 rounded-xl font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20 active:scale-95 transition-all">确认添加</button>
            </div>
        </div>
    </Dialog>

    <!-- Edit Dialog -->
    <Dialog v-model:visible="editVisible" modal header="编辑映射" class="w-[30rem] bg-[#1e293b] border-white/5 rounded-3xl glass shadow-2xl overflow-hidden custom-dialog">
        <div v-if="currentPath" class="p-6 space-y-6">
            <div class="flex flex-col gap-2">
                <label class="text-sm font-bold text-slate-400 ml-1">Path 名称</label>
                <InputText v-model="currentPath.name" class="bg-slate-800 border-white/5 rounded-xl px-4 py-3 text-sm focus:ring-blue-500/40" />
            </div>
            <div class="flex flex-col gap-2">
                <label class="text-sm font-bold text-slate-400 ml-1">本地端口</label>
                <InputText v-model="currentPath.port" type="number" class="bg-slate-800 border-white/5 rounded-xl px-4 py-3 text-sm focus:ring-blue-500/40" />
            </div>
            <div class="flex items-center gap-2">
                <input type="checkbox" v-model="currentPath.is_active" id="active-checkbox" />
                <label for="active-checkbox" class="text-sm font-bold text-slate-400">是否激活</label>
            </div>
            <div class="flex justify-end gap-3 pt-4">
                <button @click="editVisible = false" class="px-6 py-3 rounded-xl font-bold text-slate-400 hover:bg-white/5 transition-all">取消</button>
                <button @click="updatePath" class="px-6 py-3 rounded-xl font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20 active:scale-95 transition-all">保存修改</button>
            </div>
        </div>
    </Dialog>
  </div>
</template>

<style>
.custom-datatable .p-datatable-header,
.custom-datatable .p-datatable-thead > tr > th {
    background: transparent !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
    color: #94a3b8 !important;
    font-weight: 800 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.1em !important;
    font-size: 0.75rem !important;
}

.custom-datatable .p-datatable-tbody > tr {
    background: transparent !important;
    color: #e2e8f0 !important;
}

.custom-datatable .p-datatable-tbody > tr:hover {
    background: rgba(255, 255, 255, 0.02) !important;
}

.custom-datatable .p-datatable-tbody > tr > td {
    border-bottom: 1px solid rgba(255, 255, 255, 0.03) !important;
    padding: 1.25rem 1rem !important;
}

/* PrimeVue Dialog Customization */
.custom-dialog .p-dialog-header {
    background: transparent !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
    padding: 2rem !important;
}

.custom-dialog .p-dialog-title {
    font-size: 1.5rem !important;
    font-weight: 800 !important;
    color: #f8fafc !important;
}

.custom-dialog .p-dialog-content {
    background: transparent !important;
    padding: 0 !important;
}
</style>

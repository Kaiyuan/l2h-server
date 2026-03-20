<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../utils/api';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Message from 'primevue/message';
import { Ticket, Link as LinkIcon } from 'lucide-vue-next';

const invitations = ref<any[]>([]);
const coupons = ref<any[]>([]);
const loading = ref(false);
const message = ref({ text: '', severity: '' as 'success' | 'error' | 'info' | 'secondary' | 'warn' | undefined });
const newCouponMemo = ref('');

const fetchInvitations = async () => {
    try {
        const resp = await api.get('/admin-api/invitations');
        invitations.value = resp.data;
    } catch (e) {
        message.value = { text: '无法获取邀请码列表', severity: 'error' };
    }
};

const fetchCoupons = async () => {
    try {
        const resp = await api.get('/admin-api/coupons');
        coupons.value = resp.data;
    } catch (e) {
        message.value = { text: '无法获取兑换码列表', severity: 'error' };
    }
};

const createInvitation = async () => {
    loading.value = true;
    try {
        await api.post('/admin-api/invitations');
        await fetchInvitations();
        message.value = { text: '邀请码生成成功', severity: 'success' };
    } catch (e) {
        message.value = { text: '邀请码生成失败', severity: 'error' };
    } finally {
        loading.value = false;
    }
};

const deleteInvitation = async (id: number) => {
    if (!confirm('确定删除此邀请码？')) return;
    try {
        await api.delete(`/admin-api/invitations/${id}`);
        await fetchInvitations();
        message.value = { text: '删除成功', severity: 'success' };
    } catch (e) {
        message.value = { text: '删除失败', severity: 'error' };
    }
};

const createCoupon = async () => {
    loading.value = true;
    try {
        await api.post('/admin-api/coupons', { memo: newCouponMemo.value });
        newCouponMemo.value = '';
        await fetchCoupons();
        message.value = { text: '兑换码生成成功', severity: 'success' };
    } catch (e) {
        message.value = { text: '兑换码生成失败', severity: 'error' };
    } finally {
        loading.value = false;
    }
};

const deleteCoupon = async (id: number) => {
    if (!confirm('确定删除此兑换码？')) return;
    try {
        await api.delete(`/admin-api/coupons/${id}`);
        await fetchCoupons();
        message.value = { text: '删除成功', severity: 'success' };
    } catch (e) {
        message.value = { text: '删除失败', severity: 'error' };
    }
};

const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.value = { text: '已复制到剪贴板', severity: 'info' };
}

onMounted(() => {
    fetchInvitations();
    fetchCoupons();
});
</script>

<template>
  <div class="space-y-12">
    <div>
        <h1 class="text-4xl font-extrabold text-slate-100 tracking-tight mb-2">邀请与兑换</h1>
        <p class="text-slate-400 text-lg font-medium">管理邀请码和福利分发</p>
    </div>

    <!-- Global Message Display -->
    <div v-if="message.text" class="mb-4">
        <Message :severity="message.severity" closable @close="message.text = ''">{{ message.text }}</Message>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-10">
        <!-- Invitations Section -->
        <div class="bg-surface-800 border border-surface-700 rounded-3xl p-8 glass space-y-6">
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-4">
                    <div class="bg-emerald-500/10 p-4 rounded-2xl text-emerald-400"><LinkIcon :size="24" /></div>
                    <h2 class="text-2xl font-black text-slate-100 tracking-tight">邀请码管理</h2>
                </div>
                <Button label="生成邀请码" icon="pi pi-plus" class="bg-emerald-500 hover:bg-emerald-600 border-none font-bold shadow-lg shadow-emerald-500/20" @click="createInvitation" :loading="loading" />
            </div>

            <DataTable :value="invitations" 
                class="bg-transparent border border-surface-700 rounded-xl overflow-hidden" 
                tableStyle="min-width: 100%" 
                paginator :rows="5"
                pt:headerRow:class="bg-surface-800 text-surface-400"
                pt:bodyRow:class="bg-surface-900/50 border-b border-surface-700 hover:bg-surface-700 transition-colors"
                pt:paginatorWrapper:class="bg-surface-800 border-t border-surface-700 rounded-b-xl"
            >
                <Column field="code" header="邀请码">
                    <template #body="slotProps">
                        <span class="font-mono text-emerald-300 cursor-pointer" @click="copyToClipboard(slotProps.data.code)">{{ slotProps.data.code }}</span>
                    </template>
                </Column>
                <Column field="created_at" header="创建时间">
                    <template #body="slotProps">
                        <span class="text-surface-400 text-sm">{{ slotProps.data.created_at }}</span>
                    </template>
                </Column>
                <Column header="操作" :exportable="false" style="min-width:6rem">
                    <template #body="slotProps">
                        <Button icon="pi pi-trash" outlined rounded severity="danger" class="border-red-500 text-red-400 hover:bg-red-500/10 w-10 h-10 p-0 flex items-center justify-center transform hover:scale-110 active:scale-90 transition-all" @click="deleteInvitation(slotProps.data.id)" />
                    </template>
                </Column>
                <template #empty><div class="text-center p-6 text-surface-500">暂无邀请码</div></template>
            </DataTable>
        </div>

        <!-- Coupons Section -->
        <div class="bg-surface-800 border border-surface-700 rounded-3xl p-8 glass space-y-6">
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-4">
                    <div class="bg-indigo-500/10 p-4 rounded-2xl text-indigo-400"><Ticket :size="24" /></div>
                    <h2 class="text-2xl font-black text-slate-100 tracking-tight">兑换码管理</h2>
                </div>
            </div>

            <div class="flex gap-4">
                <InputText v-model="newCouponMemo" class="flex-grow bg-surface-900 border-surface-700 rounded-xl px-4" placeholder="备注 (可选，例如: 社区活动奖励)" />
                <Button label="生成兑换码" class="bg-indigo-500 hover:bg-indigo-600 border-none font-bold shadow-lg shadow-indigo-500/20" @click="createCoupon" :loading="loading" />
            </div>

            <DataTable :value="coupons" 
                class="bg-transparent border border-surface-700 rounded-xl overflow-hidden" 
                tableStyle="min-width: 100%" 
                paginator :rows="5"
                pt:headerRow:class="bg-surface-800 text-surface-400"
                pt:bodyRow:class="bg-surface-900/50 border-b border-surface-700 hover:bg-surface-700 transition-colors"
                pt:paginatorWrapper:class="bg-surface-800 border-t border-surface-700 rounded-b-xl"
            >
                <Column field="code" header="兑换码">
                    <template #body="slotProps">
                        <span class="font-mono text-indigo-300 cursor-pointer" @click="copyToClipboard(slotProps.data.code)">{{ slotProps.data.code }}</span>
                    </template>
                </Column>
                <Column field="memo" header="备注"></Column>
                <Column field="used_by" header="状态">
                    <template #body="slotProps">
                        <Tag v-if="slotProps.data.used_by" severity="secondary" :value="'已兑换: ' + slotProps.data.used_by" class="bg-surface-700 text-surface-400"></Tag>
                        <Tag v-else severity="success" value="未兑换" class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"></Tag>
                    </template>
                </Column>
                <Column header="操作" :exportable="false" style="min-width:6rem">
                    <template #body="slotProps">
                        <Button icon="pi pi-trash" outlined rounded severity="danger" class="border-red-500 text-red-400 hover:bg-red-500/10 w-10 h-10 p-0 flex items-center justify-center transform hover:scale-110 active:scale-90 transition-all" @click="deleteCoupon(slotProps.data.id)" />
                    </template>
                </Column>
                <template #empty><div class="text-center p-6 text-surface-500">暂无兑换码</div></template>
            </DataTable>
        </div>
    </div>
  </div>
</template>

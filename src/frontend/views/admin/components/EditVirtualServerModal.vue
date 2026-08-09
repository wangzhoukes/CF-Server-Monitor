<template>
  <div id="editVirtualModal" class="modal-overlay" :class="{ active: show }">
    <div class="modal-dialog">
      <div class="modal-header">
        <div class="modal-title">{{ isEditing ? trans.editVirtualServer : trans.virtualServerConfig }}</div>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>

      <div class="form-row">
        <div class="form-group flex-1">
          <label class="form-label">{{ trans.hostnameLabel }} <span class="required">*</span></label>
          <input type="text" v-model="virtualForm.name" class="form-input" placeholder="My VPS">
        </div>
        <div class="form-group flex-1">
          <label class="form-label">{{ trans.groupName }}</label>
          <input type="text" v-model="virtualForm.server_group" class="form-input" placeholder="Default">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group flex-1">
          <label class="form-label">{{ trans.tags }}</label>
          <input type="text" v-model="virtualForm.tags" class="form-input" :placeholder="trans.tagsPlaceholder">
        </div>
        <div class="form-group flex-1">
          <label class="form-label">{{ trans.region }} CN/US/GB</label>
          <input type="text" v-model.trim="virtualForm.region" class="form-input" :placeholder="trans.regionPlaceholder">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">{{ trans.note }}</label>
        <textarea v-model="virtualForm.note" class="form-textarea" rows="1" :placeholder="trans.notePlaceholder"></textarea>
      </div>

      <div class="form-section-divider">— {{ trans.virtualServerConfig }} —</div>

      <div class="form-row">
        <div class="form-group flex-1">
          <label class="form-label">OS</label>
          <input type="text" v-model="virtualForm.os" class="form-input" placeholder="Ubuntu 22.04 LTS">
        </div>
        <div class="form-group flex-1">
          <label class="form-label">Arch</label>
          <input type="text" v-model="virtualForm.arch" class="form-input" placeholder="x86_64">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group flex-1">
          <label class="form-label">CPU {{ trans.cpu }}</label>
          <input type="text" v-model="virtualForm.cpu_info" class="form-input" placeholder="Intel Xeon E5-2680 v4">
        </div>
        <div class="form-group" style="width: 120px;">
          <label class="form-label">{{ trans.cpuCores || 'Cores' }}</label>
          <input type="number" v-model.number="virtualForm.cpu_cores" class="form-input" min="1" max="128" placeholder="2">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group flex-1">
          <label class="form-label">{{ trans.kernelVersion }}</label>
          <input type="text" v-model="virtualForm.kernel_version" class="form-input" placeholder="5.15.0-91-generic">
        </div>
        <div class="form-group flex-1">
          <label class="form-label">{{ trans.agentVersion || 'Agent Ver' }}</label>
          <input type="text" v-model="virtualForm.agent_version" class="form-input" placeholder="1.0.0">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group flex-1">
          <label class="form-label">{{ trans.ram }} (MB)</label>
          <input type="number" v-model.number="virtualForm.ram_total" class="form-input" min="128" placeholder="2048">
        </div>
        <div class="form-group flex-1">
          <label class="form-label">{{ trans.disk }} (GB)</label>
          <input type="number" v-model.number="virtualForm.disk_total" class="form-input" min="1" placeholder="20">
        </div>
        <div class="form-group flex-1">
          <label class="form-label">{{ trans.swap }} (MB)</label>
          <input type="number" v-model.number="virtualForm.swap_total" class="form-input" min="0" placeholder="512">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group flex-1">
          <label class="form-label">CPU {{ trans.cpu }} % (min ~ max)</label>
          <div class="range-pair">
            <input type="number" v-model.number="virtualForm.cpu_min" class="form-input" min="0" max="100" step="0.1" placeholder="3">
            <span class="range-separator">~</span>
            <input type="number" v-model.number="virtualForm.cpu_max" class="form-input" min="0" max="100" step="0.1" placeholder="25">
          </div>
        </div>
        <div class="form-group flex-1">
          <label class="form-label">{{ trans.ram }} % (min ~ max)</label>
          <div class="range-pair">
            <input type="number" v-model.number="virtualForm.ram_usage_min" class="form-input" min="0" max="100" placeholder="25">
            <span class="range-separator">~</span>
            <input type="number" v-model.number="virtualForm.ram_usage_max" class="form-input" min="0" max="100" placeholder="55">
          </div>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group flex-1">
          <label class="form-label">{{ trans.disk }} %</label>
          <input type="number" v-model.number="virtualForm.disk_usage" class="form-input" min="0" max="99" step="0.1" placeholder="45">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group flex-1">
          <label class="form-label">{{ trans.dl }} (B/s, min ~ max)</label>
          <div class="range-pair">
            <input type="number" v-model.number="virtualForm.net_in_min" class="form-input" min="0" placeholder="1024">
            <span class="range-separator">~</span>
            <input type="number" v-model.number="virtualForm.net_in_max" class="form-input" min="0" placeholder="524288">
          </div>
        </div>
        <div class="form-group flex-1">
          <label class="form-label">{{ trans.ul }} (B/s, min ~ max)</label>
          <div class="range-pair">
            <input type="number" v-model.number="virtualForm.net_out_min" class="form-input" min="0" placeholder="512">
            <span class="range-separator">~</span>
            <input type="number" v-model.number="virtualForm.net_out_max" class="form-input" min="0" placeholder="262144">
          </div>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group" style="width: 90px;">
          <label class="form-label">{{ trans.pingCt }}</label>
          <input type="number" v-model.number="virtualForm.ping_ct" class="form-input" min="1" placeholder="5">
        </div>
        <div class="form-group" style="width: 90px;">
          <label class="form-label">{{ trans.pingCu }}</label>
          <input type="number" v-model.number="virtualForm.ping_cu" class="form-input" min="1" placeholder="10">
        </div>
        <div class="form-group" style="width: 90px;">
          <label class="form-label">{{ trans.pingCm }}</label>
          <input type="number" v-model.number="virtualForm.ping_cm" class="form-input" min="1" placeholder="15">
        </div>
        <div class="form-group" style="width: 90px;">
          <label class="form-label">{{ trans.pingBd }}</label>
          <input type="number" v-model.number="virtualForm.ping_bd" class="form-input" min="1" placeholder="20">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group flex-1">
          <label class="form-label">{{ trans.processes }}</label>
          <input type="number" v-model.number="virtualForm.processes" class="form-input" min="1" placeholder="85">
        </div>
        <div class="form-group flex-1">
          <label class="form-label">TCP</label>
          <input type="number" v-model.number="virtualForm.tcp_conn" class="form-input" min="0" placeholder="30">
        </div>
        <div class="form-group flex-1">
          <label class="form-label">UDP</label>
          <input type="number" v-model.number="virtualForm.udp_conn" class="form-input" min="0" placeholder="5">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group flex-1">
          <label class="form-label">{{ trans.currency }}</label>
          <input type="text" v-model="virtualForm.currency" class="form-input" list="virtual-currency-list" placeholder="$">
          <datalist id="virtual-currency-list">
            <option v-for="item in currencyOptions" :key="item.symbol" :value="item.symbol">{{ currencyLabel(item) }}</option>
          </datalist>
        </div>
        <div class="form-group flex-1">
          <label class="form-label">{{ trans.price }}</label>
          <input type="text" inputmode="decimal" v-model="virtualForm.price" class="form-input" placeholder="40.00">
        </div>
        <div class="form-group flex-1">
          <label class="form-label">{{ trans.billingCycle }}</label>
          <select v-model="virtualForm.billing_cycle" class="form-select">
            <option v-for="item in billingCycles" :key="item.value" :value="item.value">{{ cycleLabel(item) }}</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group flex-1">
          <label class="form-label">{{ trans.bootTime || 'Boot Time' }}</label>
          <input type="datetime-local" v-model="virtualForm.boot_time" class="form-input">
        </div>
        <div class="form-group flex-1">
          <label class="form-label">{{ trans.expirationDate }}</label>
          <input type="date" v-model="virtualForm.expire_date" class="form-input">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group flex-1">
          <label class="form-label">{{ trans.traffic }} (GB)</label>
          <input type="number" v-model.number="virtualForm.traffic_limit" class="form-input" min="0" placeholder="0">
        </div>
        <div class="form-group flex-1"></div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <div class="checkbox-item no-margin">
            <input type="checkbox" v-model="virtualForm.auto_renewal">
            <label><b>{{ trans.autoRenewal }}</b></label>
          </div>
        </div>
        <div class="form-group">
          <div class="checkbox-item no-margin">
            <input type="checkbox" v-model="virtualForm.is_hidden">
            <label><b>{{ trans.hideFromPublic }}</b></label>
          </div>
        </div>
      </div>

      <div class="modal-footer flex-justify-between">
        <button @click="$emit('save')" class="btn btn-primary">{{ trans.save }}</button>
        <button @click="$emit('close')" class="btn">{{ trans.cancel }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { currentLang } from '../../../utils/i18n.js'
import { BILLING_CYCLES, CURRENCY_OPTIONS } from '../../../utils/server.js'

const virtualForm = defineModel('virtualForm', { type: Object, required: true })

const props = defineProps({
  trans: { type: Object, required: true },
  show: { type: Boolean, default: false },
  isEditing: { type: Boolean, default: false }
})

defineEmits(['save', 'close'])

const billingCycles = BILLING_CYCLES
const currencyOptions = CURRENCY_OPTIONS

const cycleLabel = (item) => currentLang.value === 'zh' ? item.labelZh : item.labelEn
const currencyLabel = (item) => currentLang.value === 'zh'
  ? `${item.symbol} ${item.nameZh}`
  : `${item.symbol} ${item.nameEn}`
</script>

<style scoped>
.form-section-divider {
  text-align: center;
  color: var(--text-muted, #666);
  font-size: 0.85rem;
  margin: 0.75rem 0;
  letter-spacing: 0.05em;
  font-family: 'JetBrains Mono', monospace;
}

.range-pair {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.range-separator {
  color: var(--text-muted, #666);
  font-family: 'JetBrains Mono', monospace;
  flex-shrink: 0;
}
</style>

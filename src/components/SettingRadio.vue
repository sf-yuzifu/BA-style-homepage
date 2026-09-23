<script setup lang="ts">
interface RadioOption {
  value: string
  label: string
}

const props = defineProps<{
  modelValue: string
  options: RadioOption[]
  label?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const select = (value: string) => {
  if (props.disabled || value === props.modelValue) return
  emit('update:modelValue', value)
}

// 方向键在组内移动并直接选中（与原生 radio 行为一致）
const move = (step: number) => {
  if (props.disabled) return
  const index = props.options.findIndex((option) => option.value === props.modelValue)
  const count = props.options.length
  if (index < 0 || count === 0) return
  emit('update:modelValue', props.options[(index + step + count) % count].value)
}
</script>

<template>
  <div class="radio-group" role="radiogroup" :aria-label="props.label">
    <!-- 动态 tabindex（启用 0 / 禁用 -1）无法被 interactive-supports-focus 静态求值（仅认字面量）；
         实际启用时各项均可 Tab 聚焦，Enter/Space/方向键行为完整 -->
    <!-- eslint-disable-next-line vuejs-accessibility/interactive-supports-focus -->
    <span
      v-for="option in props.options"
      :key="option.value"
      class="radio css-cursor-hover-enabled"
      :class="{ checked: option.value === props.modelValue, disabled: props.disabled }"
      role="radio"
      :tabindex="props.disabled ? -1 : 0"
      :aria-checked="option.value === props.modelValue"
      :aria-disabled="props.disabled || undefined"
      @click="select(option.value)"
      @keydown.enter.prevent="select(option.value)"
      @keydown.space.prevent="select(option.value)"
      @keydown.left.prevent="move(-1)"
      @keydown.right.prevent="move(1)"
    >
      <i class="dot"></i>
      <span class="text">{{ option.label }}</span>
    </span>
  </div>
</template>

<style scoped>
.radio-group {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  row-gap: clamp(12px, calc(0.75 * var(--u)), 100vw);
}

.radio {
  display: inline-flex;
  align-items: center;
  gap: clamp(8px, calc(0.5 * var(--u)), 100vw);
  font-size: clamp(16px, calc(1 * var(--u)), 100vw);
  color: #6b7f8d;
  transition: color 0.2s;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.radio.checked {
  color: #003153;
}

.radio.disabled {
  opacity: 0.45;
  pointer-events: none;
}

.dot {
  position: relative;
  flex: none;
  width: clamp(18px, calc(1.125 * var(--u)), 100vw);
  height: clamp(18px, calc(1.125 * var(--u)), 100vw);
  border: clamp(2px, calc(0.125 * var(--u)), 100vw) solid #b6c7d2;
  border-radius: 50%;
  box-sizing: border-box;
  transition:
    border-color 0.2s,
    background-color 0.2s;
}

.radio.checked .dot,
.radio:hover .dot {
  border-color: #4ec3f5;
}

.dot::after {
  content: '';
  position: absolute;
  inset: clamp(3px, calc(0.1875 * var(--u)), 100vw);
  border-radius: 50%;
  background: #4ec3f5;
  transform: scale(0);
  transition: transform 0.2s;
}

.radio.checked .dot::after {
  transform: scale(1);
}
</style>

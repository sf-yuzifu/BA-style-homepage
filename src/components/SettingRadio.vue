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
}

.radio {
  display: inline-flex;
  align-items: center;
  gap: clamp(8px, 0.5vw, 100vw);
  font-size: clamp(16px, 1vw, 100vw);
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
  width: clamp(18px, 1.125vw, 100vw);
  height: clamp(18px, 1.125vw, 100vw);
  border: clamp(2px, 0.125vw, 100vw) solid #b6c7d2;
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
  inset: clamp(3px, 0.1875vw, 100vw);
  border-radius: 50%;
  background: #4ec3f5;
  transform: scale(0);
  transition: transform 0.2s;
}

.radio.checked .dot::after {
  transform: scale(1);
}
</style>

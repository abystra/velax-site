<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useData } from 'vitepress'

const props = defineProps<{
  code: string
}>()

const { isDark } = useData()
const svg = ref('')
const error = ref('')

const source = computed(() => decodeURIComponent(props.code))

async function renderDiagram() {
  if (typeof window === 'undefined') return

  try {
    const mermaid = (await import('mermaid')).default

    mermaid.initialize({
      startOnLoad: false,
      theme: isDark.value ? 'dark' : 'default',
      securityLevel: 'strict',
      fontFamily:
        'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
    })

    const id = `mermaid-${Math.random().toString(36).slice(2)}`
    const result = await mermaid.render(id, source.value)
    svg.value = result.svg
    error.value = ''
  } catch (err) {
    svg.value = ''
    error.value = err instanceof Error ? err.message : String(err)
  }
}

onMounted(renderDiagram)
watch(isDark, renderDiagram)
</script>

<template>
  <figure class="mermaid-block">
    <div v-if="svg" class="mermaid-svg" v-html="svg" />
    <pre v-else class="mermaid-fallback"><code>{{ error || source }}</code></pre>
  </figure>
</template>

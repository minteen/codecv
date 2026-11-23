<script setup lang="ts">
import DraftManager from './components/draftManager.vue'
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<template>
  <main id="home" class="noto-sans-sc">
    <DraftManager @create="router.push('/template')" />
  </main>
</template>

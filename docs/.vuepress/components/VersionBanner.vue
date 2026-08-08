<script setup lang="ts">
import { computed } from 'vue';
import { withBase } from 'vuepress/client';

import { useVersionPaths } from '../composables/useVersionPaths';

const { counterpartPath, isV2 } = useVersionPaths();
const migrationGuideLink = withBase('/overview/v3-migration.html');
const counterpartLink = computed(() => withBase(counterpartPath.value));
</script>

<template>
  <aside class="version-banner" :class="{ 'version-banner-v2': isV2 }">
    <template v-if="isV2">
      This is the archived documentation for beachball v2. View the
      <a :href="counterpartLink">beachball v3 (prerelease) documentation.</a>
    </template>
    <template v-else>
      This documentation applies to beachball v3 prerelease (<code>beachball@next</code>). View the
      <a :href="counterpartLink">beachball v2 documentation</a> or read the
      <a :href="migrationGuideLink"> v3 migration guide.</a>
    </template>
  </aside>
</template>

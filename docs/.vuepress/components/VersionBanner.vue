<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, withBase } from 'vuepress/client';

const route = useRoute();

const isV2 = computed(() => route.path.startsWith('/v2/'));
const migrationGuideLink = withBase('/overview/v3-migration.html');
const counterpartLink = computed(() => {
  if (isV2.value) {
    return withBase(route.path.replace(/^\/v2/, '') || '/');
  }

  const hasV2Counterpart = route.path !== '/overview/v3-migration.html' && route.path !== '/cli/migrate.html';
  return withBase(hasV2Counterpart ? `/v2${route.path}` : '/v2/');
});
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

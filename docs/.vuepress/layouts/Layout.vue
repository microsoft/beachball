<script setup lang="ts">
import DefaultLayout from '@vuepress/theme-default/layouts/Layout.vue';

import VersionBanner from '../components/VersionBanner.vue';
</script>

<template>
  <DefaultLayout>
    <template #page-top>
      <VersionBanner />
    </template>
  </DefaultLayout>
</template>

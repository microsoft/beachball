import { computed } from 'vue';
import { useRoute } from 'vuepress/client';

const v3OnlyPaths = new Set(['/overview/v3-migration.html', '/cli/migrate.html']);

export const useVersionPaths = () => {
  const route = useRoute();
  const isV2 = computed(() => route.path.startsWith('/v2/'));
  const v3Path = computed(() => (isV2.value ? route.path.replace(/^\/v2/, '') || '/' : route.path));
  const v2Path = computed(() =>
    isV2.value ? route.path : v3OnlyPaths.has(v3Path.value) ? '/v2/' : `/v2${route.path}`
  );
  const counterpartPath = computed(() => (isV2.value ? v3Path.value : v2Path.value));

  return { counterpartPath, isV2, v2Path, v3Path };
};

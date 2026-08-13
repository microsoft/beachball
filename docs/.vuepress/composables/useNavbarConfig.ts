import { useNavbarConfig as useDefaultNavbarConfig, type NavbarItem } from '@vuepress/theme-default/client';
import { computed, type ComputedRef } from 'vue';

import { useVersionPaths } from './useVersionPaths';

export const useNavbarConfig = (): ComputedRef<NavbarItem[]> => {
  const navbarConfig = useDefaultNavbarConfig();
  const { isV2, v2Path, v3Path } = useVersionPaths();

  return computed(() => {
    return navbarConfig.value.map(item => {
      if ('children' in item && item.text === 'Versions') {
        return {
          ...item,
          text: `Version: ${isV2.value ? '2.x' : '3.x'}`,
          children: item.children.map(child =>
            'children' in child ? child : { ...child, link: child.text.startsWith('v2') ? v2Path.value : v3Path.value }
          ),
        };
      }

      if (!('children' in item) && item.text === 'GitHub' && isV2.value) {
        return { ...item, link: item.link + '/tree/v2' };
      }

      return item;
    });
  });
};

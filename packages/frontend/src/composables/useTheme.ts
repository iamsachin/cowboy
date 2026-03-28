import { ref, watchEffect } from 'vue';

const isDark = ref<boolean>(true);

// Initialize from localStorage
const stored = localStorage.getItem('theme-preference');
if (stored === 'light') {
  isDark.value = false;
} else {
  isDark.value = true;
}

function applyTheme() {
  const theme = isDark.value ? 'forest' : 'emerald';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme-preference', isDark.value ? 'dark' : 'light');
}

// Apply on module load
applyTheme();

function toggleTheme() {
  isDark.value = !isDark.value;
  applyTheme();
}

export function useTheme() {
  return { isDark, toggleTheme };
}

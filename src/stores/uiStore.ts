import { defineStore } from "pinia";
import { ref } from "vue";

export const useUiStore = defineStore("ui", () => {
  const toasts = ref<
    { id: number; message: string; type: "success" | "error" | "info" }[]
  >([]);
  let toastId = 0;

  function showToast(
    message: string,
    type: "success" | "error" | "info" = "info",
  ) {
    const id = ++toastId;
    toasts.value.push({ id, message, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, 3000);
  }

  return { toasts, showToast };
});

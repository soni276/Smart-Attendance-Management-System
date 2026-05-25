import toast from "react-hot-toast";

export function toastSuccess(message: string) {
  toast.success(message, { icon: "✓" });
}

export function toastError(message: string) {
  toast.error(message, { icon: "✕" });
}

export function toastInfo(message: string) {
  toast(message, { icon: "ℹ" });
}

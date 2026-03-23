const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/account-exists-with-different-credential":
    "Email này đã được đăng ký bằng một phương thức đăng nhập khác.",
  "auth/credential-already-in-use":
    "Thông tin đăng nhập này đã được liên kết với một tài khoản khác.",
  "auth/email-already-in-use": "Email này đã được sử dụng.",
  "auth/invalid-credential": "Email hoặc mật khẩu không đúng.",
  "auth/invalid-email": "Email không hợp lệ.",
  "auth/network-request-failed": "Không thể kết nối mạng. Vui lòng thử lại.",
  "auth/popup-blocked": "Trình duyệt đã chặn cửa sổ đăng nhập.",
  "auth/popup-closed-by-user": "Bạn đã đóng cửa sổ đăng nhập.",
  "auth/provider-already-linked":
    "Phương thức đăng nhập này đã được liên kết trước đó.",
  "auth/too-many-requests":
    "Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.",
  "auth/user-disabled": "Tài khoản này đã bị vô hiệu hóa.",
  "auth/user-not-found": "Không tìm thấy tài khoản với email này.",
  "auth/weak-password": "Mật khẩu quá yếu. Vui lòng chọn mật khẩu mạnh hơn.",
  "auth/wrong-password": "Email hoặc mật khẩu không đúng.",
};

export function getFirebaseAuthErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  if (code && AUTH_ERROR_MESSAGES[code]) {
    return AUTH_ERROR_MESSAGES[code];
  }

  return "Không thể thực hiện thao tác đăng nhập. Vui lòng thử lại.";
}

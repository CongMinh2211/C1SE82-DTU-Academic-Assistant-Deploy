// Các nhãn giao diện sinh viên; dữ liệu người dùng và nội dung gốc không tự thay đổi.
import type { UiLanguage } from "./language";
const messages: Record<string, readonly [string, string]> = {
  "Chọn email bạn muốn nhận từ trợ lý học vụ.": ["Choose which emails you receive from the academic assistant.","शैक्षणिक सहायक से मिलने वाले ईमेल चुनें।"],
  "Email cập nhật phản hồi": ["Feedback update emails","प्रतिक्रिया अपडेट ईमेल"],
  "Nhận email khi quản trị viên xử lý góp ý của bạn. Email dẫn về ứng dụng để xem kết quả.": ["Receive an email when an administrator resolves your feedback, with a link to view the result in the app.","प्रशासक आपकी प्रतिक्रिया का समाधान करे तो ईमेल पाएँ। परिणाम देखने के लिए ईमेल में ऐप का लिंक होगा।"],
  "Bật": ["On","चालू"],
  "Tắt": ["Off","बंद"],
  "Đã bật email cập nhật phản hồi.": ["Feedback update emails enabled.","प्रतिक्रिया अपडेट ईमेल चालू हैं।"],
  "Đã tắt email cập nhật phản hồi.": ["Feedback update emails disabled.","प्रतिक्रिया अपडेट ईमेल बंद हैं।"],
  "Không thể lưu cài đặt thông báo. Vui lòng thử lại.": ["Could not save notification preferences. Please try again.","सूचना सेटिंग सहेजी नहीं गई। पुनः प्रयास करें।"],
  "Không thể tải cài đặt thông báo. Vui lòng thử lại.": ["Could not load notification preferences. Please try again.","सूचना सेटिंग लोड नहीं हुई। पुनः प्रयास करें।"],
  "Đang tải cài đặt thông báo…": ["Loading notification preferences…","सूचना सेटिंग लोड हो रही हैं…"],
  "Dịch vụ email hiện chưa khả dụng. Bạn vẫn có thể tắt email cập nhật phản hồi.": ["Email delivery is currently unavailable. You can still turn off feedback update emails.","ईमेल सेवा अभी उपलब्ध नहीं है। आप फिर भी प्रतिक्रिया अपडेट ईमेल बंद कर सकते हैं।"],
  "Lựa chọn được lưu theo tài khoản trên mọi thiết bị, áp dụng cho các góp ý được xử lý từ lúc bật. Email khôi phục mật khẩu vẫn chỉ gửi khi bạn yêu cầu.": ["Your choice is saved to your account across devices and applies to feedback resolved after you enable it. Password recovery emails are still sent only on request.","आपकी पसंद खाते में सभी उपकरणों के लिए सहेजी जाती है और चालू करने के बाद हल की गई प्रतिक्रियाओं पर लागू होती है। पासवर्ड पुनर्प्राप्ति ईमेल केवल अनुरोध पर भेजे जाते हैं।"],
  "Không thể tải phương thức đăng nhập. Vui lòng thử lại.": ["Could not load sign-in methods. Please try again.", "साइन-इन तरीके लोड नहीं हुए। पुनः प्रयास करें।"],
  "Phiên đăng nhập đã cũ. Hãy đăng xuất và đăng nhập lại để xem các phiên khác.": ["Your sign-in needs to be renewed. Sign out and sign in again to view other sessions.", "अन्य सत्र देखने के लिए साइन आउट करके दोबारा साइन इन करें।"],
  "Không thể tải phiên đăng nhập. Vui lòng thử lại.": ["Could not load sessions. Please try again.", "सत्र लोड नहीं हुए। पुनः प्रयास करें।"],
  "Cần làm rõ": ["Clarification needed", "स्पष्टीकरण आवश्यक"],
  "Cần xác minh thêm": ["Needs verification", "सत्यापन आवश्यक"],
  "Có nguồn": ["Sources available", "स्रोत उपलब्ध हैं"],
  "Trợ lý DTU": ["DTU Assistant", "DTU सहायक"],
  "Chưa xử lý được": ["Unable to process", "संसाधित नहीं हो सका"],
  "Đang trả lời": ["Answering", "उत्तर दिया जा रहा है"],
  "Sao chép": ["Copy", "कॉपी करें"],
  "Đánh giá / Góp ý": ["Rate / Feedback", "मूल्यांकन / प्रतिक्रिया"],
  "Thử lại câu hỏi": ["Retry question", "प्रश्न पुनः पूछें"],
  "Xem bản đồ ↗": ["View map ↗", "नक्शा देखें ↗"],
  "Đã sao chép câu trả lời.": ["Answer copied.", "उत्तर कॉपी किया गया।"],
  "Bạn sẽ không thể dùng tài khoản Google này để đăng nhập cho đến khi liên kết lại.": ["You cannot sign in with this Google account until you link it again.", "दोबारा लिंक करने तक आप इस Google खाते से साइन इन नहीं कर पाएँगे।"],
  "Danh sách thiết bị là thông tin trình duyệt gửi; không dùng để xác định chính xác vị trí.": ["Device details come from the browser and do not identify an exact location.", "उपकरण की जानकारी ब्राउज़र से मिलती है; इससे सटीक स्थान पता नहीं चलता।"],
  "Các phiên khác sẽ phải đăng nhập lại. Phiên hiện tại vẫn được giữ.": ["Other sessions must sign in again. This session stays active.", "अन्य सत्रों को फिर से साइन इन करना होगा। वर्तमान सत्र सक्रिय रहेगा।"],
  "Bạn cần đăng nhập lại để tiếp tục sử dụng trên thiết bị này.": ["You will need to sign in again on this device.", "इस उपकरण पर फिर से साइन इन करना होगा।"],
  "Xuất toàn bộ hội thoại và nguồn thành JSON, hoặc chuyển lịch sử vào thùng rác để có thể khôi phục.": ["Export conversations and sources as JSON, or move history to trash for recovery.", "बातचीत और स्रोत JSON में निर्यात करें, या इतिहास को कचरा पेटी में भेजें।"],
  "Các liên kết chia sẻ sẽ bị thu hồi. Bạn có thể khôi phục từng hội thoại trong vòng 30 ngày; sau đó nội dung sẽ bị xóa vĩnh viễn.": ["Shared links will be revoked. Conversations can be restored within 30 days before permanent deletion.", "साझा लिंक बंद हो जाएँगे। बातचीत 30 दिनों के भीतर बहाल की जा सकती है, फिर स्थायी रूप से हटेगी।"],
  "Thiết bị không xác định": ["Unknown device", "अज्ञात उपकरण"],
  "Công cụ dòng lệnh": ["Command-line tool", "कमांड लाइन उपकरण"],
  "Trình duyệt khác": ["Other browser", "अन्य ब्राउज़र"],
  "Thiết bị khác": ["Other device", "अन्य उपकरण"],
  "Không thể đổi mật khẩu. Kiểm tra mật khẩu hiện tại và mật khẩu mới từ 12 ký tự.": ["Could not change password. Check your current password and use at least 12 characters for the new one.", "पासवर्ड नहीं बदला गया। वर्तमान पासवर्ड जाँचें और नए में कम से कम 12 अक्षर रखें।"],

  "Giao diện": ["Appearance", "दिखावट"],
  "Tùy chỉnh cách hiển thị trên trình duyệt này.": ["Customize this browser’s appearance.", "इस ब्राउज़र का रूप बदलें।"],
  "Chế độ hiển thị": ["Display mode", "प्रदर्शन मोड"],
  "Sáng, tối hoặc theo thiết bị": ["Light, dark or system", "हल्का, गहरा या सिस्टम"],
  "Sáng": ["Light", "हल्का"],
  "Tối": ["Dark", "गहरा"],
  "Theo thiết bị": ["System", "सिस्टम"],
  "Kích thước chữ": ["Text size", "अक्षर आकार"],
  "Phóng to giao diện để dễ đọc hơn": ["Enlarge the interface for easier reading", "पढ़ने के लिए अक्षर बड़े करें"],
  "Mặc định": ["Default", "डिफ़ॉल्ट"],
  "Lớn": ["Large", "बड़ा"],
  "Rất lớn": ["Extra large", "बहुत बड़ा"],
  "Cài đặt được lưu trên trình duyệt này và không tự đồng bộ sang thiết bị khác.": ["Appearance is saved in this browser and does not sync across devices.", "दिखावट इस ब्राउज़र में सहेजी जाती है और अन्य उपकरणों पर सिंक नहीं होती।"],
  "Thông báo": ["Notifications", "सूचनाएँ"],
  "Thông tin về các loại email và thông báo hiện có.": ["Information about available emails and notifications.", "उपलब्ध ईमेल और सूचनाओं की जानकारी।"],
  "Email khôi phục mật khẩu": ["Password recovery email", "पासवर्ड पुनर्प्राप्ति ईमेल"],
  "Gửi mã xác minh khi bạn yêu cầu lấy lại mật khẩu.": ["A verification code is sent when you request password recovery.", "पासवर्ड पुनर्प्राप्ति का अनुरोध करने पर सत्यापन कोड भेजा जाता है।"],
  "Theo yêu cầu": ["On request", "अनुरोध पर"],
  "Cập nhật phản hồi và thông báo khác": ["Feedback updates and other notifications", "प्रतिक्रिया अपडेट और अन्य सूचनाएँ"],
  "Hệ thống chưa gửi các email này; không cần bật hay tắt.": ["These emails are not sent yet; no switch is needed.", "ये ईमेल अभी नहीं भेजे जाते; कोई स्विच आवश्यक नहीं है।"],
  "Chưa triển khai": ["Not available", "उपलब्ध नहीं"],
  "Mã khôi phục chỉ được gửi khi bạn chủ động yêu cầu trên trang đăng nhập.": ["A recovery code is sent only when you request one on the login page.", "लॉगिन पृष्ठ पर अनुरोध करने पर ही पुनर्प्राप्ति कोड भेजा जाता है।"],
  "Đổi mật khẩu": ["Change password", "पासवर्ड बदलें"],
  "Sau khi đổi mật khẩu, các phiên đăng nhập khác sẽ được đăng xuất.": ["Other sessions are signed out after you change your password.", "पासवर्ड बदलने के बाद अन्य सत्रों से साइन आउट हो जाएगा।"],
  "Mật khẩu hiện tại": ["Current password", "वर्तमान पासवर्ड"],
  "Mật khẩu mới": ["New password", "नया पासवर्ड"],
  "Từ 12 đến 128 ký tự.": ["12 to 128 characters.", "12 से 128 अक्षर।"],
  "Xác nhận mật khẩu mới": ["Confirm new password", "नए पासवर्ड की पुष्टि करें"],
  "Lưu mật khẩu mới": ["Save new password", "नया पासवर्ड सहेजें"],
  "Tài khoản": ["Account", "खाता"],
  "Quản lý thông tin cá nhân và phương thức đăng nhập của bạn.": ["Manage your personal information and sign-in methods.", "अपनी व्यक्तिगत जानकारी और साइन-इन तरीके प्रबंधित करें।"],
  "Chỉnh sửa hồ sơ →": ["Edit profile →", "प्रोफ़ाइल संपादित करें →"],
  "Đăng nhập bằng Google": ["Sign in with Google", "Google से साइन इन करें"],
  "Đã liên kết": ["Linked", "लिंक किया गया"],
  "Chưa liên kết": ["Not linked", "लिंक नहीं है"],
  "Đang tải phương thức đăng nhập…": ["Loading sign-in methods…", "साइन-इन तरीके लोड हो रहे हैं…"],
  "Tài khoản đã liên kết với Google.": ["Your account is linked to Google.", "आपका खाता Google से जुड़ा है।"],
  "Chưa liên kết Google.": ["Google is not linked.", "Google लिंक नहीं है।"],
  "Hủy liên kết Google?": ["Unlink Google?", "Google लिंक हटाएँ?"],
  "Hủy liên kết": ["Unlink", "लिंक हटाएँ"],
  "Hủy liên kết Google": ["Unlink Google", "Google लिंक हटाएँ"],
  "Liên kết Google": ["Link Google", "Google लिंक करें"],
  "Không thể gỡ phương thức đăng nhập duy nhất của bạn.": ["Your only sign-in method cannot be removed.", "आपका एकमात्र साइन-इन तरीका हटाया नहीं जा सकता।"],
  "Bảo mật và phiên đăng nhập": ["Security and sign-in sessions", "सुरक्षा और साइन-इन सत्र"],
  "Quên mật khẩu? Chọn “Quên mật khẩu?” trên trang đăng nhập để khôi phục qua email.": ["Forgot your password? Choose “Forgot password?” on the login page to recover it by email.", "पासवर्ड भूल गए? ईमेल से पुनर्प्राप्ति के लिए लॉगिन पृष्ठ पर “पासवर्ड भूल गए?” चुनें।"],
  "Thử tải lại": ["Retry", "पुनः प्रयास करें"],
  "Đang tải phiên đăng nhập…": ["Loading sessions…", "सत्र लोड हो रहे हैं…"],
  "Không có phiên nào để hiển thị.": ["No sessions to display.", "दिखाने के लिए कोई सत्र नहीं है।"],
  "Hoạt động:": ["Active:", "सक्रिय:"],
  "Đăng xuất các thiết bị khác?": ["Sign out other devices?", "अन्य उपकरणों से साइन आउट करें?"],
  "Đăng xuất các phiên khác": ["Sign out other sessions", "अन्य सत्रों से साइन आउट करें"],
  "Đăng xuất tài khoản?": ["Sign out?", "साइन आउट करें?"],
  "Đăng xuất": ["Sign out", "साइन आउट"],
  "Đăng xuất tài khoản này": ["Sign out this account", "इस खाते से साइन आउट करें"],
  "Dữ liệu và quyền riêng tư": ["Data and privacy", "डेटा और गोपनीयता"],
  "Xuất dữ liệu hội thoại": ["Export conversation data", "बातचीत का डेटा निर्यात करें"],
  "Chuyển toàn bộ lịch sử vào thùng rác?": ["Move all history to trash?", "सारा इतिहास कचरा पेटी में भेजें?"],
  "Xóa lịch sử hội thoại": ["Delete conversation history", "बातचीत का इतिहास हटाएँ"],
  "Lịch sử hội thoại →": ["Conversation history →", "बातचीत का इतिहास →"],
  "Hỗ trợ": ["Support", "सहायता"],
  "Tìm câu trả lời hoặc gửi góp ý cho nhóm quản trị.": ["Find answers or send feedback to administrators.", "उत्तर खोजें या प्रशासकों को प्रतिक्रिया भेजें।"],
  "Trung tâm trợ giúp và FAQ →": ["Help centre and FAQ →", "सहायता केंद्र और प्रश्न →"],
  "Gửi góp ý hoặc báo lỗi →": ["Send feedback or report an issue →", "प्रतिक्रिया भेजें या समस्या बताएँ →"],
  "Phiên bản ứng dụng: 0.1.0": ["Application version: 0.1.0", "ऐप संस्करण: 0.1.0"],
  "Không thể tải thông tin đăng nhập. Vui lòng thử lại.": ["Could not load sign-in details. Please try again.", "साइन-इन जानकारी लोड नहीं हुई। पुनः प्रयास करें।"],
  "Không thể hoàn thành thao tác. Vui lòng thử lại.": ["Could not complete the action. Please try again.", "कार्रवाई पूरी नहीं हुई। पुनः प्रयास करें।"],
  "Mật khẩu xác nhận chưa khớp.": ["Passwords do not match.", "पासवर्ड मेल नहीं खाते।"],
  "Mật khẩu mới cần khác mật khẩu hiện tại.": ["The new password must differ from the current password.", "नया पासवर्ड वर्तमान पासवर्ड से अलग होना चाहिए।"],
  "Đã đổi mật khẩu và đăng xuất các phiên khác.": ["Password changed and other sessions signed out.", "पासवर्ड बदल दिया गया और अन्य सत्र बंद किए गए।"],
  "Đã lưu cài đặt giao diện trên trình duyệt này.": ["Appearance saved in this browser.", "दिखावट इस ब्राउज़र में सहेजी गई।"],
  "Không thể đọc cài đặt trên trình duyệt này.": ["Could not read browser settings.", "ब्राउज़र सेटिंग पढ़ी नहीं जा सकी।"],
  "Không thể lưu. Hãy kiểm tra quyền lưu trữ của trình duyệt.": ["Could not save. Check browser storage permissions.", "सहेजा नहीं जा सका। ब्राउज़र संग्रहण अनुमतियाँ जाँचें।"],
  "Đã hủy liên kết Google.": ["Google unlinked.", "Google लिंक हटा दिया गया।"],
  "Đã đăng xuất các phiên khác.": ["Other sessions signed out.", "अन्य सत्रों से साइन आउट किया गया।"],
  "Đã xuất dữ liệu hội thoại.": ["Conversation data exported.", "बातचीत का डेटा निर्यात किया गया।"],

  "Chờ xử lý": ["Pending", "लंबित"],
  "Đã xử lý": ["Resolved", "हल किया गया"],
  "Đã lưu": ["Saved", "सहेजा गया"],
  "Hoàn tất": ["Completed", "पूर्ण"],
  "Lịch sử hỏi đáp": [
    "Chat history",
    "चैट इतिहास"
  ],
  "Mọi cuộc trò chuyện, sẵn sàng khi bạn cần quay lại.": [
    "Your conversations, ready whenever you return.",
    "आपकी बातचीत, जब भी आप लौटें।"
  ],
  "Hội thoại mới": [
    "New conversation",
    "नई बातचीत"
  ],
  "Chế độ xem lịch sử": [
    "History view",
    "इतिहास दृश्य"
  ],
  "Thùng rác": [
    "Trash",
    "कचरा पेटी"
  ],
  "Hội thoại": [
    "Conversations",
    "बातचीत"
  ],
  "Tìm tên hoặc nội dung…": [
    "Search by title or content…",
    "शीर्षक या सामग्री खोजें…"
  ],
  "Đã chuyển vào thùng rác": [
    "Moved to trash",
    "कचरा पेटी में भेजा गया"
  ],
  "Cập nhật": [
    "Updated",
    "अपडेट किया गया"
  ],
  "Đang khôi phục…": [
    "Restoring…",
    "बहाल किया जा रहा है…"
  ],
  "Khôi phục": [
    "Restore",
    "बहाल करें"
  ],
  "Xóa vĩnh viễn": [
    "Delete permanently",
    "हमेशा के लिए हटाएँ"
  ],
  "Đổi tên": [
    "Rename",
    "नाम बदलें"
  ],
  "Xóa": [
    "Delete",
    "हटाएँ"
  ],
  "Không tìm thấy hội thoại": [
    "No conversations found",
    "कोई बातचीत नहीं मिली"
  ],
  "Thùng rác đang trống": [
    "Trash is empty",
    "कचरा पेटी खाली है"
  ],
  "Chưa có cuộc trò chuyện nào": [
    "No conversations yet",
    "अभी कोई बातचीत नहीं है"
  ],
  "Thử từ khóa khác hoặc kiểm tra mục thùng rác.": [
    "Try another keyword or check the trash.",
    "दूसरा शब्द खोजें या कचरा पेटी देखें।"
  ],
  "Hội thoại bạn xóa sẽ xuất hiện ở đây.": [
    "Deleted conversations appear here.",
    "हटाई गई बातचीत यहाँ दिखाई देगी।"
  ],
  "Bắt đầu một câu hỏi, trợ lý sẽ lưu lại để bạn tiếp tục sau.": [
    "Ask a question and return to the conversation later.",
    "प्रश्न पूछें और बाद में बातचीत जारी रखें।"
  ],
  "Hỏi trợ lý": [
    "Ask assistant",
    "सहायक से पूछें"
  ],
  "Đã khôi phục hội thoại.": [
    "Conversation restored.",
    "बातचीत बहाल कर दी गई।"
  ],
  "Xóa vĩnh viễn hội thoại?": [
    "Permanently delete conversation?",
    "बातचीत हमेशा के लिए हटाएँ?"
  ],
  "Đã xóa vĩnh viễn hội thoại.": [
    "Conversation permanently deleted.",
    "बातचीत हमेशा के लिए हटा दी गई।"
  ],
  "Đổi tên hội thoại": [
    "Rename conversation",
    "बातचीत का नाम बदलें"
  ],
  "Chuyển hội thoại vào thùng rác?": [
    "Move conversation to trash?",
    "बातचीत कचरा पेटी में भेजें?"
  ],
  "Tên hội thoại": [
    "Conversation title",
    "बातचीत का शीर्षक"
  ],
  "Hủy": [
    "Cancel",
    "रद्द करें"
  ],
  "Đang lưu…": [
    "Saving…",
    "सहेजा जा रहा है…"
  ],
  "Lưu tên": [
    "Save title",
    "नाम सहेजें"
  ],
  "Chuyển vào thùng rác": [
    "Move to trash",
    "कचरा पेटी में भेजें"
  ],
  "Đã đổi tên hội thoại.": [
    "Conversation renamed.",
    "बातचीत का नाम बदल दिया गया।"
  ],
  "Đã chuyển vào thùng rác. Bạn có thể khôi phục trong lịch sử.": [
    "Moved to trash. You can restore it from history.",
    "कचरा पेटी में भेज दिया गया। आप इसे इतिहास से बहाल कर सकते हैं।"
  ],
  "Góp ý để trợ lý tốt hơn": [
    "Help improve the assistant",
    "सहायक को बेहतर बनाने में मदद करें"
  ],
  "Phản hồi được lưu và chuyển tới quản trị viên để xem xét.": [
    "Feedback is saved and sent to administrators for review.",
    "प्रतिक्रिया सहेजकर समीक्षा के लिए प्रशासकों को भेजी जाती है।"
  ],
  "Chia sẻ trải nghiệm của bạn": [
    "Share your experience",
    "अपना अनुभव साझा करें"
  ],
  "Câu hỏi và câu trả lời được góp ý": [
    "Question and answer being reviewed",
    "समीक्षा किया जा रहा प्रश्न और उत्तर"
  ],
  "Câu hỏi của bạn": [
    "Your question",
    "आपका प्रश्न"
  ],
  "Không tìm thấy câu hỏi trước đó.": [
    "Previous question not found.",
    "पिछला प्रश्न नहीं मिला।"
  ],
  "Câu trả lời được chọn": [
    "Selected answer",
    "चुना गया उत्तर"
  ],
  "Đánh giá của bạn": [
    "Your rating",
    "आपकी रेटिंग"
  ],
  "Loại phản hồi": [
    "Feedback category",
    "प्रतिक्रिया का प्रकार"
  ],
  "Nội dung câu trả lời": [
    "Answer content",
    "उत्तर की सामग्री"
  ],
  "Nguồn trích dẫn": [
    "Cited sources",
    "उद्धृत स्रोत"
  ],
  "Thiếu thông tin": [
    "Missing information",
    "जानकारी की कमी"
  ],
  "Trải nghiệm ứng dụng": [
    "Application experience",
    "ऐप का अनुभव"
  ],
  "Nội dung góp ý": [
    "Your feedback",
    "आपकी प्रतिक्रिया"
  ],
  "Mô tả điểm cần kiểm tra hoặc điều bạn thấy hữu ích…": [
    "Describe what needs checking or what you found helpful…",
    "बताएँ कि क्या जाँचना चाहिए या क्या उपयोगी लगा…"
  ],
  "Đang gửi…": [
    "Sending…",
    "भेजा जा रहा है…"
  ],
  "Gửi góp ý": [
    "Send feedback",
    "प्रतिक्रिया भेजें"
  ],
  "Góp ý đã gửi": [
    "Submitted feedback",
    "भेजी गई प्रतिक्रिया"
  ],
  "Bạn chưa gửi phản hồi nào.": [
    "You have not sent any feedback yet.",
    "आपने अभी कोई प्रतिक्रिया नहीं भेजी है।"
  ],
  "Vui lòng chọn mức đánh giá.": [
    "Please select a rating.",
    "कृपया रेटिंग चुनें।"
  ],
  "Phản hồi từ quản trị": [
    "Administrator response",
    "प्रशासक का उत्तर"
  ],
  "Phản hồi của bạn": [
    "Your feedback",
    "आपकी प्रतिक्रिया"
  ],
  "Theo dõi trạng thái góp ý trong tài khoản.": [
    "Track feedback status in your account.",
    "अपने खाते में प्रतिक्रिया की स्थिति देखें।"
  ],
  "ĐÃ GHI NHẬN": [
    "RECEIVED",
    "प्राप्त हुआ"
  ],
  "Cảm ơn bạn đã góp ý": [
    "Thank you for your feedback",
    "आपकी प्रतिक्रिया के लिए धन्यवाद"
  ],
  "Góp ý đã được lưu để quản trị viên kiểm tra.": [
    "Your feedback has been saved for review.",
    "आपकी प्रतिक्रिया समीक्षा के लिए सहेज ली गई है।"
  ],
  "Mã phản hồi": [
    "Feedback ID",
    "प्रतिक्रिया आईडी"
  ],
  "Không tìm thấy phản hồi này trong tài khoản của bạn.": [
    "This feedback was not found in your account.",
    "आपके खाते में यह प्रतिक्रिया नहीं मिली।"
  ],
  "Tiếp tục hỏi trợ lý": [
    "Continue chatting",
    "बातचीत जारी रखें"
  ],
  "Xem góp ý đã gửi": [
    "View submitted feedback",
    "भेजी गई प्रतिक्रिया देखें"
  ],
  "Thông tin tài khoản": [
    "Account information",
    "खाते की जानकारी"
  ],
  "Quản lý hồ sơ của bạn trong ứng dụng trợ lý học vụ.": [
    "Manage your profile in the academic assistant.",
    "शैक्षणिक सहायक में अपनी प्रोफ़ाइल प्रबंधित करें।"
  ],
  "Chỉnh sửa hồ sơ": [
    "Edit profile",
    "प्रोफ़ाइल संपादित करें"
  ],
  "Hồ sơ cơ bản": [
    "Basic profile",
    "मूल प्रोफ़ाइल"
  ],
  "Họ tên": [
    "Full name",
    "पूरा नाम"
  ],
  "Mã sinh viên": [
    "Student ID",
    "छात्र आईडी"
  ],
  "Khóa": [
    "Cohort",
    "बैच"
  ],
  "Chuyên ngành": [
    "Major",
    "विषय"
  ],
  "Ví dụ: K29": [
    "For example: K29",
    "उदाहरण: K29"
  ],
  "Email và vai trò được quản lý theo tài khoản đăng nhập.": [
    "Email and role are managed through your login account.",
    "ईमेल और भूमिका आपके लॉगिन खाते से प्रबंधित होते हैं।"
  ],
  "Lưu hồ sơ": [
    "Save profile",
    "प्रोफ़ाइल सहेजें"
  ],
  "Vai trò": [
    "Role",
    "भूमिका"
  ],
  "Quản trị viên": [
    "Administrator",
    "प्रशासक"
  ],
  "Sinh viên": [
    "Student",
    "छात्र"
  ],
  "Chưa cập nhật": [
    "Not provided",
    "दर्ज नहीं किया गया"
  ],
  "Đây là hồ sơ của ứng dụng, chưa đồng bộ với myDTU.": [
    "This application profile is not synced with myDTU.",
    "यह ऐप प्रोफ़ाइल myDTU से सिंक नहीं है।"
  ],
  "Đã cập nhật hồ sơ.": [
    "Profile updated.",
    "प्रोफ़ाइल अपडेट की गई।"
  ],
  "Trước": [
    "Previous",
    "पिछला"
  ],
  "Sau": [
    "Next",
    "अगला"
  ],
  "Đang tải dữ liệu…": [
    "Loading…",
    "लोड हो रहा है…"
  ],
  "Thử lại": [
    "Retry",
    "पुनः प्रयास करें"
  ],
  "Đang xử lý…": [
    "Processing…",
    "प्रक्रिया जारी है…"
  ],
  "Không xác định được phương thức đăng nhập. Vui lòng liên hệ quản trị viên.": ["Unable to identify your sign-in method. Contact an administrator.", "साइन-इन विधि की पहचान नहीं हो सकी। व्यवस्थापक से संपर्क करें।"],
  "Bạn đã tạo mật khẩu ứng dụng.": ["Your app password is ready.", "आपका ऐप पासवर्ड बन गया है।"],
  "Mật khẩu ứng dụng": ["App password", "ऐप का पासवर्ड"],
  "Đây là mật khẩu ứng dụng, không phải mật khẩu Google.": ["This is your app password, not your Google password.", "यह ऐप का पासवर्ड है, Google का पासवर्ड नहीं।"],
  "Tạo mật khẩu đăng nhập": ["Create sign-in password", "साइन-इन पासवर्ड बनाएँ"],
  "Tài khoản của bạn chưa có mật khẩu ứng dụng. Mật khẩu này tách biệt với mật khẩu Google.": ["Your account has no app password yet. It is separate from your Google password.", "आपके खाते का ऐप पासवर्ड अभी नहीं है। यह Google पासवर्ड से अलग है।"],
  "Chưa thể gửi mã xác minh qua email. Vui lòng liên hệ quản trị viên.": ["Email verification is unavailable. Contact an administrator.", "ईमेल सत्यापन उपलब्ध नहीं है। व्यवस्थापक से संपर्क करें।"],
  "Mã xác minh sẽ được gửi đến email tài khoản đang đăng nhập. Mã có hiệu lực 5 phút.": ["A verification code will be sent to your account email. It expires in 5 minutes.", "सत्यापन कोड आपके खाते के ईमेल पर भेजा जाएगा। यह 5 मिनट तक मान्य है।"],
  "Mã xác minh đã được gửi đến:": ["A verification code was sent to:", "सत्यापन कोड यहाँ भेजा गया:"],
  "Nhập mã xác minh": ["Enter verification code", "सत्यापन कोड दर्ज करें"],
  "Mã xác minh": ["Verification code", "सत्यापन कोड"],
  "Gửi mã": ["Send code", "कोड भेजें"],
  "Xác minh mã": ["Verify code", "कोड सत्यापित करें"],
  "Gửi lại mã": ["Resend code", "कोड फिर भेजें"],
  "Tạo mật khẩu mới": ["Create new password", "नया पासवर्ड बनाएँ"],
  "Nhập mật khẩu mới cho tài khoản của bạn.": ["Enter a new password for your account.", "अपने खाते के लिए नया पासवर्ड दर्ज करें।"],
  "Đã tạo mật khẩu ứng dụng. Vì lý do bảo mật, hãy đăng nhập lại.": ["App password created. For security, please sign in again.", "ऐप पासवर्ड बन गया। सुरक्षा के लिए फिर से साइन इन करें।"],
  "Về đăng nhập": ["Go to sign in", "साइन इन पर जाएँ"],
  "Không thể gửi mã lúc này. Vui lòng chờ rồi thử lại.": ["Unable to send a code. Please wait and try again.", "कोड नहीं भेजा जा सका। थोड़ी देर बाद फिर प्रयास करें।"],
  "Mã hợp lệ. Bạn hãy tạo mật khẩu mới.": ["Code verified. Create your new password.", "कोड सत्यापित हुआ। नया पासवर्ड बनाएँ।"],
  "Mã không đúng, đã hết hạn hoặc bạn đã thử quá nhiều lần. Hãy thử lại hoặc gửi mã mới.": ["The code is invalid, expired, or too many attempts were made. Try again or request a new code.", "कोड गलत है, समाप्त हो गया है या बहुत अधिक प्रयास हुए हैं। नया कोड माँगें।"],
  "Nếu địa chỉ hợp lệ cho yêu cầu này, mã sẽ được gửi. Vui lòng kiểm tra hộp thư và thư rác.": ["If the address is eligible, a code will be sent. Check your inbox and spam folder.", "यदि पता मान्य है, कोड भेजा जाएगा। इनबॉक्स और स्पैम देखें।"],

};
export function studentPageText(language: UiLanguage, text: string): string {
  const value = messages[text];
  return language === "vi" || !value ? text : value[language === "en" ? 0 : 1];
}

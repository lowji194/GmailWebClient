const PIN = "123456"; // Mã PIN để xác thực
const PIN_EXPIRY_DAYS = 30; // Thời hạn PIN (ngày)
const filterEnabled = false; // Kiểm soát việc lọc email

// Lọc email theo tiêu đề hoặc người gửi nếu filterEnabled là true
function filterEmails(emails) {
  if (filterEnabled) {
    const excludeSubjects = ['Khuyến mãi', 'Bản tin'];
    const excludeSenders = ['no-reply@example.com', 'marketing@example.com'];
    return emails.filter(email => 
      !excludeSubjects.some(subject => email.subject.toLowerCase().includes(subject.toLowerCase())) &&
      !excludeSenders.some(sender => email.from.toLowerCase().includes(sender.toLowerCase()))
    );
  }
  return emails;
}

// Xử lý yêu cầu GET để hiển thị giao diện HTML
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Ứng dụng đọc Gmail')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Xử lý yêu cầu POST để trả về email dưới dạng JSON
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const pin = params.pin;
    const limit = parseInt(params.limit) || 100;
    const type = params.type || 'inbox';

    if (!validatePin(pin)) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: 'Mã PIN không đúng' })
      )
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader('Access-Control-Allow-Origin', '*');
    }

    let emails;
    if (type === 'inbox') {
      emails = getAllEmailsWithHtml(limit);
    } else if (type === 'spam') {
      emails = getAllSpamEmailsWithHtml(limit);
    } else {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: 'Loại email không hợp lệ. Sử dụng "inbox" hoặc "spam".' })
      )
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader('Access-Control-Allow-Origin', '*');
    }

    emails = filterEmails(emails);

    return ContentService.createTextOutput(
      JSON.stringify({ success: true, data: emails })
    )
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*');
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.message })
    )
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*');
  }
}

// Kiểm tra mã PIN
function validatePin(pin) {
  return pin === PIN;
}

// Lấy thời hạn PIN
function getPinExpiryDays() {
  return PIN_EXPIRY_DAYS;
}

// Xử lý danh sách thread thành danh sách email JSON
function getEmailsWithHtml(threads) {
  let emails = threads.map(thread => {
    const messages = thread.getMessages();
    return messages.map(msg => {
      const date = msg.getDate();
      const fullDate = date ? date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh'
      }) : 'N/A';
      return {
        id: msg.getId(),
        from: msg.getFrom(),
        subject: msg.getSubject(),
        date: fullDate,
        snippet: msg.getPlainBody().substring(0, 200) + '...',
        isUnread: msg.isUnread(),
        html: msg.getBody() || '<p>Không tìm thấy nội dung HTML.</p>'
      };
    });
  }).flat();

  emails = filterEmails(emails);
  return emails;
}

// Lấy email từ hộp thư đến
function getAllEmailsWithHtml(limit = 100) {
  const threads = GmailApp.getInboxThreads(0, limit);
  return getEmailsWithHtml(threads);
}

// Lấy email từ thư mục spam
function getAllSpamEmailsWithHtml(limit = 100) {
  const threads = GmailApp.search("in:spam", 0, limit);
  return getEmailsWithHtml(threads);
}

// Đánh dấu email là đã đọc
function markAsRead(messageId) {
  const message = GmailApp.getMessageById(messageId);
  if (message && message.isUnread()) {
    message.markRead();
  }
}

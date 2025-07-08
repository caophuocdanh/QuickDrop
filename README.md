# QuickDrop - Ứng Dụng Chuyển File P2P

Một ứng dụng chuyển file ngang hàng (peer-to-peer) hiện đại sử dụng công nghệ WebRTC, cho phép chia sẻ file trực tiếp giữa các thiết bị mà không cần lưu trữ trên server.

## ✨ Tính Năng Chính

### 🚀 Tính Năng Cốt Lõi
- **Chuyển File Đơn Lẻ**: Gửi từng file một để kiểm soát tốt hơn
- **Theo Dõi Tiến Độ Thời Gian Thực**: Hiển thị phần trăm chính xác (định dạng 12.34%)
- **Kết Nối P2P**: Chuyển file trực tiếp không qua server trung gian
- **Kéo Thả**: Giao diện chọn file trực quan và dễ sử dụng
- **Hệ Thống Phòng**: Kết nối an toàn thông qua mã phòng 4 chữ số

### 🔧 Tính Năng Nâng Cao
- **Khôi Phục Kết Nối**: Tự động kết nối lại với chiến lược backoff mũ
- **Tương Thích Trình Duyệt**: Hỗ trợ polyfill cho các trình duyệt cũ
- **Phím Tắt**: Ctrl+O để chọn file, ESC để hủy, Enter để vào phòng
- **Giám Sát Mạng**: Phát hiện trạng thái online/offline
- **Danh Sách Chuyển File Thống Nhất**: Bảng hiển thị tất cả file với biểu tượng
- **Biểu Tượng Trực Quan**: ⬆️ cho upload, ⬇️ cho download
- **Trạng Thái Chuyển File**: Hiển thị trạng thái thời gian thực với mã màu và hoạt ảnh
- **Chunk File**: Chia file thành khối 16KB để tối ưu hiệu suất
- **Kiểm Soát Backpressure**: Ngăn chặn tràn bộ đệm

## 🚀 Bắt Đầu Nhanh

### 1. Cài Đặt Dependencies
```powershell
npm install
```

### 2. Khởi Động Server
```powershell
npm start
```

### 3. Mở Trình Duyệt
- Truy cập `http://localhost:5000`
- Mở cùng URL trong tab/trình duyệt khác để test

## 🎯 Hướng Dẫn Sử Dụng

### Tạo Phòng Mới
1. Nhấp "Tạo Phòng" để tạo mã phòng 4 chữ số
2. Chia sẻ mã này với người bạn muốn chuyển file

### Tham Gia Phòng
1. Nhập mã phòng được cung cấp
2. Nhấp "Tham Gia Phòng" hoặc nhấn Enter

### Chuyển File
1. Đợi trạng thái "Đã kết nối!" xuất hiện
2. Kéo thả file hoặc nhấp để chọn (phím tắt Ctrl+O)
3. Theo dõi tiến độ chuyển file với:
   - Phần trăm chính xác (định dạng 12.34%)
   - Kích thước file hiện tại/tổng
   - Tốc độ chuyển (MB/s)
4. File xuất hiện trong danh sách với biểu tượng ⬆️ và trạng thái "Đang gửi"
5. Chức năng chọn file bị vô hiệu hóa trong quá trình chuyển

### Nhận File
1. File nhận được xuất hiện trong danh sách với biểu tượng ⬇️
2. Trạng thái hiển thị "Đang nhận" với hoạt ảnh
3. Khi hoàn thành, trạng thái hiển thị nút "Tải xuống"
4. Nhấp để tải file về máy

### Giao Diện Danh Sách Chuyển File
Danh sách thống nhất hiển thị:
- **Biểu Tượng**: ⬆️ cho upload, ⬇️ cho download  
- **Tên File**: Tên file đầy đủ với xử lý overflow
- **Kích Thước**: Kích thước file ở định dạng dễ đọc (KB/MB/GB)
- **Trạng Thái**: Trạng thái chuyển file hiện tại với mã màu

### Các Trạng Thái File
- **Đang gửi**: File đang được upload (màu vàng có hoạt ảnh)
- **Đã gửi**: File upload thành công (màu xanh lá)
- **Đang nhận**: File đang được download (màu xanh dương có hoạt ảnh)  
- **Đã nhận**: File sẵn sàng với nút tải xuống (màu xanh lá)

### Phím Tắt
- **Ctrl+O**: Mở hộp thoại chọn file
- **ESC**: Hủy chuyển file (có xác nhận)
- **Enter**: Tham gia phòng (khi đang focus vào ô nhập mã phòng)

## 🔧 Chi Tiết Kỹ Thuật

### Tương Thích Trình Duyệt
- **Chrome**: 56+
- **Firefox**: 44+
- **Safari**: 11+
- **Edge**: 79+

### Kiến Trúc Hệ Thống
```
┌─────────────────┐    WebRTC P2P     ┌─────────────────┐
│   Người Gửi     │ ←──────────────→  │   Người Nhận    │
│   (Sender)      │                   │   (Receiver)    │
└─────────────────┘                   └─────────────────┘
         │                                     │
         │          Socket.IO Signaling        │
         └─────────────────┬───────────────────┘
                           │
                  ┌─────────────────┐
                  │  Server Node.js │
                  │  (Express +     │
                  │   Socket.IO)    │
                  └─────────────────┘
```

### Khôi Phục Kết Nối
- Tự động thử kết nối lại (tối đa 5 lần)
- Chiến lược exponential backoff
- Chỉ báo trạng thái kết nối trực quan
- Lưu trữ thông tin phòng để khôi phục

### Giới Hạn Chuyển File
- **Chỉ một file**: Một file mỗi phiên chuyển
- **Kích thước chunk**: 16KB để tối ưu hiệu suất
- **Kiểm soát backpressure**: Ngăn chặn tràn bộ đệm
- **Không giới hạn kích thước file**: Phụ thuộc vào bộ nhớ trình duyệt

## 🛠️ Phát Triển & Triển Khai

### Cấu Trúc File
```
QuickDrop/
├── index.js          # Server Express & Socket.IO signaling
├── index.html        # Giao diện chính với favicon base64
├── script.js         # Logic WebRTC & chuyển file (687 dòng)
├── style.css         # Styling responsive hiện đại (847 dòng)
├── package.json      # Dependencies và scripts
├── favicon.ico       # Icon ứng dụng
└── README.md         # Tài liệu này
```

### Công Nghệ Chính
- **WebRTC**: Giao tiếp peer-to-peer với mã hóa tự động
- **Socket.IO**: Server signaling cho thiết lập kết nối
- **Express.js**: Web server nhẹ
- **File System Access API**: Xử lý file lớn
- **ArrayBuffer**: Xử lý dữ liệu nhị phân
- **Blob API**: Tạo và xử lý file objects

### Scripts Có Sẵn
```powershell
# Khởi động server production
npm start

# Khởi động server development  
npm run dev

# Test kết nối
npm run test-connection
```

### Cấu Hình Server
- **Port mặc định**: 5000 (có thể thay đổi qua biến môi trường PORT)
- **Giới hạn phòng**: Tối đa 2 người/phòng
- **Timeout kết nối**: Automatic cleanup khi disconnect
- **CORS**: Cho phép tất cả origins (cần cấu hình cho production)

## 🔒 Bảo Mật

### Bảo Mật WebRTC
- **Mã hóa tự động**: WebRTC cung cấp mã hóa DTLS và SRTP
- **Không lưu trữ server**: File không bao giờ đi qua server
- **Kết nối trực tiếp**: P2P giảm thiểu rủi ro trung gian
- **Kiểm soát truy cập**: Mã phòng 4 chữ số cung cấp bảo mật cơ bản

### Khuyến Nghị Bảo Mật
- Sử dụng HTTPS trong production
- Thêm xác thực người dùng cho môi trường doanh nghiệp
- Giới hạn kích thước file upload
- Implement rate limiting
- Logging và monitoring

## 🐛 Xử Lý Sự Cố

### Vấn Đề Kết Nối
- **Kiểm tra tương thích trình duyệt**: Đảm bảo Chrome 56+, Firefox 44+, etc.
- **Cùng phòng**: Đảm bảo cả hai người dùng trong cùng mã phòng
- **Refresh khi thất bại**: Làm mới trang nếu kết nối thất bại
- **Cài đặt mạng/firewall**: Kiểm tra các cài đặt chặn WebRTC
- **NAT traversal**: Một số mạng có thể cần STUN/TURN server

### Vấn Đề Chuyển File
- **Chỉ chọn một file**: Hệ thống chỉ hỗ trợ một file mỗi lần
- **Đợi trạng thái kết nối**: Đợi "Đã kết nối!" trước khi chuyển
- **File lớn**: File lớn có thể cần thao tác lưu thủ công
- **Dung lượng**: Kiểm tra dung lượng trống trên thiết bị nhận
- **Timeout**: Kết nối có thể timeout với file rất lớn

### Debug Mode
Mở Developer Tools (F12) để xem console logs chi tiết:
- Trạng thái WebRTC connection
- Socket.IO events
- File transfer progress
- Error messages

## 📊 Hiệu Suất

### Tối Ưu Hóa
- **Chunk size**: 16KB tối ưu cho tốc độ và ổn định
- **Backpressure handling**: Ngăn buffer overflow
- **Memory management**: Efficient ArrayBuffer usage
- **Progress updates**: Throttled để tránh UI lag

### Benchmark
- **LAN**: ~100-1000 Mbps (phụ thuộc hardware)
- **Internet**: Phụ thuộc bandwidth và latency
- **File size**: Không giới hạn lý thuyết (giới hạn bởi RAM)

## 🔮 Tính Năng Tương Lai

### Đã Lên Kế Hoạch
- [ ] Chuyển nhiều file cùng lúc
- [ ] Chat text trong phòng
- [ ] Video call tích hợp
- [ ] Mã hóa end-to-end bổ sung
- [ ] Mobile app (React Native/Flutter)
- [ ] Room password protection
- [ ] File preview trước khi tải
- [ ] Transfer history
- [ ] Dark/Light theme toggle

### Contribution
Contributions được chào đón! Vui lòng:
1. Fork repository
2. Tạo feature branch
3. Test kỹ lưỡng các thay đổi
4. Submit pull request với mô tả chi tiết

## 📜 Giấy Phép

**ISC License** - Tự do sử dụng và chỉnh sửa cho các dự án của bạn.

## 🤝 Liên Hệ & Hỗ Trợ

- **Issues**: Báo cáo lỗi qua GitHub Issues
- **Feature Requests**: Đề xuất tính năng mới
- **Documentation**: Góp ý cải thiện tài liệu

---

**Lưu Ý**: Ứng dụng hoạt động tốt nhất trên các trình duyệt hiện đại hỗ trợ WebRTC. Đối với sử dụng production, nên thêm xác thực và các cải tiến bảo mật.
# QuickDrop

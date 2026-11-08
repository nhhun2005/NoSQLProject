# Kết quả triển khai các mục đã chọn — 08/11/2026

Đã triển khai 23 mục được chọn. Trang chủ chuyển thành hướng dẫn sử dụng website; không còn nhắc dự án tháng 9/2026. Các thay đổi chỉ nằm trong source, cấu hình chạy ứng dụng, tài liệu và kiểm thử. Không chỉnh sửa model/schema, migration hoặc index, không thực hiện lệnh cập nhật dữ liệu thật.

## Các mục đã xử lý

- [x] UI05 · Nút và menu thiếu hỗ trợ bàn phím, input thiếu nhãn
- [x] UI06 · Thông báo form không chỉ đúng trường lỗi
- [x] UI07 · Chữ phụ và lỗi khó đọc trên nền kính
- [x] UI08 · Trang chủ chứa thông báo đã quá thời điểm và lỗi chữ
- [x] UI09 · Chuyển trang luôn bị phủ loading 400ms
- [x] UI10 · Mở trực tiếp trang làm bài/xem lại có thể crash
- [x] UI11 · Thiếu trạng thái lỗi, dữ liệu rỗng và thử lại
- [x] UI12 · Thẻ điểm dùng điểm lần gần nhất thay điểm cao nhất
- [x] UI13 · Thống kê dễ diễn giải sai năng lực học tập
- [x] UI14 · Đăng nhập xong mất trang người dùng định vào
- [x] UI16 · Ảnh câu hỏi đường dẫn tương đối trỏ về localhost
- [x] BE01 · Đặt lại mật khẩu không xác minh OTP trong yêu cầu đổi
- [x] BE02 · API sửa nội dung chưa có xác thực và quyền admin
- [x] BE03 · Bài nộp thiếu xác thực và kiểm tra chủ sở hữu
- [x] BE04 · Điểm do client gửi và đáp án chuẩn được gửi trước khi nộp
- [x] BE05 · Khóa/xóa tài khoản hoặc đổi quyền không vô hiệu token hiện hữu
- [x] BE06 · Log đăng ký ghi cả mật khẩu
- [x] BE07 · Xóa câu hỏi trong editor không xóa dữ liệu khi lưu
- [x] BE08 · Đổi câu text thành ảnh có thể báo lưu thành công nhưng mất sửa đổi
- [x] BE09 · API thống kê theo môn truy vấn field không có trong Submission
- [x] TECH01 · Thao tác ẩn đề bỏ qua cấu hình API và token
- [x] TECH02 · Refresh token và xử lý lỗi HTTP không hoạt động như mô tả
- [x] TECH03 · Bundle lớn, ảnh nền nặng và lint chưa đạt

## Hành vi chính sau thay đổi

- Form có nhãn, kiểm tra từng trường trước gửi, Enter để gửi, nút hiện/ẩn mật khẩu có tên truy cập, trạng thái bận và lỗi dễ đọc. Các menu/thao tác được chuyển sang link/button; modal tùy chỉnh có giữ focus và Escape; nội dung bảng câu hỏi thu gọn không còn nằm trong thứ tự Tab.
- Không phủ loading giả 400ms. Mỗi route tải mã khi cần, các trang có loading/error/empty/retry tại vùng dữ liệu. Đường dẫn làm bài/xem lại không phụ thuộc navigation state. Đăng nhập giữ đích nội bộ an toàn.
- Thẻ đề đọc bestScore và phân biệt chưa làm với 0. Thống kê tính trung bình có trọng số theo các đề đã hoàn thành; chương chưa làm không bị tính 0; bỏ kết luận điểm A/qua môn.
- API dùng chung cấu hình và interceptor. Chỉ 401 kích hoạt refresh, request đồng thời dùng chung lần refresh, lỗi 4xx/5xx bị reject, token cũ không ghi đè phiên mới. Mặc định dev dùng /api, production giữ backend Render cũ nếu không cấu hình biến môi trường; nên cấu hình VITE_API_BASE_URL rõ ràng khi triển khai.
- Đường dẫn ảnh tương đối dùng origin cấu hình; VITE_ASSET_BASE_URL có thể chỉ định nơi phục vụ ảnh. Ảnh nền chuyển sang WebP 75.712 byte, giữ SVG gốc để đối chiếu.
- Reset mật khẩu bắt buộc kiểm tra lại OTP và tiêu thụ có điều kiện trong cùng thao tác cập nhật; mật khẩu được băm. Token có fingerprint của password hash hiện tại, các phiên cũ bị từ chối sau đổi mật khẩu. Mỗi xác thực/refresh kiểm tra trạng thái và quyền hiện tại của tài khoản.
- API ghi nội dung yêu cầu Admin; đọc/ghi bài nộp kiểm tra người sở hữu. Các endpoint câu hỏi thô chỉ dành cho Admin. Không log password, OTP hoặc nội dung email; gửi email thất bại không còn báo thành công giả qua fallback console.
- Chế độ tính điểm tạo lượt tạm phía server và nhận câu hỏi không kèm đáp án/lời giải; server chấm snapshot, lấy danh tính từ token, đo thời gian và bỏ qua score/isCorrect do client khai. Luyện tập chủ động cho phép lời giải và không lưu điểm.
- Lưu editor kiểm tra toàn bộ dữ liệu và quyền sở hữu câu hỏi trước ghi; các câu bị bỏ được xóa theo đúng quiz sau khi lưu các câu còn lại. Chuyển text/ảnh giữ nguyên ID, tạo đích trước khi bỏ nguồn, báo lỗi khi cập nhật không hoàn tất. API thống kê suy ra môn/chương qua quizId hiện có.

## Bằng chứng kiểm tra

- `npm run lint`: đạt, không lỗi/cảnh báo ESLint.
- `npm test`: 56 kiểm thử đạt. Bao gồm OTP thiếu/sai/hết hạn/replay, khóa/xóa/đổi quyền/đổi mật khẩu làm token mất quyền, HTTP guard trả 401/403 trước thao tác DB, owner spoof, điểm giả, đáp án lạ/trùng, nộp trùng/đồng thời/thử lại sau lỗi, thống kê theo môn và xóa/chuyển loại câu hỏi. Các model được mock; không kết nối DB trong test.
- `npm run build`: đạt. JavaScript chính khoảng 290,6KB (gzip 97,1KB), CSS chính khoảng 279KB (gzip 39,1KB); các route được chia riêng, chunk lớn nhất khoảng 371KB. Trước sửa: JS 898,7KB và CSS 710,6KB. Đây là kích thước build, không phải số đo tốc độ mạng thực tế.
- Browser thực ở localhost:5000: hướng dẫn mới, label/menu/nút, Enter trên login trống/sai định dạng, Register trống hiển thị ba lỗi theo trường. Không đăng ký tài khoản hoặc gửi OTP thật.
- Browser trên fixture riêng localhost:5001: mở link quiz trước đăng nhập → đăng nhập trả đúng link → nộp một câu đúng/một câu sai được 50% → reload link review thành công → lần tiếp theo nộp trống được 0% nhưng điểm cao nhất và thống kê vẫn 50%. Đã mở editor bằng Admin giả lập, thêm đường dẫn ảnh cho câu chữ, lưu và mở lại xác nhận ảnh/nội dung còn nguyên. Tất cả dữ liệu trong bộ nhớ, không MongoDB.
- Backend local đã nạp lại an toàn, `autoCreate:false` và `autoIndex:false`. GET subjects/chapters trả 200 với danh sách trống; quizzes/questions/questionImages/submissions/auth/me/users không token trả 401. Không chạy thử CRUD ghi lên DB thật.
- `git diff --check`: đạt. `backend/models` không thay đổi.

## Lưu ý vận hành và giới hạn

1. Phiên đăng nhập được cấp bởi bản cũ cần đăng nhập lại vì thiếu fingerprint. Bản backend và frontend mới phải được triển khai cùng nhau do payload bài nộp/reset OTP và endpoint review/attempt đã thay đổi. Mới áp dụng local, chưa deploy production.
2. Lượt có tính điểm được lưu trong bộ nhớ một tiến trình. Server restart sẽ mất lượt chưa nộp; nhiều instance cần giải pháp lưu lượt dùng chung trước khi mở rộng. Mỗi người tối đa 10 lượt chưa hoàn tất còn hạn, tổng bộ nhớ tối đa 5.000 lượt; luyện tập không chiếm lượt lưu.
3. Không thêm compound unique index cho Submission vì chưa có phê duyệt DB. `$max` giữ điểm tốt nhất cho bản ghi hiện có; hai lượt độc lập upsert lần đầu đồng thời vẫn có khả năng tạo bản ghi trùng nếu DB chưa có unique index. Đây là giới hạn còn lại của schema hiện tại; cần duyệt đề xuất index/dọn trùng riêng nếu muốn bảo đảm tuyệt đối.
4. Lưu quiz liên quan nhiều collection không có transaction trên Mongo standalone. Toàn bộ payload được kiểm tra trước, ưu tiên lưu trước xóa sau và có lỗi rõ, nhưng lỗi storage giữa chừng vẫn có thể để lại cập nhật một phần. Không tự áp dụng transaction/migration hay tự sửa dữ liệu cũ.
5. Luyện tập và xem lại cố ý cho phép lời giải; tính điểm bảo đảm server chấm đúng dữ liệu, không phải hệ thống thi giám sát/chống người dùng tra cứu đáp án của cùng bộ đề.
6. Chưa kiểm thử gửi email thật, dữ liệu production hoặc tải đồng thời lớn. Rate limit và lượt tạm hiện theo tiến trình; cấu hình proxy/hạ tầng và lưu trữ dùng chung cần đánh giá riêng khi triển khai nhiều instance.

## Chạy lại kiểm tra UI không chạm DB

Chạy hai terminal trong thư mục dự án:

```sh
npm run test:ui:api
npm run test:ui:dev
```

Mở http://localhost:5001. Tài khoản giả lập: `fixture.user@example.test` hoặc `fixture.admin@example.test`; mật khẩu kiểm thử `FixtureOnly!42`. Link đề: `/quizzes/444444444444444444444444`. Fixture không nhập config kết nối DB, chặn mongoose.connect/save chưa mock và không gửi email/đổi mật khẩu thật. Tắt hai tiến trình khi kiểm tra xong; dữ liệu tự mất.

# Nhập đề đóng góp từ PDF

## Chạy ứng dụng

Backend cần Node.js 20 trở lên. Cấu hình trong `backend/.env` rồi khởi động lại backend từ thư mục `backend` bằng `npm start`:

```dotenv
GEMINI_API_KEY=<key-cua-ban>
GEMINI_OCR_MODEL=gemini-3.5-flash
GEMINI_FORMAT_MODEL=gemini-3.5-flash
```

Hai model có thể đổi độc lập theo khả năng truy cập của tài khoản Gemini. Model OCR phải hỗ trợ PDF; model định dạng phải hỗ trợ JSON có schema. Key chỉ được dùng phía server qua header `x-goog-api-key`. Không dùng biến `VITE_` cho key. File `.env` được Git bỏ qua; `.env.example` chỉ chứa giá trị mẫu.

## Luồng người dùng

1. Vào **Đóng góp đề**, chọn file PDF hoặc CSV, bấm **Trích xuất & Xem trước**. Có thể chọn môn/chương và đặt tên đề sau khi trích xuất.
2. Với PDF, backend gửi file tới Google Gemini để đọc văn bản/bản scan, rồi dùng lần gọi thứ hai để chuyển nội dung thành câu hỏi, lựa chọn, đáp án và lời giải theo định dạng ứng dụng.
3. Xem lại số câu so với bản gốc, cảnh báo và đáp án. Có thể sửa nội dung, thêm/xóa câu hỏi và lựa chọn. Đáp án chưa rõ được để trống để người dùng bổ sung.
4. Chọn **Khác (Môn học mới)** để gợi ý tên môn và một chương cụ thể, hoặc chọn **Khác (Chương mới)** trong môn đã có. Gợi ý được lưu bằng nhãn trong `adminNote` và hiển thị ở trang duyệt của admin.
5. Xác nhận đã kiểm tra nội dung và bấm gửi duyệt. Đề được lưu với trạng thái `pending`, chưa được xuất bản. Chỉnh sửa nội dung/thông tin đề sẽ yêu cầu xác nhận lại; đổi file sẽ xóa bản xem trước cũ.

## API và giới hạn

- `POST /api/contributed/import`: multipart, trường `file`, bắt buộc đăng nhập. Chỉ tạo bản xem trước trong bộ nhớ, không ghi database hoặc lưu PDF lên đĩa. File PDF sẽ được gửi cho Google để xử lý; bản xem trước ở trình duyệt mất khi tải lại trang.
- `POST /api/contributed/submit`: JSON, bắt buộc đăng nhập. Kiểm tra lại toàn bộ câu hỏi, giới hạn đóng góp và quan hệ môn/chương trước khi lưu. Không tin trạng thái, tác giả hay số câu do client gửi.
- PDF/CSV tối đa 10 MiB, 200 câu; mỗi câu có 2–8 lựa chọn không trùng và đúng một đáp án khớp nội dung lựa chọn. Nội dung câu hỏi/lời giải tối đa 5.000 ký tự, mỗi lựa chọn tối đa 2.000 ký tự. JSON nộp đề tối đa 2 MiB.
- Tối đa 10 đề trong 7 ngày. Nhập file có khóa xử lý đồng thời theo người dùng, chờ 5 giây giữa các lần và tối đa 10 lần trong 10 phút. Bộ đếm nhập file nằm trong từng tiến trình server, không dùng database.
- Mỗi bước Gemini có timeout 90 giây; client chờ tối đa 210 giây. Quota, lỗi nhà cung cấp, tài liệu bị chặn hoặc đầu ra bị cắt được báo lỗi để thử lại. Không lưu bản trích xuất lỗi thành đề.
- CSV UTF-8 hỗ trợ BOM, cột `question,options,answer,explain`; lựa chọn trong cột `options` phân cách bằng `;`.

## Giới hạn cần kiểm tra khi duyệt

AI có thể đọc sai hoặc bỏ sót nội dung, đặc biệt với bản scan mờ, công thức và bảng biểu. Hình/sơ đồ được chuyển thành mô tả văn bản kèm cảnh báo, chưa trích thành ảnh đính kèm. Câu tự luận, nối cột và câu nhiều đáp án chưa thuộc định dạng trắc nghiệm một đáp án của ứng dụng. Cần đối chiếu với PDF gốc trước khi nộp.

Không thay đổi model/schema, collection, index hay migration. Chỉ bước gửi đề thực hiện thao tác tạo đề đóng góp thông thường, theo schema hiện có.

## Kiểm thử

```sh
npm test
npm run lint
npm run build
```

Các kiểm thử tự động mock Gemini và model database, không gọi API trả phí hoặc ghi database thật. Kiểm thử HTTP sử dụng server tạm để kiểm tra multipart, giới hạn dung lượng và JSON đề dài.

Tham khảo: [Google Gemini đọc PDF](https://ai.google.dev/gemini-api/docs/document-processing), [Structured output](https://ai.google.dev/gemini-api/docs/structured-output).

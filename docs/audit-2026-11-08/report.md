# Checklist rà soát app — 08/11/2026

Mã nguồn workspace và app local http://localhost:5000; API đọc tại localhost:3000. Không đánh giá bản production.

Chưa có phiên đăng nhập; API local subjects/quizzes/questions đều trả mảng rỗng. Không tạo tài khoản, không gửi OTP, không nộp/sửa/xóa dữ liệu. Các màn hình học, thống kê, đóng góp và quản trị mới rà mã nguồn; chưa kiểm thử end-to-end. Không thay đổi app hoặc DB.

UI desktop 1280×720: About, Login, Register, Forgot Password, chuyển Môn học khi chưa đăng nhập. Mobile 390×844: Login, menu, 404. Login trống và Register trống đã thử. GET local subjects/quizzes/questions=200 (0 mục), auth/me và users không token=401. Build thành công; lint 83 errors, 9 warnings.

Đã xác minh User pre-save hook băm mật khẩu; không ghi nhận lỗi lưu mật khẩu dạng thô. Chưa kiểm tra rate limit tại hạ tầng, tải đồng thời, cấu hình production hoặc tính đầy đủ dữ liệu thật. P0: bảo mật nghiêm trọng; P1: nên sửa sớm; P2: cải thiện/hoàn thiện. Tick chỉ ghi lựa chọn, không thực thi sửa đổi. Mọi thay đổi DB cần đề xuất cụ thể và phê duyệt riêng.

Mở checklist.html để tick, ghi chú, đổi thứ tự ưu tiên và xuất lựa chọn. Tất cả mục mặc định chưa chọn.

## [ ] UI01 · P1 · Menu bị cắt trên điện thoại

**Bằng chứng:** Đã thấy trên UI. Viewport 390×844: chỉ thấy logo, Trang chủ và Môn học; các mục bên phải nằm ngoài màn hình.

**Đề xuất:** Thêm menu thu gọn; cho logo và thao tác tài khoản co giãn theo breakpoint.

**Nghiệm thu:** Ở 360/390/768px truy cập được mọi mục, không cần cuộn ngang.

**Vị trí:** `src/components/NavBar/NavBar.jsx:62`

## [ ] UI02 · P1 · Form tài khoản gần như không dùng được trên mobile

**Bằng chứng:** Đã thấy trên UI. Trang login ở 390px vẫn chia hai cột; input chỉ còn một mẩu nhỏ, nội dung và liên kết xuống từng từ. Register/Forgot dùng chung cấu trúc hai cột nhưng chưa tái hiện riêng trên mobile.

**Đề xuất:** Dùng một cột trên mobile, ẩn hoặc thu gọn mảng logo; chiều cao theo nội dung.

**Nghiệm thu:** Login/Register/Forgot ở 360/390px có input đầy đủ, nút dễ chạm và không cắt nội dung.

**Vị trí:** `src/pages/LoginPage/LoginPage.jsx:68`, `src/pages/LoginPage/RegisterPage.jsx:74`, `src/pages/LoginPage/ForgotPassPage.jsx:87`

## [ ] UI03 · P2 · Hai ô mật khẩu đăng ký quá chật

**Bằng chứng:** Đã thấy trên UI. Ở 1280×720, mật khẩu và xác nhận đặt cùng hàng; placeholder xác nhận bị cắt.

**Đề xuất:** Tách thành hai hàng có nhãn, thống nhất vị trí nút hiện mật khẩu.

**Nghiệm thu:** Cả hai ô có nhãn rõ, đọc được giá trị và lỗi riêng ở desktop/mobile.

**Vị trí:** `src/pages/LoginPage/RegisterPage.jsx:13`

## [ ] UI04 · P2 · Trang 404 tràn nội dung khỏi thẻ

**Bằng chứng:** Đã thấy trên UI. Ở 390×844, thẻ chỉ rộng 50%; đoạn thông báo tràn xuống ngoài nền thẻ và nút quay về nằm xa bên dưới.

**Đề xuất:** Dùng max-width với padding theo breakpoint; bỏ chiều cao cố định.

**Nghiệm thu:** Thông báo và nút nằm trong thẻ ở 360px; nút không bị che.

**Vị trí:** `src/pages/NotFoundPage/NotFoundPage.jsx:8`

## [ ] UI05 · P1 · Nút và menu thiếu hỗ trợ bàn phím, input thiếu nhãn

**Bằng chứng:** Xác nhận từ mã. Menu dùng p/div có onClick; nút đăng nhập là div; trường chỉ có placeholder. Cây accessibility không nhận các thao tác này là button/link.

**Đề xuất:** Dùng button/link/form, label gắn với input, tên truy cập cho icon và trạng thái focus.

**Nghiệm thu:** Tab tới được menu/nút/mắt mật khẩu; Enter gửi form, trình đọc màn hình đọc đúng nhãn.

**Vị trí:** `src/components/NavBar/NavBar.jsx:63`, `src/pages/LoginPage/LoginPage.jsx:128`

## [ ] UI06 · P2 · Thông báo form không chỉ đúng trường lỗi

**Bằng chứng:** Đã thấy trên UI. Bấm login trống trả lỗi chung; bấm đăng ký trống chỉ báo mật khẩu ít nhất 6 ký tự. Login bỏ qua thông báo cụ thể từ API.

**Đề xuất:** Kiểm tra trường bắt buộc/email trước gửi; hiển thị lỗi sát trường, giữ thông báo nghiệp vụ từ server.

**Nghiệm thu:** Trống/sai email/sai mật khẩu có lỗi rõ; không gửi yêu cầu khi trường bắt buộc còn trống.

**Vị trí:** `src/pages/LoginPage/LoginPage.jsx:29`, `src/pages/LoginPage/RegisterPage.jsx:26`

## [ ] UI07 · P2 · Chữ phụ và lỗi khó đọc trên nền kính

**Bằng chứng:** Quan sát cần đo thêm. Quan sát desktop: liên kết xanh nhạt trên nền xanh và chữ nhỏ trong form có độ nổi bật thấp; chưa đo tỷ lệ tương phản.

**Đề xuất:** Đo tương phản, tăng nền đặc hoặc màu chữ cho liên kết/lỗi, giữ focus rõ.

**Nghiệm thu:** Đạt tương phản mục tiêu 4.5:1 cho chữ thường; lỗi không chỉ phân biệt bằng màu.

**Vị trí:** `src/pages/LoginPage/LoginPage.jsx:122`

## [ ] UI08 · P2 · Trang chủ chứa thông báo đã quá thời điểm và lỗi chữ

**Bằng chứng:** Đã thấy trên UI. Ngày rà 08/11/2026, trang vẫn hẹn giao diện mới tháng 9/2026. Có các chữ bân đầu, nên tảng, theo dỏi; thương hiệu Project-Quizzes/Quiz Company chưa thống nhất.

**Đề xuất:** Cập nhật thông báo theo tình trạng thực tế, sửa chính tả và thống nhất tên gọi.

**Nghiệm thu:** Không còn hẹn thời điểm đã qua như tương lai; nội dung được duyệt lại.

**Vị trí:** `src/pages/AboutUs/AboutUs.jsx:15`, `src/pages/LoginPage/LoginPage.jsx:78`

## [ ] UI09 · P2 · Chuyển trang luôn bị phủ loading 400ms

**Bằng chứng:** Xác nhận từ mã. App bật overlay theo mọi pathname và tắt bằng timeout cố định, không gắn với dữ liệu tải. Đã thấy overlay lúc chuyển Register và 404.

**Đề xuất:** Gắn loading với tác vụ thực; dùng skeleton tại vùng nội dung khi cần.

**Nghiệm thu:** Chuyển trang tĩnh không bị chặn; loading kết thúc theo request.

**Vị trí:** `src/routes/App.jsx:34`

## [ ] UI10 · P1 · Mở trực tiếp trang làm bài/xem lại có thể crash

**Bằng chứng:** Xác nhận từ mã. QuizPage và ReviewQuizPage truy cập location.state.subjectId không kiểm tra null. Mở URL trực tiếp trong phiên đăng nhập không có navigation state sẽ ném lỗi. Chưa tái hiện bằng tài khoản.

**Đề xuất:** Lấy quiz/môn theo URL và dữ liệu API; dùng state như thông tin bổ sung, có trạng thái lỗi.

**Nghiệm thu:** Sau đăng nhập, dán link mới hoặc mở tab mới vẫn xem/làm bài được.

**Vị trí:** `src/pages/QuizPage/QuizPage.jsx:30`, `src/pages/ReviewQuizPage/ReviewQuizPage.jsx:21`

## [ ] UI11 · P1 · Thiếu trạng thái lỗi, dữ liệu rỗng và thử lại

**Bằng chứng:** Xác nhận từ mã. QuizPage khi API lỗi chỉ console.log rồi vẫn hiện Đang tải câu hỏi; SubjectPage không có thông báo dữ liệu rỗng/lỗi; UserStats return sớm khi không có chương nhưng loading vẫn true.

**Đề xuất:** Tách loading/error/empty/success, thêm nút thử lại và chặn nộp khi chưa có câu hỏi.

**Nghiệm thu:** Mạng lỗi, đề rỗng, môn không có chương đều hiển thị đúng trạng thái.

**Vị trí:** `src/pages/QuizPage/QuizPage.jsx:68`, `src/pages/SubjectPage/SubjectPage.jsx:74`, `src/components/UserStats/UserStats.jsx:53`

## [ ] UI12 · P1 · Thẻ điểm dùng điểm lần gần nhất thay điểm cao nhất

**Bằng chứng:** Xác nhận từ mã. QuizBox gọi getBest nhưng setBestScore(res.data.score), trong khi API có bestScore riêng. Nếu lần sau thấp hơn, thẻ tụt điểm dù điểm cao nhất không đổi.

**Đề xuất:** Đọc đúng bestScore; phân biệt chưa làm với điểm 0 và ghi rõ tên chỉ số.

**Nghiệm thu:** Làm lần 1 đạt 90, lần 2 đạt 50: điểm cao nhất vẫn 90.

**Vị trí:** `src/pages/QuizListPage/QuizListPage.jsx:350`

## [ ] UI13 · P2 · Thống kê dễ diễn giải sai năng lực học tập

**Bằng chứng:** Xác nhận từ mã. UserStats lấy điểm tốt nhất của từng đề để gọi là điểm trung bình; chương chưa làm gán 0 rồi khuyên chưa đủ qua môn. Đây là chỉ số luyện tập, không đủ căn cứ kết luận điểm học phần.

**Đề xuất:** Ghi rõ trung bình điểm tốt nhất; tách chưa có dữ liệu; thống nhất cách tính trọng số và bỏ khẳng định qua môn/A.

**Nghiệm thu:** Người chưa làm thấy chưa có dữ liệu; mô tả chỉ số khớp phép tính.

**Vị trí:** `src/components/UserStats/UserStats.jsx:67`, `src/components/UserStats/UserStats.jsx:117`

## [ ] UI14 · P2 · Đăng nhập xong mất trang người dùng định vào

**Bằng chứng:** Xác nhận từ mã. ProtectedRoute chuyển /login không lưu đích; LoginPage luôn chuyển /about. Bấm Môn học khi chưa đăng nhập đã được kiểm tra chuyển sang login.

**Đề xuất:** Lưu đường dẫn đích nội bộ an toàn và quay lại sau đăng nhập.

**Nghiệm thu:** Vào link môn/đề cần đăng nhập: đăng nhập xong trở về đúng link.

**Vị trí:** `src/routes/ProtectedRoute.jsx:9`, `src/pages/LoginPage/LoginPage.jsx:25`

## [ ] UI15 · P1 · Modal tùy chọn có nguy cơ rộng 960px trên mobile

**Bằng chứng:** Xác nhận từ mã. ModalOptionQuiz đặt !w-[960px], chỉ override ở sm và md; dưới sm chưa có override chiều rộng. Chưa mở modal trực tiếp do chưa có phiên và đề.

**Đề xuất:** Dùng width:min(960px,calc(100vw - khoảng đệm)); giới hạn chiều cao và cuộn nội dung.

**Nghiệm thu:** Modal ở 360/390px không tràn ngang, nút bắt đầu/đóng luôn tiếp cận được.

**Vị trí:** `src/components/ModalOptionQuiz/ModalOptionQuiz.jsx:74`

## [ ] UI16 · P1 · Ảnh câu hỏi đường dẫn tương đối trỏ về localhost

**Bằng chứng:** Xác nhận từ mã. QuizPage/ReviewQuizPage ghép http://localhost:5000 cho q.image không bắt đầu bằng http. Người dùng triển khai thật sẽ tải từ máy của họ.

**Đề xuất:** Dùng URL tài nguyên cấu hình theo môi trường hoặc URL hợp lệ từ server, có fallback ảnh lỗi.

**Nghiệm thu:** Ảnh tương đối tải đúng trên môi trường triển khai, không mixed-content/localhost.

**Vị trí:** `src/pages/QuizPage/QuizPage.jsx:256`, `src/pages/ReviewQuizPage/ReviewQuizPage.jsx:136`

## [ ] BE01 · P0 · Đặt lại mật khẩu không xác minh OTP trong yêu cầu đổi

**Bằng chứng:** Xác nhận từ mã. resetPassword chỉ nhận email/newPassword, kiểm tra OTP có tồn tại và còn hạn trong DB, không so mã người gửi. verifyForgotOtp không tạo bằng chứng bắt buộc dùng ở bước reset. Không thử khai thác vì sẽ đổi dữ liệu.

**Đề xuất:** Yêu cầu và kiểm tra OTP hoặc bằng chứng reset dùng một lần; xóa OTP sau thành công; thêm kiểm thử âm.

**Nghiệm thu:** Sai/thiếu OTP không đổi được mật khẩu kể cả khi tài khoản đang có OTP còn hạn.

**Vị trí:** `backend/controllers/authController.js:297`

## [ ] BE02 · P0 · API sửa nội dung chưa có xác thực và quyền admin

**Bằng chứng:** Xác nhận từ mã. Các route ghi subjects/chapters/quizzes/questions/questionImages không gắn verifyToken/verifyAdmin; server cũng không gắn middleware bảo vệ chung. Giao diện ẩn nút không bảo vệ API.

**Đề xuất:** Bảo vệ từng route ghi bằng xác thực và quyền; xác minh quyền với câu hỏi/quiz đích.

**Nghiệm thu:** Không token trả 401; User thường trả 403; Admin hợp lệ mới sửa được. Không thử ghi dữ liệu trong lần rà này.

**Vị trí:** `backend/routes/subjectRoutes.js:14`, `backend/routes/chapterRoutes.js:13`, `backend/routes/quizRoutes.js:17`, `backend/routes/questionRoutes.js:13`, `backend/routes/questionImageRoutes.js:13`

## [ ] BE03 · P0 · Bài nộp thiếu xác thực và kiểm tra chủ sở hữu

**Bằng chứng:** Xác nhận từ mã. submissionRoutes không gắn xác thực; controller nhận userId từ params/body để đọc hoặc cập nhật bài. Có thể đọc/ghi dưới danh tính khác nếu biết ID. Chưa thực hiện yêu cầu ghi thử.

**Đề xuất:** Lấy danh tính từ token; chỉ chủ sở hữu hoặc Admin có quyền mới được đọc, chỉ người làm mới được nộp.

**Nghiệm thu:** User A không xem/ghi bài User B; request không token bị từ chối.

**Vị trí:** `backend/routes/submissionRoutes.js:16`, `backend/controllers/submissionController.js:31`

## [ ] BE04 · P1 · Điểm do client gửi và đáp án chuẩn được gửi trước khi nộp

**Bằng chứng:** Xác nhận từ mã. addSubmission tin score/isCorrect/totalQuestions từ request; getQuizById trả toàn bộ question gồm answer. Với chế độ thi có tính điểm, client có thể biết đáp án và tự khai điểm.

**Đề xuất:** Server tự chấm và giới hạn giá trị; tách dữ liệu làm bài tính điểm khỏi dữ liệu luyện tập/xem lời giải.

**Nghiệm thu:** Thay score/isCorrect trên request không thay đổi điểm tính bởi server; chế độ tính điểm không nhận đáp án trước hạn.

**Vị trí:** `backend/controllers/submissionController.js:33`, `backend/controllers/quizController.js:25`

## [ ] BE05 · P1 · Khóa/xóa tài khoản hoặc đổi quyền không vô hiệu token hiện hữu

**Bằng chứng:** Xác nhận từ mã. refresh tin role/id trong JWT mà không đọc lại User; verifyToken cũng chỉ kiểm chữ ký. Token cũ còn hiệu lực có thể tiếp tục dùng quyền cũ tới lúc hết hạn.

**Đề xuất:** Kiểm tra trạng thái và quyền hiện tại khi xác thực/refresh; thiết kế thu hồi phiên riêng nếu cần. Không tự thêm trường DB.

**Nghiệm thu:** Tài khoản bị khóa/xóa không gọi API bảo vệ/refresh được; quyền hạ cấp có hiệu lực.

**Vị trí:** `backend/controllers/authController.js:82`, `backend/middlewares/verifyToken.js:17`

## [ ] BE06 · P1 · Log đăng ký ghi cả mật khẩu

**Bằng chứng:** Xác nhận từ mã. register console.log toàn bộ req.body trước validation, bao gồm password. Không đọc log thực tế hoặc trích thông tin người dùng.

**Đề xuất:** Bỏ log body hoặc chỉ log trường được phép; tránh trả raw error nội bộ; cân nhắc giới hạn thử OTP/login ở tầng app/gateway.

**Nghiệm thu:** Log không có password/OTP/token; lỗi trả về không lộ chi tiết nội bộ. Giới hạn tầng hạ tầng chưa được xác minh.

**Vị trí:** `backend/controllers/authController.js:117`

## [ ] BE07 · P1 · Xóa câu hỏi trong editor không xóa dữ liệu khi lưu

**Bằng chứng:** Xác nhận từ mã. Editor chỉ filter danh sách state; updateQuizFull chỉ cập nhật/thêm các câu còn trong payload, không xử lý các câu bị bỏ. getQuizById sẽ lấy lại các câu cũ.

**Đề xuất:** Định nghĩa đồng bộ danh sách và thao tác xóa rõ ràng, kiểm tra quiz sở hữu câu hỏi, xử lý lỗi nhất quán.

**Nghiệm thu:** Xóa một câu rồi lưu/tải lại: câu không quay lại. Sửa luồng ghi dữ liệu cần được duyệt riêng trước khi triển khai.

**Vị trí:** `src/pages/EditQuizPage/EditQuizPage.jsx:59`, `backend/controllers/quizController.js:39`

## [ ] BE08 · P1 · Đổi câu text thành ảnh có thể báo lưu thành công nhưng mất sửa đổi

**Bằng chứng:** Xác nhận từ mã. updateQuizFull chọn collection theo q.image mới; _id của câu vẫn ở collection cũ. findByIdAndUpdate có thể trả null nhưng bị bỏ qua, response vẫn thành công.

**Đề xuất:** Xác định loại câu đang lưu trước cập nhật; xử lý chuyển loại và kết quả không tìm thấy; không nhận _id ngoài quiz.

**Nghiệm thu:** Thêm/bỏ ảnh ở câu hiện hữu rồi tải lại không mất nội dung; thất bại trả lỗi rõ.

**Vị trí:** `backend/controllers/quizController.js:42`

## [ ] BE09 · P2 · API thống kê theo môn truy vấn field không có trong Submission

**Bằng chứng:** Xác nhận từ mã. getAllSubmissionFromSubject lọc subjectId và populate chapterId, nhưng submission schema và addSubmission không có hai field này. Dữ liệu tạo qua app không thể đáp ứng truy vấn như dự định.

**Đề xuất:** Ưu tiên suy ra môn/chương qua quizId và lọc quiz liên quan; không tự thêm cột/field/index.

**Nghiệm thu:** Hai môn có bài làm riêng: API trả đúng từng môn, không lỗi populate.

**Vị trí:** `backend/controllers/submissionController.js:138`, `backend/models/submission.js:10`

## [ ] TECH01 · P1 · Thao tác ẩn đề bỏ qua cấu hình API và token

**Bằng chứng:** Xác nhận từ mã. QuizBox gọi axios.put tới URL Render hardcode thay vì quizService. Khi đổi VITE_API_BASE_URL, thao tác vẫn gửi sang backend cũ và không qua interceptor gắn token. Chưa bấm vì có thay đổi DB.

**Đề xuất:** Dùng quizService.updateAvailability với API instance duy nhất và kiểm tra status.

**Nghiệm thu:** Mọi API dùng cùng môi trường; thao tác ẩn/hiện có token, không gọi nhầm backend.

**Vị trí:** `src/pages/QuizListPage/QuizListPage.jsx:362`

## [ ] TECH02 · P1 · Refresh token và xử lý lỗi HTTP không hoạt động như mô tả

**Bằng chứng:** Xác nhận từ mã. axiosInstance dùng validateStatus:()=>true nên 401/4xx/5xx vào nhánh success, không vào handler refresh. Backend còn trả 403 khi token hết hạn, trong khi frontend chỉ bắt 401. UI có thể báo lưu thành công dù API lỗi.

**Đề xuất:** Thống nhất status với server; bỏ resolve mọi status hoặc xử lý rõ nhánh lỗi; bảo đảm queue/isRefreshing luôn được giải phóng.

**Nghiệm thu:** 401 hết hạn refresh một lần và retry; 403 quyền hạn không refresh; 400/500 không báo thành công.

**Vị trí:** `src/api/axiosInstance.js:24`, `backend/middlewares/verifyToken.js:23`

## [ ] TECH03 · P2 · Bundle lớn, ảnh nền nặng và lint chưa đạt

**Bằng chứng:** Đã chạy kiểm tra. npm run build thành công: SVG nền 8,151.69kB (gzip 2,210.64kB), JS 898.71kB (gzip 281.90kB), CSS 710.62kB. npm run lint: 83 errors, 9 warnings; có lỗi hooks và cấu hình globals Node, không đồng nghĩa 83 lỗi runtime.

**Đề xuất:** Nén/thay SVG nền, chia chunk theo route; chỉnh cấu hình lint theo môi trường và sửa lỗi hooks trước, rồi dọn cảnh báo.

**Nghiệm thu:** Build/lint đạt; đo tải trang cold-cache trước/sau trên mạng chậm.

**Vị trí:** `package.json:10`, `src/pages/QuizPage/QuizPage.jsx:18`

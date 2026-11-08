import test from "node:test";
import assert from "node:assert/strict";
import {
  processPdfContribution,
  GeminiServiceError
} from "../services/geminiContribution.js";

// Helper to create mock PDF buffer
const samplePdfBuffer = Buffer.from("%PDF-1.4 Mock PDF Content");

test("Gemini rejects malformed questions instead of silently dropping or coercing them", async () => {
  const valid = { question: "Q", options: ["A", "B"], answer: "A" };
  for (const question of [null, { ...valid, question: "" }, { ...valid, options: [{}, "B"] }, { ...valid, options: ["A", "A"] }, { ...valid, options: ["A", ""] }, { ...valid, explain: "x".repeat(5001) }]) {
    let calls = 0;
    await assert.rejects(processPdfContribution(samplePdfBuffer, {
      apiKey: "test-only-key",
      fetchFn: async () => ({ ok: true, json: async () => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: calls++ === 0 ? "OCR content" : JSON.stringify({ questions: [question] }) }] } }] }) })
    }), error => error instanceof GeminiServiceError && error.status === 422);
  }
});

test("Gemini joins visible text parts, ignores thinking, and rejects missing completion reason", async () => {
  let calls = 0;
  const data = JSON.stringify({ questions: [{ question: "Q", options: ["A", "B"], answer: "A" }] });
  const result = await processPdfContribution(samplePdfBuffer, {
    apiKey: "test-only-key",
    fetchFn: async () => ({ ok: true, json: async () => ({ candidates: [{ finishReason: "STOP", content: { parts: calls++ === 0 ? [{ thought: true, text: "internal" }, { text: "OCR" }, { text: " content" }] : [{ text: data.slice(0, 20) }, { text: data.slice(20) }] } }] }) })
  });
  assert.equal(result.questions[0].answer, "A");
  await assert.rejects(processPdfContribution(samplePdfBuffer, {
    apiKey: "test-only-key",
    fetchFn: async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "incomplete" }] } }] }) })
  }), error => error.status === 422);
});

test("Gemini Contribution - 503 error when GEMINI_API_KEY is missing", async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  try {
    await assert.rejects(
      async () => {
        await processPdfContribution(samplePdfBuffer, { apiKey: "" });
      },
      (err) => {
        assert.ok(err instanceof GeminiServiceError);
        assert.equal(err.status, 503);
        assert.match(err.message, /chưa được cấu hình/i);
        return true;
      }
    );
  } finally {
    if (originalKey !== undefined) {
      process.env.GEMINI_API_KEY = originalKey;
    }
  }
});

test("Gemini Contribution - 400 error when model name is invalid or malicious", async () => {
  await assert.rejects(
    async () => {
      await processPdfContribution(samplePdfBuffer, {
        apiKey: "fake-key",
        ocrModel: "invalid/model;injection"
      });
    },
    (err) => {
      assert.ok(err instanceof GeminiServiceError);
      assert.equal(err.status, 400);
      assert.match(err.message, /Tên mô hình Gemini không hợp lệ/i);
      return true;
    }
  );
});

test("Gemini Contribution - 2-stage success flow with OCR and JSON formatting", async () => {
  let callCount = 0;
  const mockFetch = async (url, options) => {
    callCount++;
    assert.equal(options.headers["x-goog-api-key"], "test-valid-key");

    if (callCount === 1) {
      // Stage 1: Document OCR
      const body = JSON.parse(options.body);
      assert.ok(body.contents[0].parts[0].inlineData);
      assert.equal(body.contents[0].parts[0].inlineData.mimeType, "application/pdf");

      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  {
                    text: "Đề thi Toán học 12\n1. 1 + 1 bằng mấy?\nA. 1\nB. 2\nC. 3\nĐáp án: B"
                  }
                ]
              }
            }
          ]
        })
      };
    }

    if (callCount === 2) {
      // Stage 2: Structured JSON formatting
      const body = JSON.parse(options.body);
      assert.equal(body.generationConfig.responseMimeType, "application/json");

      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      name: "Đề thi Toán học 12",
                      questions: [
                        {
                          question: "1 + 1 bằng mấy?",
                          options: ["1", "2", "3"],
                          answer: "2",
                          explain: "Phép cộng cơ bản"
                        }
                      ],
                      warnings: []
                    })
                  }
                ]
              }
            }
          ]
        })
      };
    }

    throw new Error("Unexpected call");
  };

  const result = await processPdfContribution(samplePdfBuffer, {
    apiKey: "test-valid-key",
    fetchFn: mockFetch
  });

  assert.equal(callCount, 2);
  assert.equal(result.name, "Đề thi Toán học 12");
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].question, "1 + 1 bằng mấy?");
  assert.deepEqual(result.questions[0].options, ["1", "2", "3"]);
  assert.equal(result.questions[0].answer, "2");
  assert.equal(result.questions[0].explain, "Phép cộng cơ bản");
});

test("Gemini Contribution - 429 quota/rate limit error handling", async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 429,
    json: async () => ({ error: { message: "Quota exceeded" } })
  });

  await assert.rejects(
    async () => {
      await processPdfContribution(samplePdfBuffer, {
        apiKey: "test-valid-key",
        fetchFn: mockFetch
      });
    },
    (err) => {
      assert.ok(err instanceof GeminiServiceError);
      assert.equal(err.status, 429);
      assert.match(err.message, /hạn mức|quá tải/i);
      return true;
    }
  );
});

test("Gemini Contribution - 502 error when Google server responds with 5xx", async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 503,
    json: async () => ({ error: { message: "Service Unavailable" } })
  });

  await assert.rejects(
    async () => {
      await processPdfContribution(samplePdfBuffer, {
        apiKey: "test-valid-key",
        fetchFn: mockFetch
      });
    },
    (err) => {
      assert.ok(err instanceof GeminiServiceError);
      assert.equal(err.status, 502);
      assert.match(err.message, /tạm thời|kết nối/i);
      return true;
    }
  );
});

test("Gemini Contribution - 504 timeout when network aborts", async () => {
  const mockFetch = async () => {
    const error = new Error("The operation was aborted");
    error.name = "AbortError";
    throw error;
  };

  await assert.rejects(
    async () => {
      await processPdfContribution(samplePdfBuffer, {
        apiKey: "test-valid-key",
        fetchFn: mockFetch
      });
    },
    (err) => {
      assert.ok(err instanceof GeminiServiceError);
      assert.equal(err.status, 504);
      assert.match(err.message, /timeout|quá thời gian/i);
      return true;
    }
  );
});

test("Gemini Contribution - 422 error when content is blocked by safety filters", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [
        {
          finishReason: "SAFETY",
          content: { parts: [] }
        }
      ]
    })
  });

  await assert.rejects(
    async () => {
      await processPdfContribution(samplePdfBuffer, {
        apiKey: "test-valid-key",
        fetchFn: mockFetch
      });
    },
    (err) => {
      assert.ok(err instanceof GeminiServiceError);
      assert.equal(err.status, 422);
      assert.match(err.message, /an toàn/i);
      return true;
    }
  );
});

test("Gemini Contribution - 422 error when output is truncated (MAX_TOKENS)", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [
        {
          finishReason: "MAX_TOKENS",
          content: { parts: [{ text: "Partial text" }] }
        }
      ]
    })
  });

  await assert.rejects(
    async () => {
      await processPdfContribution(samplePdfBuffer, {
        apiKey: "test-valid-key",
        fetchFn: mockFetch
      });
    },
    (err) => {
      assert.ok(err instanceof GeminiServiceError);
      assert.equal(err.status, 422);
      assert.match(err.message, /cắt ngắn|token/i);
      return true;
    }
  );
});

test("Gemini Contribution - 422 error when Stage 2 returns malformed JSON", async () => {
  let callCount = 0;
  const mockFetch = async () => {
    callCount++;
    if (callCount === 1) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              finishReason: "STOP",
              content: { parts: [{ text: "Some raw transcription" }] }
            }
          ]
        })
      };
    }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              finishReason: "STOP",
              content: { parts: [{ text: "INVALID NOT JSON {{" }] }
            }
          ]
        })
      };
    };

  await assert.rejects(
    async () => {
      await processPdfContribution(samplePdfBuffer, {
        apiKey: "test-valid-key",
        fetchFn: mockFetch
      });
    },
    (err) => {
      assert.ok(err instanceof GeminiServiceError);
      assert.equal(err.status, 422);
      assert.match(err.message, /JSON/i);
      return true;
    }
  );
});

test("Gemini Contribution - handles unknown answer and generates warning for preview", async () => {
  let callCount = 0;
  const mockFetch = async () => {
    callCount++;
    if (callCount === 1) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              finishReason: "STOP",
              content: { parts: [{ text: "OCR output" }] }
            }
          ]
        })
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    name: "Đề thi thử",
                    questions: [
                      {
                        question: "Câu hỏi chưa rõ đáp án?",
                        options: ["Phương án 1", "Phương án 2"],
                        answer: "",
                        explain: ""
                      }
                    ],
                    warnings: ["[Cảnh báo: Câu hỏi có sơ đồ/hình ảnh cần kiểm tra lại]"]
                  })
                }
              ]
            }
          }
        ]
      })
    };
  };

  const result = await processPdfContribution(samplePdfBuffer, {
    apiKey: "test-valid-key",
    fetchFn: mockFetch
  });

  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].answer, "");
  assert.ok(result.warnings.length >= 1);
  assert.ok(result.warnings.some((w) => w.includes("Chưa xác định") || w.includes("Cảnh báo")));
});

test("Gemini Contribution - 422 error when output exceeds 200 questions", async () => {
  let callCount = 0;
  const mockFetch = async () => {
    callCount++;
    if (callCount === 1) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ finishReason: "STOP", content: { parts: [{ text: "OCR" }] } }]
        })
      };
    }

    const hugeQuestions = [];
    for (let i = 0; i < 205; i++) {
      hugeQuestions.push({
        question: `Câu hỏi ${i + 1}`,
        options: ["A", "B"],
        answer: "A"
      });
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    name: "Đề quá dài",
                    questions: hugeQuestions,
                    warnings: []
                  })
                }
              ]
            }
          }
        ]
      })
    };
  };

  await assert.rejects(
    async () => {
      await processPdfContribution(samplePdfBuffer, {
        apiKey: "test-valid-key",
        fetchFn: mockFetch
      });
    },
    (err) => {
      assert.ok(err instanceof GeminiServiceError);
      assert.equal(err.status, 422);
      assert.match(err.message, /200 câu/i);
      return true;
    }
  );
});

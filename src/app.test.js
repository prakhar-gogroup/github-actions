const supertest = require("supertest");
const app = require("./app");
const request = supertest(app);

// Mock SendGrid
jest.mock("@sendgrid/mail", () => ({
  setApiKey: jest.fn(),
  send: jest.fn()
}));

const sgMail = require("@sendgrid/mail");

describe("API Endpoints", () => {
  let csrfToken;
  let csrfCookie;
  
  beforeAll(async () => {
    // Get CSRF token for tests
    const response = await request.get("/api/csrf-token");
    expect(response.status).toBe(200);
    csrfToken = response.body.csrfToken;
    // Get the CSRF cookie from the response
    const cookies = response.headers['set-cookie'];
    csrfCookie = cookies.find(cookie => cookie.includes('_csrf'));
  });

  // Helper function to make authenticated requests
  const authenticatedRequest = (method, url) => {
    return request[method](url)
      .set('Cookie', [csrfCookie])
      .set('X-CSRF-Token', csrfToken);
  };

  describe("GET /", () => {
    it("should return the HTML form", async () => {
      const response = await request.get("/");
      expect(response.status).toBe(200);
      expect(response.type).toBe("text/html");
    });
  });

  describe("GET /api/csrf-token", () => {
    it("should return a CSRF token", async () => {
      const response = await request.get("/api/csrf-token");
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("csrfToken");
      expect(typeof response.body.csrfToken).toBe("string");
    });
  });

  describe("POST /api/send-email", () => {
    beforeEach(() => {
      sgMail.send.mockClear();
    });

    it("should reject requests without CSRF token", async () => {
      const response = await request
        .post("/api/send-email")
        .send({
          to: "test@example.com",
          subject: "Test Subject",
          body: "Test Body"
        });

      expect(response.status).toBe(403);
    });

    it("should send email successfully with valid CSRF token", async () => {
      sgMail.send.mockResolvedValueOnce([{ statusCode: 202 }, {}]);

      const response = await authenticatedRequest('post', '/api/send-email')
        .send({
          to: "test@example.com",
          subject: "Test Subject",
          body: "Test Body"
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message", "Email sent successfully");
      expect(sgMail.send).toHaveBeenCalled();
    });

    it("should validate email input", async () => {
      const response = await authenticatedRequest('post', '/api/send-email')
        .send({
          to: "invalid-email",
          subject: "",
          body: ""
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("errors");
    });

    it("should handle SendGrid errors with retry logic", async () => {
      // Mock three failed attempts
      sgMail.send
        .mockRejectedValueOnce(new Error("SendGrid error 1"))
        .mockRejectedValueOnce(new Error("SendGrid error 2"))
        .mockRejectedValueOnce(new Error("SendGrid error 3"));

      const response = await authenticatedRequest('post', '/api/send-email')
        .send({
          to: "test@example.com",
          subject: "Test Subject",
          body: "Test Body"
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("error", "Failed to send email after multiple attempts");
      expect(sgMail.send).toHaveBeenCalledTimes(3);
    });

    it("should succeed on retry", async () => {
      // Fail first, succeed on second try
      sgMail.send
        .mockRejectedValueOnce(new Error("SendGrid error"))
        .mockResolvedValueOnce([{ statusCode: 202 }, {}]);

      const response = await authenticatedRequest('post', '/api/send-email')
        .send({
          to: "test@example.com",
          subject: "Test Subject",
          body: "Test Body"
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message", "Email sent successfully");
      expect(sgMail.send).toHaveBeenCalledTimes(2);
    });

    describe("Rate Limiting", () => {
      it("should limit excessive requests", async () => {
        // Make 101 requests (exceeding the 100 limit)
        for (let i = 0; i < 100; i++) {
          await authenticatedRequest('post', '/api/send-email')
            .send({
              to: "test@example.com",
              subject: "Test Subject",
              body: "Test Body"
            });
        }

        const response = await authenticatedRequest('post', '/api/send-email')
          .send({
            to: "test@example.com",
            subject: "Test Subject",
            body: "Test Body"
          });

        expect(response.status).toBe(429); // Too Many Requests
      });
    });
  });
});

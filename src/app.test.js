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
  describe("GET /", () => {
    it("should return a response", async () => {
      const response = await request.get("/");
      expect(response.status).toBe(200);
    });
  });

  describe("POST /api/send-email", () => {
    beforeEach(() => {
      // Clear mock calls before each test
      sgMail.send.mockClear();
    });

    it("should send email successfully", async () => {
      sgMail.send.mockResolvedValueOnce([{ statusCode: 202 }, {}]);

      const response = await request.post("/api/send-email").send({
        to: "test@example.com",
        subject: "Test Subject",
        body: "Test Body"
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty("message", "Email sent successfully");
      expect(sgMail.send).toHaveBeenCalled();
    });

    it("should validate email input", async () => {
      const response = await request.post("/api/send-email").send({
        to: "invalid-email",
        subject: "",
        body: ""
      });

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty("errors");
    });

    it("should handle SendGrid errors", async () => {
      sgMail.send.mockRejectedValueOnce(new Error("SendGrid error"));

      const response = await request.post("/api/send-email").send({
        to: "test@example.com",
        subject: "Test Subject",
        body: "Test Body"
      });

      expect(response.statusCode).toBe(500);
      expect(response.body).toHaveProperty("error");
    });
  });
});

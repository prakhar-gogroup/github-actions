const request = require("supertest");
const app = require("./app");

// Mock SendGrid
jest.mock("@sendgrid/mail", () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([
    {
      statusCode: 202,
      headers: {},
      body: {}
    }
  ])
}));

describe("Email Sending Endpoint", () => {
  const validEmail = {
    to: "test@example.com",
    subject: "Test Subject",
    body: "Test Body"
  };

  it("should successfully send an email with valid data", async () => {
    const response = await request(app).post("/send-email").send(validEmail);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Email sent successfully");
  });

  it("should reject invalid email addresses", async () => {
    const response = await request(app)
      .post("/send-email")
      .send({
        ...validEmail,
        to: "invalid-email"
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid email address");
  });

  it("should require all fields", async () => {
    const response = await request(app).post("/send-email").send({
      to: validEmail.to
      // missing subject and body
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Please provide all required fields");
  });
});

const app = require("./app");
const supertest = require("supertest");
const request = supertest(app);

describe(`Testing root '/'`, () => {
  it("should serve the email form", async () => {
    const response = await request.get("/");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/html/);
    expect(response.text).toContain("Send Email");
    expect(response.text).toContain("emailForm");
  });
});

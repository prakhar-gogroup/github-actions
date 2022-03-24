const app = require("./app");
const supertest = require("supertest");
const request = supertest(app);

describe(`Testing root '/'`, () => {
  it("should return a response", async () => {
    const response = await request.get("/");
    expect(response.status).toBe(200);
    expect(response.text).toBe("Hello there");
  });
});

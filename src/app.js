const express = require("express");
const rateLimit = require("express-rate-limit");
const sgMail = require("@sendgrid/mail");
const path = require("path");
require("dotenv").config();

const app = express();

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));
app.use(limiter);

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.post("/send-email", async (req, res) => {
  try {
    const { to, subject, body } = req.body;

    // Input validation
    if (!to || !subject || !body) {
      return res.status(400).json({ error: "Please provide all required fields" });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    const msg = {
      to,
      from: process.env.SENDER_EMAIL,
      subject,
      text: body,
      html: body.replace(/\n/g, "<br>")
    };

    await sgMail.send(msg);
    res.json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({
      error: "Failed to send email",
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

module.exports = app;

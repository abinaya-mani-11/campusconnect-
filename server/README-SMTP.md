SMTP setup

1. Copy `.env.example` to `.env` in the project root:

```powershell
Copy-Item .env.example .env
```

2. Open `.env` and paste your app password into the `SMTP_PASS` value. Also verify `SMTP_USER` is set to `2315002@nec.edu.in` (or change as needed).

3. Start the server from project root. The server (index-enhanced.js) loads `.env` automatically using dotenv.

```powershell
node server/index-enhanced.js
```

Notes
- Do NOT commit `.env` to source control. Add `.env` to your `.gitignore` file if it's not already ignored.
- If you use Gmail, ensure you configured an app password and that the account allows SMTP access.
- If emails still don't send, check server logs for nodemailer errors and verify the SMTP_PORT/SMTP_SECURE values.

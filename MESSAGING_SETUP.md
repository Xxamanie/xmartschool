# Parent Messaging (SMS & WhatsApp via Termii) — Setup

The system can now reach parents on **SMS and WhatsApp** — where Nigerian parents
actually are — for the two highest-value moments:

- **Fee reminders** — one click messages every owing student's parents.
- **Results published** — parents are auto-texted that results are out and to use
  the Result Access PIN.

It's **safe by default**: with no API key set, messaging is a logged no-op — nothing
breaks, and the UI tells you when nothing was sent.

## 1. Get a Termii account + key

1. Sign up at https://termii.com and fund the wallet (SMS/WhatsApp are pay-as-you-go,
   cheap per message).
2. Copy your **API Key** from the dashboard.
3. (SMS) Register a **Sender ID** (e.g. `XmartSch`) — required for SMS in Nigeria.
   WhatsApp uses Termii's approved sender.

## 2. Configure the backend

Add to `backend/.env`:

```
TERMII_API_KEY=your_termii_api_key
TERMII_SENDER_ID=XmartSch
```

Restart the backend.

## 3. Make sure parents have phone numbers

Messages go to the **phone** on each linked parent account (`User.phone`, linked to
students via the parent/guardian relationship). Add parent phone numbers in
**Settings → School / Parents** (or when creating parent accounts). Numbers are
normalised automatically (`08031234567` → `2348031234567`).

## 4. Use it

- **Fee reminders:** Admin → **Finance → Overview** → **"Send fee reminders (SMS)"**.
  It messages the parents of every student with an outstanding balance for the
  selected term and reports how many went out.
- **Results alerts:** happen automatically whenever an admin/teacher **publishes
  results** — no action needed.

## 5. Notes & next steps

- Default channel is **SMS** (highest reach). The backend already supports
  `channel: 'whatsapp'` — flip the Finance button to WhatsApp, or add a channel
  toggle, whenever you want.
- Termii also does **voice OTP** and **delivery reports** — easy follow-ons.
- For true two-way WhatsApp (parents replying), you'd move to the WhatsApp Business
  API with message templates; the current setup is one-way notifications, which is
  the 90% use case for schools.
- Every reminder run is written to the **audit log** (`SEND_FEE_REMINDERS`).

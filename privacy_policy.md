# Privacy Policy

**Last Updated: July 7, 2026**

This Privacy Policy describes how **Love Tracker** ("we", "our", or "the App") handles your information. Your privacy is our priority, and we design the App to be as private as possible.

## 1. Information Collection and Use

### a. Personal Data
The App does not require a traditional account (email/password) unless you choose to use the **Partner Sync** feature.
- **Partner Sync:** If you pair with a partner, we store your anonymous user ID, push notification token, and invitation codes on our servers to facilitate real-time synchronization.
- **Push Notifications:** We collect your device's push token to send alerts when your partner logs a shared event.

### b. Relationship Data (Events)
- **Private Events & Solo Diary Entries:** Any event you mark as "Private", and any Solo Diary entry not linked to a Contact, is backed up to our servers **for your own account recovery only** (e.g. if you lose or replace your device). These entries are tied exclusively to your user ID and are **never shared with, or made visible to, a partner** — this is enforced at the database query level, not just in the app's interface.
- **Shared Events:** If you use the Sync feature and mark an event as "Shared", the event details (type, date, notes, intensity, mood) are stored on our server so they can be synced to your partner's device.

### c. AI Insights (Optional)
If you explicitly opt in to **AI Insights**, structured details of your logged events (event type, intensity, mood, and relative timing) are sent to **Anthropic** (maker of Claude) to generate a pattern-based insight. Your free-text notes are **never** included in this data by default. AI Insights are generated only after your explicit consent, are scoped entirely to your own account, and — for paired users — never include a partner's private events. You can disable AI Insights at any time; disabling it stops all future data sharing with Anthropic for this purpose.

## 2. Biometrics and Security
The App offers a Biometric Lock (Fingerprint or FaceID). 
- **We do not collect or store your biometric data.** All biometric authentication is handled by your device's operating system (Android/iOS). The App only receives a "Success" or "Failure" signal from the OS.

## 3. Data Storage
- **Local Storage:** The App uses an offline-first SQLite database on your device.
- **Cloud Storage:** Shared events and pairing metadata are stored on our secure servers (hosted on Render/PostgreSQL).

## 4. Third-Party Services
We may use the following third-party services which collect data according to their own policies:
- **Google Play Services:** For App distribution and core Android functionality.
- **Expo:** For delivering push notifications.
- **Anthropic:** Only if you opt in to AI Insights — processes structured event data to generate insights, as described in Section 1c.

## 5. Data and Account Deletion

### In-App Deletion
You can delete your account and all associated data directly within the App:
1. Go to **Settings**.
2. Under the **Partner Sync** section, tap on **Delete Account**.
3. Confirm the action. This will permanently remove your user profile, partnership records, and shared events from our servers.

### Web-Based Deletion Request
If you no longer have the App installed and wish to request the deletion of your account and associated data, please send an email to **[dandenardi@example.com]** with the subject "Account Deletion Request". Please include the email address used for your account. We will process your request within 7 business days.

## 6. Changes to This Policy
We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.

## 7. Contact Us
If you have any questions about this Privacy Policy, you can contact us at: [dandenardi@example.com]

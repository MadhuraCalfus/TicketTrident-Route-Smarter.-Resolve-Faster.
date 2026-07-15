"""30 sample tickets for the mission's demo requirement.

Deliberately spans every dimension the classifier assigns, so a run of
`python -m app.cli demo` (or the Demo tab) gives a mentor a real look at the
AI routing across the full matrix — confirmed against a live run of the
classifier, not just designed on paper:
- all 7 tones (neutral, frustrated, angry, urgent, confused, worried, positive)
- all 3 priorities (High, Medium, Low), including cases that only reach High
  via the frustrated/angry/urgent escalation rule so that behavior is visible
- all 8 teams (Billing Support, Technical Support, Engineering, Account
  Management, Product Team, Security Team, Customer Success, Triage)

Also keeps the 3 required edge cases (angry tone, very short message,
ambiguous ticket) plus a few extra curveballs (sarcasm, multi-issue,
non-English-keyword phrasing) that the keyword baseline is expected to get
wrong, to make the AI-vs-baseline comparison land during the demo.

Tags describe what's notable about the ticket, not a guaranteed outcome —
tone/priority/confidence are the live model's judgment call and can shift
slightly between runs or providers.
"""

SAMPLE_TICKETS = [
    # Billing Support (category: Billing)
    {"text": "I was charged twice for my subscription this month, can someone look into this?", "tag": "billing_duplicate_charge"},
    {"text": "THIS IS ABSOLUTELY RIDICULOUS. I've been charged $200 for a plan I CANCELLED THREE MONTHS AGO and nobody will help me!!!", "tag": "billing_angry"},
    {"text": "cancel my subscription NOW. this is a scam and I want a refund immediately", "tag": "billing_urgent_refund"},
    {"text": "I'm thinking about switching my subscription from the monthly plan to the annual plan — will I be charged the prorated difference right away, or does it wait until my current billing cycle ends?", "tag": "billing_calm_question"},

    # Technical Support (category: Technical Issue)
    {"text": "Why does exporting a CSV take forever? Is this expected?", "tag": "technical_slow_export"},
    {"text": "our production API integration has been returning 500 errors for the last 20 minutes, this is affecting our checkout flow", "tag": "technical_outage_urgent"},
    {"text": "The page takes an extra second or two to load sometimes lately — is that normal, or should I be concerned?", "tag": "technical_minor_confused"},
    {"text": "Sync between my phone and desktop app has been inconsistent for a few days now, can you check what's going on?", "tag": "technical_sync_worried"},

    # Engineering (category: Bug Report)
    {"text": "This is ridiculous!! The dark mode toggle resets every single time I refresh the page!!!", "tag": "bug_cosmetic_angry"},
    {"text": "The app keeps crashing every time I try to upload a photo. This has been happening since the last update.", "tag": "bug_crash"},
    {"text": "I am so frustrated - every time I try to attach a file to a ticket the whole page freezes and I have to reload, this has happened five times today.", "tag": "bug_frustrated"},
    {"text": "The app crashed while I was uploading photos and now I can't find them anywhere in the gallery. Did I lose them for good?", "tag": "bug_data_loss_worried"},

    # Account Management (category: Account Access)
    {"text": "I can't log into my account, it says my password is incorrect but I know it's right.", "tag": "account_login_confused"},
    {"text": "I'm locked out of my account and I have a client presentation in an hour, please help urgently!", "tag": "account_locked_urgent"},
    {"text": "My two-factor codes stopped arriving by text a couple days ago, can you check what's going on?", "tag": "account_2fa_neutral"},

    # Product Team (category: Feature Request)
    {"text": "It would be really nice if the dashboard had a dark mode option.", "tag": "feature_dark_mode"},
    {"text": "Can you add support for SSO with Okta? We're evaluating this for our enterprise rollout.", "tag": "feature_sso"},

    # Customer Success (category: Complaint / General Inquiry)
    {"text": "This is the third time I'm writing about the same billing issue and no one has responded. I am extremely frustrated at this point.", "tag": "complaint_repeat_frustrated"},
    {"text": "Oh great, ANOTHER outage. Third time this week. Really building my confidence in this product.", "tag": "sarcasm"},
    {"text": "What are your support hours on weekends?", "tag": "general_hours"},
    {"text": "I've noticed response times from support have gotten noticeably slower over the past month compared to before, just wanted to flag it.", "tag": "complaint_slow_support"},
    {"text": "Just wanted to say the new update is great, really smooth experience now. Thanks team!", "tag": "general_positive"},

    # Security Team (category: Security Concern)
    {"text": "I received an email saying my password was reset, but I never requested that. Is my account compromised?", "tag": "security_password_reset"},
    {"text": "someone logged into my account from a country I've never been to, please help", "tag": "security_unknown_login"},
    {"text": "I noticed one of our developers accidentally exposed our API key in a public GitHub repo a few weeks ago, wanted to flag it so it can be rotated.", "tag": "security_leaked_key"},

    # Triage (very short / near-empty, ambiguous by design)
    {"text": "Help.", "tag": "very_short"},
    {"text": "??", "tag": "very_short"},
    {"text": "hey", "tag": "very_short"},

    # Ambiguous / multi-issue curveballs
    {"text": "Not sure where this goes but the app is slow, my invoice looks wrong, and also is there a way to export my data?", "tag": "ambiguous"},
    {"text": "I think I was overcharged but honestly I'm also having trouble understanding my invoice at all, could someone explain it and also check the amount?", "tag": "ambiguous"},
]

"""20 sample tickets for the mission's demo requirement.

Deliberately mixes ordinary tickets with the 3 required edge cases (angry
tone, very short message, ambiguous ticket) plus a few extra curveballs
(sarcasm, multi-issue, non-English-keyword phrasing) that the keyword
baseline is expected to get wrong, to make the AI-vs-baseline comparison
land during the demo.
"""

SAMPLE_TICKETS = [
    {"text": "I was charged twice for my subscription this month, can someone look into this?", "tag": "billing"},
    {"text": "The app keeps crashing every time I try to upload a photo. This has been happening since the last update.", "tag": "bug"},
    {"text": "I can't log into my account, it says my password is incorrect but I know it's right.", "tag": "account_access"},
    {"text": "It would be really nice if the dashboard had a dark mode option.", "tag": "feature_request"},
    {"text": "THIS IS ABSOLUTELY RIDICULOUS. I've been charged $200 for a plan I CANCELLED THREE MONTHS AGO and nobody will help me!!!", "tag": "angry_tone"},
    {"text": "Help.", "tag": "very_short"},
    {"text": "Not sure where this goes but the app is slow, my invoice looks wrong, and also is there a way to export my data?", "tag": "ambiguous"},
    {"text": "I received an email saying my password was reset, but I never requested that. Is my account compromised?", "tag": "security"},
    {"text": "Just wanted to say the new update is great, really smooth experience now. Thanks team!", "tag": "positive"},
    {"text": "Why does exporting a CSV take forever? Is this expected?", "tag": "technical"},
    {"text": "cancel my subscription NOW. this is a scam and I want a refund immediately", "tag": "angry_tone"},
    {"text": "??", "tag": "very_short"},
    {"text": "our production API integration has been returning 500 errors for the last 20 minutes, this is affecting our checkout flow", "tag": "urgent_technical"},
    {"text": "Oh great, ANOTHER outage. Third time this week. Really building my confidence in this product.", "tag": "sarcasm"},
    {"text": "Can you add support for SSO with Okta? We're evaluating this for our enterprise rollout.", "tag": "feature_request"},
    {"text": "I think I was overcharged but honestly I'm also having trouble understanding my invoice at all, could someone explain it and also check the amount?", "tag": "ambiguous"},
    {"text": "someone logged into my account from a country I've never been to, please help", "tag": "security"},
    {"text": "hey", "tag": "very_short"},
    {"text": "This is the third time I'm writing about the same billing issue and no one has responded. I am extremely frustrated at this point.", "tag": "angry_tone"},
    {"text": "What are your support hours on weekends?", "tag": "general"},
]
